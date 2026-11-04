# Parallel team board file format

The board keeps three concepts: **presence**, **claims**, and **changes**, stored on a per-repository project board. Messages are not part of it.

## Location

```text
<repo>/.dsh/parallel/
  config.json
  README.md
  .gitignore
  agents/<agent-id>.json
  claims/<sha1(repo-relative-path)>.json
  changes/<change-id>.json
```

`config.json` is also the board marker: a directory containing `.dsh/parallel` without it is not treated as a board (this keeps the global registry at `~/.dsh/parallel` from becoming a repository root).

The global recent-project index is separate:

```text
~/.dsh/parallel/projects.json   # { "projects": [{ "root", "name", "lastSeenAt" }] }
~/.dsh/parallel/state.json      # the coordination switch
```

A board is always repository-local. The index only lists roots; it never merges claims or history.

## Hosts

The file format is host-neutral. `dsh-godview` and `pi-godview` read and write the same board files, so a Pi session and a DSH session in one repository see each other. Agent IDs are opaque: DSH uses `dsh-<hash>`, Pi uses `pi-<hash>`. The DSH coordination switch governs the DSH host only; the Pi extension writes presence and leases while it is installed. Presence, claim, change, and registry shapes are otherwise identical.

## Presence: agents/<id>.json

```json
{
  "id": "dsh-demo-agent",
  "name": "parallel builder",
  "sessionId": "session-demo-0001",
  "sessionTitle": "DSH 多 agent 协作插件设计",
  "parentId": null,
  "role": "agent",
  "status": "active | idle | blocked | done",
  "focus": "one line about the current work",
  "lastAction": "edit packages/godview/lib/store.js",
  "plan": "",
  "files": [],
  "branch": null,
  "pid": 12345,
  "hostname": "macbook.local",
  "cwd": "/abs/repo",
  "startedAt": 1793280396000,
  "updatedAt": 1793280396000,
  "heartbeatAt": 1793280396000,
  "ttlMs": 90000,
  "expiresAt": 1793280486000
}
```

`lastAction` and `files` (most recent first, capped) describe the session's latest tool use (the Pi adapter records lifecycle events such as prompt, idle, and the stop reason instead of tool calls); `finishedAt` is set once the status becomes `done`, `pid`/`hostname`/`cwd` identify the writing process. All are advisory except `status`.

Focus is a current property, not a message. It has no reply state. Heartbeats renew it while the agent is tracked; stale presence is flagged, hidden from the panel's session list, and omitted from team_roster unless `include_stale` is true. `heartbeatAt` + `ttlMs` prove only that the host process is alive; `updatedAt` is the last real activity (a user/subagent prompt, a turn change, a tool result, or team_status). The heartbeat is never treated as activity. `done` is the wire state for a closed session; the panel hides done sessions, the CLI displays them as `ended`, and team_roster omits them.

## Claims and changes

Claim file:

```json
{
  "path": "packages/godview/lib/store.js",
  "agent": "dsh-demo-agent",
  "agentName": "parallel builder",
  "changeId": "ch-mvtntlri-ebc66424",
  "sessionId": "session-demo-0001",
  "sessionTitle": "DSH 多 agent 协作插件设计",
  "mode": "edit | review",
  "auto": false,
  "intent": "timeline: claim/release observability",
  "reason": "timeline: claim/release observability",
  "createdAt": 1793280396000,
  "ttlMs": 1800000,
  "expiresAt": 1793282196000,
  "renewedAt": 1793281296000
}
```

`reason` duplicates the intent for readers that only look at a claim file, and `renewedAt` is stamped by each renewal. Leases (auto and explicit) are renewed by the owning host's heartbeat while its session is running or blocked — a blocked session is still working and waiting to resume, so both hosts keep its leases alive; the TTL bounds leases whose owner is gone.

Leases also follow owner liveness (ADR 31). A lease a host session created — every auto lease, and any lease carrying a `sessionId` — is only as alive as its owner's presence: once that presence row stops beating past its TTL, the lease is abandoned. An abandoned lease is filtered from `listClaims` (pass `includeAbandoned: true` to inspect unswept files), denied by nobody, and takeable by the next claim; the takeover appends an expire event with the summary `owner presence gone` and closes the change as expired. A lease made through the CLI without a session has no owner process to track and keeps its plain TTL, so a human reservation cannot be bulldozed by a stale presence row. Caution: `godview join --session` derives a DSH agent id and stamps `sessionId` onto its claims, which makes them correlated — with no live DSH host beating that presence row, such a lease is abandoned about one presence TTL (~90s) after it is made. Use a plain `join` (no `--session`) for standalone human reservations.

`mode` is an annotation, not a permission level: an `edit` lease and a `review` lease both deny other agents' writes, and neither restricts the owner. Paths are compared exactly and case-sensitively: on a case-insensitive filesystem two spellings of one file (`README.md` / `readme.md`) are two independent leases, and the guard does not catch the collision.

Change file:

```json
{
  "id": "ch-mvtntlri-ebc66424",
  "agent": "dsh-demo-agent",
  "agentName": "parallel builder",
  "sessionId": "session-demo-0001",
  "sessionTitle": "DSH 多 agent 协作插件设计",
  "intent": "timeline: claim/release observability",
  "paths": ["packages/dsh-godview/lib/client.js", "packages/godview/lib/store.js"],
  "state": "claimed | done | expired",
  "auto": false,
  "summary": "turn ended | released | lease expired | ...",
  "createdAt": 1793280396000,
  "updatedAt": 1793280399000,
  "releasedAt": null,
  "timeline": [
    {
      "type": "claim",
      "at": 1793280396000,
      "agent": "dsh-demo-agent",
      "agentName": "parallel builder",
      "path": "packages/dsh-godview/lib/client.js",
      "intent": "timeline: claim/release observability",
      "auto": false
    },
    {
      "type": "release",
      "at": 1793280399000,
      "agent": "dsh-demo-agent",
      "agentName": "parallel builder",
      "path": "packages/dsh-godview/lib/client.js",
      "summary": "turn ended"
    }
  ]
}
```

Lifecycle:

- claim creates or extends the agent's active change and appends a claim event per path;
- release removes the lease and appends a release event; when no leases remain, the change becomes done with the release summary. The CLI displays `done` as `released`; the panel shows the timeline and summary, not a state label. It only means the leases were released, not that the work was committed;
- auto release on idle uses the summary `turn ended` on the DSH host and `idle` on the Pi adapter; other summaries the hosts write include `status done`, `status idle`, `session closed`, `host stopped`, `coordination disabled`, and the CLI's `agent left`;
- expired leases are removed and append an expire event; when no leases remain, the change becomes expired. A lease that expired unswept (its owner gone) and is then taken over by another agent is recorded the same way, so no change keeps an open claim forever. The weekly prune sweep records the expire event too when it is what removes an unswept lease, so no path off the board is silent. A lease re-claimed by its own agent is a renewal and keeps its original createdAt;
- a lease abandoned by its dead owner is swept the same way by any host's expiry pass and by takeovers, with summary owner presence gone;
- one active change per agent; a new claim joins it unless it was released.

Release accepts a summary. Expiry uses lease expired, an abandoned takeover uses owner presence gone. A forced cross-agent release (`--force`) keeps the event attributed to the lease owner — the Gantt colors bars by owner — and appends ` (forced by <actor>)` to the summary, so the timeline never reads as if the owner had released it themselves. The timeline is capped at 200 events per change.

## Coordination switch

Coordination is on by default. The switch is a single global file, `state.json` in the registry directory:

```json
{ "enabled": true, "updatedAt": 1793280396000, "updatedAtIso": "2026-10-30T07:26:36.000Z" }
```

- **On (default, or file missing/unreadable):** presence, leases, the guard, the timeline, the prompt context, and the three `team_*` tools apply as documented below.
- **Off (`enabled: false`):** the host writes no board state. It creates no `.dsh/parallel`, no presence, no leases, no changes, and no prompt context, and it disposes the three `team_*` tools, so the model's catalog carries no team tool schema. The write guard allows everything. A call admitted before the flip (a stale tool reference) still returns the off notice instead of an unknown-tool error. Only in-memory session tracking, the project registry, and the panel entry continue, so the panel can still discover repositories and offer the switch; the rail itself lists only boards with a working/blocked session, a live lease, or activity within 30 minutes (ADR 11 and ADR 16).
- Turning it off releases the automatic leases this host holds; recorded history stays readable but frozen. Explicit leases stay with their owner until released or expired. Turning it back on backfills presence for tracked sessions and re-registers the tools.
- A host notices a flip made by another process (or by another machine sharing the registry) on its next coordination check: its heartbeat, a write/edit, a team tool call, or `GET /coordination`. It releases its own auto leases on the off transition, the tool catalog follows within one heartbeat, and the panel POST is immediate.
- The switch never flips itself. A host that sees several sessions while off keeps that count internally and does not warn in the panel (ADR 18).
- The switch governs the DSH host. The CLI writes the same board files directly and does not consult the switch, so a claim made through the CLI is visible to every host even while the switch is off. The Pi adapter does not read this switch; it coordinates while the extension is installed.

## Write guard

Step 0: the guard only runs while the coordination switch is on.

1. resolve the write/edit target against the session cwd, then the repository root;
2. deny if a live lease belongs to another agent — live means both unexpired and owned by a session whose presence still beats; an abandoned lease is takeable instead;
3. otherwise create an auto lease in the current change;
4. release auto leases on idle; release all leases when the session is disposed, or when the host itself stops.

`team_claim` paths are different: they are always resolved against the repository root, even when the session was started in a subdirectory. Only the write/edit guard starts from the session cwd.

There is one guard policy, and it covers every tool whose structured arguments name a file: on the DSH host that is `write`, `edit`, `multi_edit`, `create_file`, and `apply_patch` (whose source and move-destination targets are parsed out of the patch text; an unrecognized patch format parses to no targets and passes through unguarded rather than being denied on a guess). On the Pi adapter it is `write` and `edit`, read through the `path`/`file_path`/`paths[0]` argument spellings, with native `path` taking precedence over aliases when several are present. Matching writes are auto-claimed and live conflicts are denied; the panel and the agents' prompt context always show the current leases. Shell edits (`bash`, `run_code`) are outside the guard.

The guard fails open: if recording the lease itself fails (for example the board directory cannot be written), the write is allowed and the host logs a warning. Coordination never blocks work because its own bookkeeping broke.

## Agent-facing reports

Both hosts render what a session is told about its peers from one shared module (`godview/report`), so the two hosts cannot drift apart. Two rules carry the precision contract (ADR 31):

- **Unprompted views are the collision view.** The prompt context and `team_status` list only peers that could actually collide: working or blocked, with live presence. An idle session has released its auto leases and cannot conflict, so it is omitted there; ended and stale sessions never appear. Leases listed as "claimed by others" always have a live owner, because abandoned leases are filtered at the store.
- **The roster is the explicit full read.** `team_roster` still lists idle sessions (marked as such) and stale ones on request — the reader asked for the whole board, not the collision view.

`team_claim list` answers with the lease table only, in both hosts.

## Project registry

Each host writes a global index entry when it tracks a root:

```json
{ "projects": [{ "root": "/abs/repo", "name": "repo", "lastSeenAt": 1793280396000 }] }
```

GET /projects reads the union of the host's known roots and this index, then computes a summary from each board:

```json
{
  "root": "/abs/repo",
  "name": "repo",
  "agents": 2,
  "active": 1,
  "working": 1,
  "blocked": 0,
  "claims": 2,
  "changes": 1,
  "lastActivityAt": 1793280399000,
  "lastSeenAt": 1793280396000,
  "status": "active | claimed | idle",
  "lastSummary": "timeline: claim/release observability"
}
```

`active` is the number of live non-stale sessions that are not done, including idle ones; it is a session count, not a "working now" count. `working` counts sessions with status `active`, and `blocked` counts status `blocked`. `claims` is the number of live leases (unexpired, owner alive), and `changes` is the number of changes still in the `claimed` state — in-progress changes, not the whole history. `lastActivityAt` is the newest `updatedAt`, claim timestamp, or change timestamp. It is never a heartbeat. A project's `status` is `active` when a session is working or blocked; it is `claimed` when no session is working or blocked but live leases remain; otherwise it is `active` when `lastActivityAt` is within 30 minutes (`ACTIVE_WINDOW_MS`) and `idle` beyond that. Projects are sorted by last activity. Selecting a project only changes which board is read.

## HTTP surface

| Method | Path              | Body    | Result                          |
| ------ | ----------------- | ------- | ------------------------------- |
| GET    | /health           | -       | ok, pid, current root           |
| GET    | /projects         | -       | recent projects and status      |
| GET    | /state?root=<abs> | -       | agents, claims, changes, stats  |
| GET    | /coordination     | -       | enabled, trackedSessions, roots |
| POST   | /coordination     | enabled | flip the switch                 |

All routes live under the fixed prefix `/plugins/dsh-godview/api` — the same constant the client hardcodes; it is deliberately not configurable. `GET /` serves the same snapshot as `/state`.

/state also returns `coordination: { enabled, trackedSessions, roots }`. It returns the 30 most recent changes plus every change still in the `claimed` state (that merge is capped at 200), so an old lease keeps its Gantt bar. A POST body must be sent as `application/json`; any other content type is rejected before parsing.

The panel itself sends no board writes: reads serve the panel, and POST /coordination is the only write route. Serving a board through /state registers its root with the host, whose background heartbeat sweep may then clear that board's expired leases and close their changes — the same maintenance it runs for boards it tracks. The host writes through the store directly and the CLI uses the same files. Cross-origin requests are denied.

## Compatibility

- Existing boards may carry fields the board no longer writes, such as an old message queue. Unknown fields are ignored, and old message directories can be deleted.
- Presence, claim, and change files remain valid. Missing timeline arrays are synthesized from createdAt/releasedAt.
