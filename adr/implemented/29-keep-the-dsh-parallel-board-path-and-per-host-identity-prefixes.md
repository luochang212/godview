---
status: implemented
date: 2026-11-03
description: Keep the historical .dsh/parallel board directory name in the
  host-neutral core, and keep agent-id prefixes in the adapters instead of the
  core API.
raised-by: agent
decided-by: human
created: 2026-11-03
commit: "6953123"
paths:
  - packages/godview/lib/store.js
  - packages/godview/bin/godview.mjs
  - packages/dsh-godview/lib/index.js
  - packages/dsh-godview/test/host-smoke.mjs
  - docs/protocol.md
---

# ADR: 29 keep the dsh parallel board path and per-host identity prefixes

## Problem

The core package is host-neutral: it must not import DSH, Cordis, or Pi, and
both adapters read and write the same board. Two DSH-branded leftovers sat
inside that core anyway:

- `STORE_DIR` hardcodes the board path as `<repo>/.dsh/parallel/`, so a
  repository touched only by Pi sessions still grows a `.dsh` directory;
- the exported `agentIdForSession()` hardcodes the `dsh-` agent-id prefix,
  while the Pi adapter derives its own `pi-` ids next to it.

The prefix leak is a genuine layering defect. The directory name is not: it is
the documented on-disk contract (docs/protocol.md), and the global registry at
`~/.dsh/parallel` shares it. Renaming the directory would orphan every existing
board and force a migration with no payoff — the name is invisible to agents,
who only see the panel, the tools, and the CLI.

## Decision

The board path stays `<repo>/.dsh/parallel/` (and the registry stays
`~/.dsh/parallel/`), accepted as a historical name that the host-neutral core
carries on disk. It is not an invitation to add further DSH-branded names to
the core.

Identity prefixes belong to hosts, not to the core store: the core keeps only
neutral primitives (`hash`, `safeId`) and accepts agent ids as opaque input.
`agentIdForSession()` moves out of `packages/godview/lib/store.js` into the DSH
adapter, which keeps deriving `dsh-<hash>` exactly as before. The Pi adapter
already derived `pi-<hash>` on its own. The CLI's `join --session` keeps
deriving the same `dsh-<hash>` id locally, because joining a board with a
session id must produce the same identity the DSH host would give that session
— the CLI emulates a DSH session by design, and changing its prefix would
split one session into two presence rows.

## Alternatives considered

- **Rename the board directory to `.godview/parallel/`.** Rejected: it breaks
  every existing board and the shared registry layout for no functional gain,
  and it would fork the board format from the one documented since the project
  was a single DSH plugin. Git is the only version (ADR 23); a silent
  on-disk rename is exactly the kind of incompatible drift it exists to avoid.
- **Make the prefix a core option** (`agentIdForSession(sessionId, prefix)`).
  Rejected: it turns a two-adapter convention into a core configuration knob
  nobody configures. The prefix is one string per adapter; each adapter can
  own its one line.
- **Give the CLI a `cli-` prefix.** Rejected: `join --session` is the CLI
  acting as a DSH session, so its identity must match what the DSH host would
  derive for that session. A distinct prefix would make the same session
  appear twice on one board.

## Consequences

The core's public API loses `agentIdForSession`; both packages version together
(ADR 25) and nothing was published, so no deprecation shim is needed. The DSH
adapter exports the helper itself, and the host smoke test imports it from the
adapter. A repository worked on only through Pi keeps its `.dsh/parallel`
directory name; the panel, the tools, and the CLI never surface it. Reviewers
reading the core can now take "host-neutral" literally, with one named
exception: the on-disk path this record accepts.
