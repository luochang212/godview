/**
 * godview board report: the read-side policy for what a session is told about
 * its peers. Both adapters render the prompt context, team_status, team_roster,
 * and the conflict denial from this module, so the two hosts cannot drift apart
 * the way they did before (one host truncated focus at 240 characters, the
 * other at 500; one listed idle peers, the other did not).
 *
 * Two rules carry the precision contract (ADR 31):
 *  - Unprompted views (the prompt context, team_status) list only peers that
 *    could actually collide: working or blocked, with live presence. An idle
 *    session has released its auto leases and cannot conflict; it stays
 *    visible in the roster, which a session reads explicitly.
 *  - Leases follow owner liveness: the store already filters leases whose
 *    owner stopped beating, so a dead session's files never appear as claimed.
 */
import path from 'node:path';
import * as S from './store.js';

export function boardName(root) {
  try {
    return path.basename(root) || root;
  } catch {
    return root;
  }
}

export function oneLine(value, max = 180) {
  const text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)) + '...';
}

export function ago(ms) {
  if (!ms) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return seconds + 's';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + 'm';
  return Math.floor(minutes / 60) + 'h';
}

/**
 * Peers a running session hears about unprompted. Blocked counts as working:
 * a blocked session still holds its leases and is waiting to resume.
 */
export function activePeers(root, selfId) {
  return S.listAgents(root, { includeStale: false }).filter(
    (agent) => agent.id !== selfId && (agent.status === 'active' || agent.status === 'blocked'),
  );
}

export function claimsByOthers(root, selfId) {
  return S.listClaims(root).filter((claim) => claim.agent !== selfId);
}

export function peerLines(peers, max) {
  const shown = peers.slice(0, max);
  const lines = shown.map(
    (peer) =>
      '- ' +
      peer.name +
      ' [' +
      peer.status +
      '] ' +
      oneLine(peer.focus || peer.lastAction || '(no focus)', 160) +
      ' (id=' +
      peer.id +
      ', seen ' +
      ago(peer.heartbeatAt) +
      ' ago)',
  );
  if (peers.length > shown.length) lines.push('- +' + (peers.length - shown.length) + ' more; call team_roster.');
  return lines;
}

/**
 * The one conflict message, word for word, from both hosts' write guards.
 */
export function claimDenialText(claim, rel) {
  const until = claim.expiresAt ? new Date(claim.expiresAt).toISOString() : 'soon';
  return (
    'File lease conflict: ' +
    rel +
    ' is claimed by ' +
    (claim.agentName || claim.agent) +
    ' (' +
    claim.mode +
    (claim.auto ? ', auto' : '') +
    ') until ' +
    until +
    '. Do not edit it concurrently; wait for the lease to be released or expire, or coordinate through team_claim and team_status.'
  );
}

/**
 * The full explicit read behind team_roster. Idle sessions and, on request,
 * stale ones appear here — the reader asked for the whole board, not the
 * collision view.
 */
export function renderRoster(root, selfId, options = {}) {
  const includeStale = options.includeStale === true;
  const agents = S.listAgents(root, { includeStale }).filter((agent) => agent.status !== 'done');
  const claims = S.listClaims(root);
  const live = agents.filter((agent) => !agent.stale);
  const running = live.filter((agent) => agent.status === 'active' || agent.status === 'blocked').length;
  const lines = ['# Parallel team - ' + boardName(root) + ' (' + root + ')'];
  lines.push('Sessions: ' + agents.length + ' listed, ' + live.length + ' live, ' + running + ' running/waiting.');
  for (const agent of agents) {
    const state = agent.stale ? 'stale' : agent.status;
    lines.push(
      '- ' +
        agent.name +
        ' [' +
        state +
        '] id=' +
        agent.id +
        ' - ' +
        oneLine(agent.focus || agent.lastAction || 'no focus', 220) +
        ' (seen ' +
        ago(agent.heartbeatAt) +
        ' ago' +
        (agent.branch ? ', branch ' + agent.branch : '') +
        ')',
    );
  }
  if (claims.length) {
    lines.push('Claims:');
    for (const claim of claims)
      lines.push(
        '- ' +
          claim.path +
          ' - ' +
          claim.agentName +
          ' (' +
          claim.mode +
          ', ' +
          Math.ceil(claim.remainingMs / 60000) +
          'm left)',
      );
  }
  const activeChanges = S.listChanges(root, { state: 'claimed', limit: 10 });
  if (activeChanges.length) {
    lines.push('Active changes:');
    for (const change of activeChanges) {
      lines.push(
        '- [' +
          change.agentName +
          '] ' +
          oneLine(change.intent, 160) +
          ' - ' +
          change.paths.join(', ') +
          ' (session ' +
          String(change.sessionId || 'cli').slice(0, 8) +
          ')',
      );
    }
  }
  const recentChanges = S.listChanges(root, { limit: 12 })
    .filter((change) => change.state !== 'claimed')
    .slice(0, 6);
  if (recentChanges.length) {
    lines.push('Recent changes:');
    for (const change of recentChanges) {
      lines.push(
        '- [' +
          change.state +
          '] ' +
          change.agentName +
          ': ' +
          oneLine(change.intent, 140) +
          ' - ' +
          change.paths.join(', ') +
          (change.summary ? ' (' + change.summary + ')' : ''),
      );
    }
  }
  return lines.join('\n');
}
