---
status: implemented
date: 2026-11-03
description: A host session's lease dies with its presence, and the unprompted reports list only working/blocked peers; both hosts render from one shared report module.
raised-by: human
decided-by: human
created: 2026-11-03
---

# ADR: 31 let leases and reports follow owner liveness

## Problem

The board told a running session about sessions that no longer exist. Two verified leaks:

- A finished conversation in an open DSH window stays `idle` and its row keeps beating, so every other session's prompt context listed it forever with a stale focus line.
- Worse: a crashed or killed host stopped heartbeating, so its presence rows went stale and were filtered within one TTL — but its leases did not follow. `getClaim`/`listClaims` looked only at `expiresAt`, so a dead session's auto lease kept denying writes for the full claim TTL (10 minutes by default, up to 4 hours explicit) and kept appearing as "files claimed by others" in prompts and rosters.

Separately, the agent-facing rendering lived twice, once per host, and had already drifted: Pi's `team_claim list` returned the whole roster where DSH returned the lease table, focus was truncated at 240 characters in Pi and 500 in DSH, and the conflict denial differed by one word.

## Decision

Leases follow owner liveness, and reports follow the same rule.

1. A lease a host session created — every auto lease, and any lease carrying a `sessionId` — is only as alive as its owner's presence row. When that row stops beating past its TTL, the lease is **abandoned**: the store filters it from `listClaims` (opt-out flag for inspection), `getClaim` no longer serves it to the guards, the next claim takes it over through the existing exclusive-create path, and the takeover appends an expire event with the summary `owner presence gone`. `expireClaims` sweeps abandoned leases the same way it sweeps expired ones, so no change stays open behind a dead session.
2. A lease made through the CLI without a session keeps its plain TTL. It has no owner process to track, and correlating it would let a stale presence row bulldoze a human's explicit reservation.
3. The unprompted views — the prompt context and `team_status` — list only peers that could actually collide: working or blocked, with live presence. An idle session has released its auto leases and cannot conflict; ended and stale sessions never appear. The roster stays the explicit full read: idle sessions marked as such, stale ones on request.
4. Both hosts render these views from one shared module, `godview/report`: the collision view (`activePeers`/`claimsByOthers`), the roster renderer, and the one conflict-denial text. The hosts keep only their transport — DSH the prompt-context hook and HTTP panel, Pi the tools and TUI widget.

## Alternatives considered

- Correlate every lease with owner liveness, CLI leases included. Rejected: a CLI `godview claim` has no heartbeat after the shell exits, so the rule would silently break human reservations 90 seconds after they were made. The `sessionId` marker is the honest line between "a session renewed this" and "someone reserved this".
- Treat only expired leases as dead and extend the auto-claim TTL instead. Rejected: it leaves the dead-session denial window at whatever the TTL is, which is exactly the imprecision this decision removes.
- Drop idle peers everywhere, roster included. Rejected: the roster is an explicit read — the model asked who is around, and an idle session with an explicit lease is real information. The precision contract governs what is injected unprompted.
- Keep per-host rendering and just align the constants. Rejected: the drift already happened with two adapters; the third adapter would copy it again. The report policy is one decision, so it lives in one module.

## Consequences

- A crashed session stops blocking others within one presence TTL (~90s) instead of one claim TTL (10 minutes to 4 hours). The cost: a live host stalled longer than its presence TTL can have its auto leases taken over — that is the same contract the presence row already advertises, and the takeover records the event so the timeline shows what happened.
- The prompt context got shorter and stops listing idle windows; sessions that want the full picture call `team_roster`.
- DSH `stop()` now closes its tracked sessions out (done + release all) the way Pi's stop always has, so a clean quit does not masquerade as a crash.
- The report wording is testable once, in the core, instead of being pinned separately in each host.
