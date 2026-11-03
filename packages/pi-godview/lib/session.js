/**
 * Pi session adapter over the generic godview store.
 *
 * Pi gives one coding-agent session a cwd and a session id. This module maps
 * that session to one board agent, keeps its heartbeat alive, and exposes the
 * small operations the three team tools and the TUI panel need.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as S from 'godview';
import * as R from 'godview/report';

export const HEARTBEAT_MS = 15_000;
export const TTL_MS = 60_000;
export const AUTO_CLAIM_TTL_MS = 10 * 60_000;
export const PANEL_REFRESH_MS = 2_500;
export const PRUNE_MS = 6 * 60 * 60_000;

const missingRepoWarned = new Set();

function hasRepoMarker(root) {
  return fs.existsSync(path.join(root, '.git')) || S.hasBoard(root);
}

export function piAgentId(sessionId) {
  return 'pi-' + S.hash(String(sessionId || 'unknown')).slice(0, 10);
}

export function oneLine(value, max = 180) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + '…';
}

function sessionName(ctx, sessionId) {
  try {
    const name =
      ctx && ctx.sessionManager && ctx.sessionManager.getSessionName ? ctx.sessionManager.getSessionName() : undefined;
    if (name) return String(name).slice(0, 80);
  } catch {}
  const raw = String(sessionId || 'pi')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 24)
    .replace(/^-+|-+$/g, '');
  return 'pi-' + (raw || 'session');
}

export class PiBoard {
  constructor(ctx, options = {}) {
    this.ctx = ctx;
    this.options = options;
    this.sessionId = String(
      (ctx && ctx.sessionManager && ctx.sessionManager.getSessionId && ctx.sessionManager.getSessionId()) || 'unknown',
    );
    this.cwd = path.resolve((ctx && ctx.cwd) || process.cwd());
    this.root = S.resolveRepoRoot(this.cwd, options.root);
    this.id = piAgentId(this.sessionId);
    this.sessionTitle = sessionName(ctx, this.sessionId);
    this.registryDir = options.registryDir || path.join(os.homedir(), S.STORE_DIR);
    this.heartbeatMs = Number(options.heartbeatMs) > 0 ? Number(options.heartbeatMs) : HEARTBEAT_MS;
    this.ttlMs = Number(options.ttlMs) > 0 ? Number(options.ttlMs) : TTL_MS;
    this.autoClaimTtlMs = Number(options.autoClaimTtlMs) > 0 ? Number(options.autoClaimTtlMs) : AUTO_CLAIM_TTL_MS;
    this.started = false;
    this.presence = null;
    this.lastPruneAt = 0;
    this.heartbeatTimer = null;
    this.panelTimer = null;
    this.panelOn = false;
    this.panelCtx = null;
  }

  start() {
    if (this.started) this.stop('restart');
    // Outside a repository there is no board to join; skipping keeps stray
    // scratch directories out of every project index. An explicit options.root
    // still forces a board, mirroring the DSH host's config.root override.
    if (!this.options.root && !hasRepoMarker(this.root)) {
      if (!missingRepoWarned.has(this.root)) {
        missingRepoWarned.add(this.root);
        console.warn(
          '[pi-godview] skipping board for non-repo directory ' + this.root + ' (set options.root to override)',
        );
      }
      return this;
    }
    try {
      S.ensureStore(this.root, { create: true });
      S.registerProject(this.registryDir, {
        root: this.root,
        name: path.basename(this.root),
        lastSeenAt: Date.now(),
      });
      this.presence = S.createAgent(this.root, {
        id: this.id,
        name: this.sessionTitle,
        role: 'pi',
        status: 'active',
        focus: 'starting',
        sessionId: this.sessionId,
        sessionTitle: this.sessionTitle,
        cwd: this.cwd,
        ttlMs: this.ttlMs,
      });
      this.started = true;
      this.heartbeatTimer = setInterval(() => this.heartbeat(), this.heartbeatMs);
      if (this.heartbeatTimer.unref) this.heartbeatTimer.unref();
      this.heartbeat();
    } catch (error) {
      // A broken board directory must not kill the coding session: run
      // dormant (no presence, no guard, no tools) and say why.
      console.warn('[pi-godview] board start failed, running dormant: ' + (error && error.stack ? error.stack : error));
    }
    return this;
  }

  stop(reason = 'session end') {
    if (!this.started) {
      this.stopPanel();
      return;
    }
    this.started = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.stopPanel();
    try {
      const claims = S.listClaims(this.root).filter((claim) => claim.agent === this.id);
      if (claims.length > 0) {
        S.releasePaths(
          this.root,
          this.id,
          claims.map((claim) => claim.path),
          { summary: reason },
        );
      }
      S.updateAgent(this.root, this.id, {
        status: 'done',
        focus: 'finished',
        lastAction: reason,
      });
    } catch (error) {
      console.warn('[pi-godview] board stop failed: ' + (error && error.message ? error.message : error));
    }
  }

  heartbeat() {
    if (!this.started) return;
    try {
      S.heartbeat(this.root, this.id);
      // Renew this session's leases while its turn is active, like the DSH
      // host does; without this a long turn outlives its own lease. An idle
      // session stops renewing so its leases age out.
      const status = this.presence && this.presence.status;
      // A blocked session is still working and is waiting to resume; it must
      // keep its leases alive, exactly like the DSH host does.
      if (status === 'active' || status === 'blocked') S.renewClaims(this.root, this.id);
      S.expireClaims(this.root);
      if (Date.now() - this.lastPruneAt >= PRUNE_MS) {
        this.lastPruneAt = Date.now();
        S.prune(this.root);
      }
      this.presence = S.getAgent(this.root, this.id) || this.presence;
    } catch (error) {
      console.warn('[pi-godview] heartbeat failed: ' + (error && error.message ? error.message : error));
    }
  }

  update(patch = {}) {
    if (!this.started) return this.presence;
    try {
      this.presence = S.updateAgent(this.root, this.id, patch);
    } catch (error) {
      console.warn('[pi-godview] presence update failed: ' + (error && error.message ? error.message : error));
    }
    return this.presence;
  }

  touch(patch = {}) {
    return this.update({ ...patch });
  }

  setStatus(status, extra = {}) {
    if (!['active', 'idle', 'blocked', 'done'].includes(status)) return this.presence;
    return this.update({ ...extra, status });
  }

  setSessionTitle(name) {
    const title = String(name || '')
      .trim()
      .slice(0, 200);
    if (!title) return this.presence;
    this.sessionTitle = title;
    return this.update({ sessionTitle: title });
  }

  setFocusFromPrompt(text) {
    if (!this.started || !text) return;
    const current = this.presence || S.getAgent(this.root, this.id);
    if (!current) return;
    if (current.focus && current.focus !== 'starting') return;
    const first = String(text)
      .replace(/\s+/g, ' ')
      .split(/[。！？!?]\s*|\.\s+/)[0];
    const focus = oneLine(first || text, 160);
    if (focus) this.update({ focus, lastAction: 'prompt' });
  }

  agentStart() {
    return this.setStatus('active', { lastAction: 'agent start' });
  }

  agentSettled() {
    const current = this.presence || S.getAgent(this.root, this.id);
    if (current && (current.status === 'blocked' || current.status === 'done')) {
      // A blocked session is still working: it keeps its leases and waits to
      // be unblocked, matching the DSH host. A done session is closed and must
      // not be rewritten to idle by the next settle.
      return;
    }
    this.setStatus('idle', { lastAction: 'idle' });
    this.releaseAutoClaims('idle');
  }

  releaseAutoClaims(summary = 'idle') {
    try {
      const claims = S.listClaims(this.root).filter((claim) => claim.agent === this.id && claim.auto === true);
      if (claims.length === 0) return;
      S.releasePaths(
        this.root,
        this.id,
        claims.map((claim) => claim.path),
        { summary },
      );
    } catch (error) {
      console.warn('[pi-godview] auto-claim release failed: ' + (error && error.message ? error.message : error));
    }
  }

  releaseAll(summary = 'finished') {
    try {
      const claims = S.listClaims(this.root).filter((claim) => claim.agent === this.id);
      if (claims.length === 0) return;
      S.releasePaths(
        this.root,
        this.id,
        claims.map((claim) => claim.path),
        { summary },
      );
    } catch (error) {
      console.warn('[pi-godview] lease release failed: ' + (error && error.message ? error.message : error));
    }
  }

  repoRel(raw, fromRoot = false) {
    const base = fromRoot ? this.root : this.cwd;
    const absolute = path.isAbsolute(String(raw)) ? path.resolve(String(raw)) : path.resolve(base, String(raw));
    return S.normalizeRepoPath(this.root, absolute);
  }

  claim(paths, options = {}) {
    const rels = (paths || []).map((value) => this.repoRel(value, true));
    const focus = (this.presence && this.presence.focus) || 'claim';
    const result = S.claimPaths(this.root, this.id, rels, {
      mode: options.mode === 'review' ? 'review' : 'edit',
      auto: options.auto === true,
      ttlMs: options.ttlMs,
      intent: options.intent || options.reason || focus,
      reason: options.reason,
      sessionId: this.sessionId,
      sessionTitle: this.sessionTitle,
    });
    this.presence = S.getAgent(this.root, this.id) || this.presence;
    return result;
  }

  release(paths, summary = 'released') {
    const rels = (paths || []).map((value) => this.repoRel(value, true));
    const result = S.releasePaths(this.root, this.id, rels, { summary });
    this.presence = S.getAgent(this.root, this.id) || this.presence;
    return result;
  }

  checkWrite(raw, toolName = 'write') {
    if (!this.started) return undefined;
    let rel;
    try {
      rel = this.repoRel(raw);
    } catch {
      return undefined;
    }
    if (!rel) return undefined;
    let claim;
    try {
      claim = S.getClaim(this.root, rel);
    } catch {
      return undefined;
    }
    if (claim && claim.agent !== this.id) return this.claimDenial(claim, rel);
    if (!claim) {
      const focus = (this.presence && this.presence.focus) || 'auto ' + toolName;
      try {
        const result = this.claim([rel], {
          auto: true,
          ttlMs: this.autoClaimTtlMs,
          reason: 'auto claim for ' + toolName,
          intent: focus,
        });
        if (result.conflicts.length > 0) return this.claimDenial(result.conflicts[0], rel);
      } catch (error) {
        // The guard protects coordination, not the write itself; if the board
        // is unwritable the write proceeds unguarded instead of failing.
        console.warn(
          '[pi-godview] auto-claim failed, write allowed: ' + (error && error.message ? error.message : error),
        );
      }
    }
    return undefined;
  }

  claimDenial(claim, rel) {
    return R.claimDenialText(claim, rel);
  }

  statusText(updated) {
    const agent = updated || this.presence || {};
    // Same collision view as the DSH host: working or blocked peers only,
    // from the shared report module (ADR 31). Idle sessions cannot conflict.
    const peers = R.activePeers(this.root, this.id);
    const claims = R.claimsByOthers(this.root, this.id);
    const lines = [
      'You are ' +
        (agent.name || 'unknown') +
        ' (' +
        this.id +
        ') in ' +
        this.root +
        ' - ' +
        (agent.status || 'idle') +
        (agent.focus ? ': ' + agent.focus : '') +
        '.',
      'Other sessions: ' +
        (peers.length
          ? peers.map((item) => item.name + ' [' + item.status + '] ' + (item.focus || 'no focus')).join('; ')
          : 'none') +
        '.',
    ];
    if (claims.length > 0) {
      lines.push(
        'Files claimed by others: ' + claims.map((claim) => claim.path + ' (' + claim.agentName + ')').join(', '),
      );
    }
    return lines.join('\n');
  }

  rosterText(includeStale = false) {
    return R.renderRoster(this.root, this.id, { includeStale });
  }

  panelLines() {
    const snap = S.snapshot(this.root, { changeLimit: 12, create: false });
    const active = snap.agents.filter((agent) => !agent.stale && agent.status !== 'done');
    const claims = snap.claims;
    const changes = S.listChanges(this.root, { limit: 6 });
    const lines = [
      'godview · ' +
        path.basename(this.root) +
        ' · ' +
        active.length +
        (active.length === 1 ? ' session' : ' sessions') +
        ' · ' +
        claims.length +
        ' claims',
    ];
    for (const agent of active.slice(0, 8)) {
      lines.push('● ' + oneLine(agent.name, 40) + ' [' + agent.status + '] ' + oneLine(agent.focus || 'no focus', 96));
    }
    if (active.length === 0 && claims.length === 0) lines.push('no active peers');
    for (const claim of claims.slice(0, 6)) {
      lines.push('◆ ' + oneLine(claim.path, 60) + ' → ' + oneLine(claim.agentName, 24));
    }
    for (const change of changes.slice(0, 3)) {
      lines.push('· [' + change.state + '] ' + oneLine(change.agentName, 24) + ': ' + oneLine(change.intent, 72));
    }
    return lines;
  }

  summaryLine() {
    try {
      const snap = S.snapshot(this.root, { create: false });
      const active = snap.agents.filter((agent) => !agent.stale && agent.status !== 'done').length;
      return 'GV ' + active + 'a/' + snap.claims.length + 'c';
    } catch {
      return 'GV';
    }
  }

  startPanel(ctx) {
    if (this.panelOn) return true;
    if (!ctx || !ctx.hasUI) {
      try {
        ctx.ui.notify('godview panel needs a TUI or RPC session', 'warning');
      } catch {}
      return false;
    }
    this.panelOn = true;
    this.panelCtx = ctx;
    const refresh = () => {
      if (!this.panelOn) return;
      try {
        ctx.ui.setWidget('godview', this.panelLines(), { placement: 'aboveEditor' });
        if (ctx.ui.setStatus) ctx.ui.setStatus('godview', this.summaryLine());
      } catch {}
    };
    refresh();
    this.panelTimer = setInterval(refresh, PANEL_REFRESH_MS);
    if (this.panelTimer.unref) this.panelTimer.unref();
    return true;
  }

  stopPanel() {
    this.panelOn = false;
    if (this.panelTimer) clearInterval(this.panelTimer);
    this.panelTimer = null;
    const ctx = this.panelCtx;
    this.panelCtx = null;
    try {
      ctx.ui.setWidget('godview', undefined);
      if (ctx.ui.setStatus) ctx.ui.setStatus('godview', undefined);
    } catch {}
  }

  togglePanel(ctx) {
    if (this.panelOn) {
      this.stopPanel();
      return false;
    }
    return this.startPanel(ctx);
  }
}
