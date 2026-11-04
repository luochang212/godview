import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { apply } from '../lib/index.js';
import * as S from 'godview';

// A blocked session is still working: it keeps its leases and waits to resume
// (ADR 31), and the Pi adapter renews them off the board status. The DSH
// heartbeat used to renew only while the host agent status was 'running', so a
// blocked session whose turn settled watched its leases age out silently.
test('a blocked session keeps its leases renewed after the turn settles', async () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-blocked-'));
  fs.mkdirSync(path.join(repo, '.git'));
  const registry = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-blocked-reg-'));
  const handlers = new Map();
  const tools = new Map();
  const ctx = {
    tools: {
      register(definition) {
        tools.set(definition.name, definition);
        return () => tools.delete(definition.name);
      },
    },
    effect(fn) {
      return fn();
    },
    on(event, listener) {
      const list = handlers.get(event) || [];
      list.push(listener);
      handlers.set(event, list);
      return () => {};
    },
    get() {
      return undefined;
    },
    inject(deps, callback) {
      callback(ctx);
    },
  };
  // 2000 is the heartbeatMs clamp floor in readConfig; the wait below must
  // cover at least one beat.
  const dispose = apply(ctx, { root: repo, registryDir: registry, heartbeatMs: 2_000, prompt: false });
  const emit = (event, payload) => {
    // A real host keeps agent.status live; mirror it so the heartbeat's
    // entry.agent.status check sees what production would see.
    if (event === 'agent/status' && payload && payload.agent) payload.agent.status = payload.status;
    for (const listener of handlers.get(event) || []) listener(payload);
  };
  try {
    const bob = {
      session: { id: 'sess-bob', header: { cwd: repo } },
      status: 'idle',
      ctx: { get: () => undefined, effect: (fn) => fn() },
    };
    emit('agent/status', { agent: bob, status: 'running' });
    const pre = handlers.get('tools/pre-execute')[0];
    const allow = { kind: 'allow' };
    await pre({ name: 'write', agent: bob, arguments: { file_path: 'src/blocked.ts' } }, async () => allow);
    await tools.get('team_status').execute({ status: 'blocked', focus: 'need human' }, { agent: bob });
    emit('agent/status', { agent: bob, status: 'idle' });
    const before = S.getClaim(repo, 'src/blocked.ts');
    assert.ok(before, 'the blocked session keeps its lease when the turn settles');
    await new Promise((resolve) => setTimeout(resolve, 2_600));
    const after = S.getClaim(repo, 'src/blocked.ts');
    assert.ok(after, 'the lease is still live after a heartbeat');
    assert.ok(after.expiresAt > before.expiresAt, 'the heartbeat renewed the blocked session’s lease');
  } finally {
    dispose();
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(registry, { recursive: true, force: true });
  }
});
