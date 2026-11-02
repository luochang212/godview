import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import * as S from 'godview';
import plugin from '../extensions/pi-godview.js';
import { installGuard } from '../lib/guard.js';
import { PiBoard } from '../lib/session.js';
import { createTools } from '../lib/tools.js';

function fixture(id, suffix = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-godview-'));
  fs.mkdirSync(path.join(root, '.git'));
  const ctx = {
    cwd: root,
    sessionManager: {
      getSessionId: () => id,
      getSessionName: () => 'session-' + id + suffix,
    },
  };
  return { root, ctx };
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function makeBoardAt(root, id) {
  const ctx = {
    cwd: root,
    sessionManager: {
      getSessionId: () => id,
      getSessionName: () => 'session-' + id,
    },
  };
  const board = new PiBoard(ctx, {
    registryDir: path.join(root, 'registry'),
    heartbeatMs: 60_000,
    ttlMs: 60_000,
  });
  board.start();
  return board;
}

function makeBoard(id, options = {}) {
  const { root, ctx } = fixture(id, options.suffix || '');
  const board = new PiBoard(ctx, {
    registryDir: path.join(root, 'registry'),
    heartbeatMs: 60_000,
    ttlMs: 60_000,
    ...options,
  });
  board.start();
  return { root, ctx, board };
}

test('session start writes presence and stop leaves a done row', () => {
  const { root, board } = makeBoard('s1');
  const first = S.snapshot(root);
  assert.equal(first.agents.length, 1);
  assert.equal(first.agents[0].id, 'pi-' + S.hash('s1').slice(0, 10));
  assert.equal(first.agents[0].status, 'active');
  assert.equal(first.agents[0].focus, 'starting');
  assert.equal(first.agents[0].role, 'pi');

  board.setFocusFromPrompt('Fix the parser bug. Then update the docs.');
  assert.equal(S.getAgent(root, board.id).focus, 'Fix the parser bug');

  board.claim(['src/parser.js'], { reason: 'fix parser' });
  assert.equal(S.listClaims(root).length, 1);
  board.stop('test done');

  const after = S.snapshot(root);
  assert.equal(after.agents[0].status, 'done');
  assert.equal(after.claims.length, 0);
  cleanup(root);
});

test('a conflicting write is blocked and an unclaimed write auto-claims', () => {
  const { root, board: a } = makeBoard('a');
  const b = makeBoardAt(root, 'b');
  a.claim(['src/shared.js'], { reason: 'A owns it' });

  const blocked = b.checkWrite('src/shared.js', 'write');
  assert.match(blocked, /claimed by session-a/);
  assert.match(blocked, /src\/shared\.js/);

  assert.equal(b.checkWrite('src/other.js', 'edit'), undefined);
  assert.equal(S.getClaim(root, 'src/other.js').agent, b.id);

  a.stop('test');
  b.stop('test');
  cleanup(root);
});

test('guard returns block for a live lease held by another agent', async () => {
  const { root, board: a } = makeBoard('a');
  const b = makeBoardAt(root, 'b');
  a.claim(['src/blocked.js'], { reason: 'A owns it' });

  const handlers = {};
  installGuard(
    {
      on: (name, handler) => {
        handlers[name] = handler;
      },
    },
    () => b,
  );
  const result = await handlers.tool_call({
    toolName: 'write',
    input: { path: 'src/blocked.js', content: 'nope' },
  });
  assert.equal(result.block, true);
  assert.match(result.reason, /File lease conflict/);

  assert.equal(await handlers.tool_call({ toolName: 'read', input: { path: 'src/blocked.js' } }), undefined);
  assert.equal(await handlers.tool_call({ toolName: 'write', input: { path: 'src/new.js' } }), undefined);
  assert.equal(S.getClaim(root, 'src/new.js').agent, b.id);

  a.stop('test');
  b.stop('test');
  cleanup(root);
});

test('the three tools claim, list, release, and report status', async () => {
  const { root, board } = makeBoard('tools');
  const tools = createTools(() => board);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['team_status', 'team_roster', 'team_claim'],
  );
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));

  const status = await byName.team_status.execute(
    'id',
    { status: 'blocked', focus: 'blocked on tests' },
    null,
    null,
    {},
  );
  assert.match(status.content[0].text, /blocked/);
  assert.match(status.content[0].text, /blocked on tests/);
  assert.match(status.content[0].text, /Other sessions:/);

  const claimed = await byName.team_claim.execute(
    'id',
    { action: 'claim', paths: ['src/a.js'], reason: 'work' },
    null,
    null,
    {},
  );
  assert.match(claimed.content[0].text, /claimed src\/a\.js/);
  assert.deepEqual(claimed.details.claimed, ['src/a.js']);

  const roster = await byName.team_roster.execute('id', {}, null, null, {});
  assert.match(roster.content[0].text, /src\/a\.js/);
  assert.match(roster.content[0].text, /blocked/);

  const released = await byName.team_claim.execute('id', { action: 'release', paths: ['src/a.js'] }, null, null, {});
  assert.match(released.content[0].text, /released src\/a\.js/);
  assert.equal(S.listClaims(root).length, 0);

  board.claim(['src/auto-idle.js'], { auto: true, reason: 'auto' });
  await byName.team_status.execute('id', { status: 'idle' }, null, null, {});
  assert.equal(S.getClaim(root, 'src/auto-idle.js'), undefined, 'idle releases the auto lease');

  await byName.team_status.execute('id', { status: 'done' }, null, null, {});
  assert.equal(S.getAgent(root, board.id).status, 'done');
  const doneRoster = await byName.team_roster.execute('id', {}, null, null, {});
  assert.match(doneRoster.content[0].text, /Sessions: 0 listed/);
  board.stop('test');
  cleanup(root);
});

test('heartbeat renews the leases of an active session', () => {
  const { root, board } = makeBoard('renew');
  board.claim(['src/long.js'], { reason: 'long turn' });
  const file = path.join(root, '.dsh/parallel/claims', S.hash('src/long.js') + '.json');
  const before = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Age the lease close to expiry without expiring it: a turn that outlives
  // the auto TTL must be kept alive by the heartbeat between writes.
  fs.writeFileSync(file, JSON.stringify({ ...before, expiresAt: Date.now() + 10_000 }, null, 2));
  board.heartbeat();
  const after = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(after.expiresAt > Date.now() + 60_000, 'the active session renews its lease');
  // A blocked session is still working and waiting to resume; it must keep
  // renewing, not let the lease expire under it.
  board.update({ status: 'blocked' });
  const blockedBefore = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...blockedBefore, expiresAt: Date.now() + 10_000 }, null, 2));
  board.heartbeat();
  const blockedAfter = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(blockedAfter.expiresAt > Date.now() + 60_000, 'a blocked session renews its lease');
  // An idle session stops renewing so its leases age out to bound them.
  board.update({ status: 'idle' });
  const idleBefore = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...idleBefore, expiresAt: Date.now() + 10_000 }, null, 2));
  board.heartbeat();
  const idleAfter = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(idleAfter.expiresAt <= Date.now() + 60_000, 'an idle session does not renew');
  board.stop('test');
  cleanup(root);
});

test('the write guard fails open when the board itself is unwritable', () => {
  const { root, board } = makeBoard('failopen');
  const claimsDir = path.join(root, '.dsh/parallel/claims');
  fs.rmSync(claimsDir, { recursive: true, force: true });
  fs.writeFileSync(claimsDir, 'not a directory');
  assert.equal(board.checkWrite('src/fresh.js', 'write'), undefined);
  board.stop('test');
  cleanup(root);
});

test('a session start survives an unwritable board directory', () => {
  const { root, ctx } = fixture('guarded');
  const claimsDir = path.join(root, '.dsh/parallel/claims');
  fs.mkdirSync(path.join(root, '.dsh/parallel'), { recursive: true });
  fs.writeFileSync(claimsDir, 'not a directory');
  const board = new PiBoard(ctx, { registryDir: path.join(root, 'registry'), heartbeatMs: 60_000, ttlMs: 60_000 });
  board.start();
  assert.equal(board.started, false, 'start degrades to dormant instead of throwing');
  board.stop('test');
  cleanup(root);
});

test('a session outside a repository does not create a board', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-godview-norepo-'));
  const ctx = {
    cwd: root,
    sessionManager: { getSessionId: () => 'norepo', getSessionName: () => 'session-norepo' },
  };
  const board = new PiBoard(ctx, { registryDir: path.join(root, 'registry') });
  board.start();
  assert.equal(board.started, false, 'no board without a repository marker');
  assert.equal(fs.existsSync(path.join(root, '.dsh')), false);
  board.stop('test');
  // An explicit root override still forces a board.
  const forced = new PiBoard(ctx, { registryDir: path.join(root, 'registry'), root });
  forced.start();
  assert.equal(forced.started, true, 'options.root forces a board');
  forced.stop('test');
  cleanup(root);
});

test('a blocked session keeps its leases when the turn settles', () => {
  const { root, board } = makeBoard('blocked');
  board.claim(['src/blocked-auto.js'], { auto: true, reason: 'auto' });
  board.update({ status: 'blocked' });
  board.agentSettled();
  assert.ok(S.getClaim(root, 'src/blocked-auto.js'), 'a blocked session keeps its leases');
  assert.equal(S.getAgent(root, board.id).status, 'blocked', 'the blocked status is kept');
  board.stop('test');
  cleanup(root);
});

test('a done session stays done through settle', () => {
  const { root, board } = makeBoard('done-settle');
  board.update({ status: 'done' });
  const before = S.getAgent(root, board.id);
  assert.equal(before.status, 'done');
  assert.ok(before.finishedAt);
  board.agentSettled();
  const after = S.getAgent(root, board.id);
  assert.equal(after.status, 'done', 'settle does not rewrite done to idle');
  assert.equal(after.finishedAt, before.finishedAt, 'the finish timestamp survives settle');
  board.stop('test');
  cleanup(root);
});

test('team_claim resolves repository-relative paths from a subdirectory', () => {
  const { root } = fixture('subdir');
  const sub = path.join(root, 'packages', 'x');
  fs.mkdirSync(sub, { recursive: true });
  const ctx = {
    cwd: sub,
    sessionManager: {
      getSessionId: () => 'subdir',
      getSessionName: () => 'session-subdir',
    },
  };
  const board = new PiBoard(ctx, {
    registryDir: path.join(root, 'registry'),
    heartbeatMs: 60_000,
    ttlMs: 60_000,
  });
  board.start();
  board.claim(['lib/session.js'], { reason: 'nested work' });
  assert.ok(S.getClaim(root, 'lib/session.js'), 'the path is anchored at the repository root');
  assert.equal(S.getClaim(root, 'packages/x/lib/session.js'), undefined, 'no phantom cwd-relative lease');
  board.release(['lib/session.js']);
  assert.equal(S.getClaim(root, 'lib/session.js'), undefined);
  board.stop('test');
  cleanup(root);
});

test('team_claim release without paths is an error, not a silent release-all', async () => {
  const { root, board } = makeBoard('relpath');
  board.claim(['src/keep.js'], { auto: true, reason: 'auto' });
  const tools = createTools(() => board);
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
  await assert.rejects(
    () => byName.team_claim.execute('id', { action: 'release' }, null, null, {}),
    /at least one path/,
  );
  assert.ok(S.getClaim(root, 'src/keep.js'), 'the lease survives the failed release');
  board.stop('test');
  cleanup(root);
});

test('the board sweeps ancient rows it no longer needs', () => {
  const { root, board } = makeBoard('prune');
  S.createAgent(root, { id: 'ghost', name: 'Ghost' });
  const ghostFile = path.join(root, '.dsh/parallel/agents', 'ghost.json');
  const old = new Date(Date.now() - 8 * 24 * 60 * 60_000);
  fs.utimesSync(ghostFile, old, old);
  board.lastPruneAt = 0;
  board.heartbeat();
  assert.equal(fs.existsSync(ghostFile), false, 'ancient presence rows are pruned');
  assert.ok(S.getAgent(root, board.id), 'the live session survives its own sweep');
  board.stop('test');
  cleanup(root);
});

test('panel lines are derived from the shared store', () => {
  const { root, board } = makeBoard('panel');
  board.claim(['src/panel.js'], { reason: 'panel work' });
  const lines = board.panelLines();
  assert.match(lines[0], /godview/);
  assert.match(lines[0], /1 session/);
  assert.ok(lines.some((line) => line.includes('src/panel.js')));
  assert.match(board.summaryLine(), /GV 1a\/1c/);
  board.stop('test');
  cleanup(root);
});

test('extension registers three tools, the guard, and /godview', () => {
  const tools = [];
  const commands = {};
  const events = {};
  const pi = {
    registerTool: (tool) => tools.push(tool),
    registerCommand: (name, options) => {
      commands[name] = options;
    },
    on: (name, handler) => {
      events[name] = handler;
    },
  };
  plugin(pi);
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['team_status', 'team_roster', 'team_claim'],
  );
  assert.equal(typeof commands.godview.handler, 'function');
  for (const event of [
    'session_start',
    'session_shutdown',
    'input',
    'before_agent_start',
    'agent_start',
    'agent_settled',
    'tool_call',
  ]) {
    assert.equal(typeof events[event], 'function', event);
  }
});

test('package manifest exposes a pi extension and the pi-package keyword', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, 'pi-godview');
  assert.equal(pkg.version, '0.1.0');
  assert.ok(pkg.keywords.includes('pi-package'));
  assert.deepEqual(pkg.pi.extensions, ['./extensions/pi-godview.js']);
  assert.equal(pkg.dependencies.godview, '^0.1.0');
});
