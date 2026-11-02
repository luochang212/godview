---
status: implemented
date: 2026-11-03
description: Unpublish the abandoned dsh-god-view and pi-god-view packages so
  npm's name-similarity rule releases dsh-godview and pi-godview; correct the
  never-published premise of ADR 27.
raised-by: agent
decided-by: human
created: 2026-11-03
commit: 257354f
paths:
  - adr/implemented/27-rename-the-project-to-godview-and-its-adapters-to-dsh-godview-and-pi-godview.md
  - packages/dsh-godview/package.json
  - packages/pi-godview/package.json
---

# ADR: 30 unpublish the pre-rename packages to release the new names

## Problem

ADR 27 renamed the adapters to `dsh-godview` and `pi-godview` on the premise
that the old names "were never published to a registry". That premise was
wrong: `dsh-god-view@0.1.0`, `pi-god-view@0.1.0`, and `godview@0.1.0` had all
been published on 2026-11-01, the day before the rename was recorded.

The publication surfaced at the first release under the new names. npm's
name-similarity rule blocks a new package whose name is too close to an
existing one, regardless of ownership, so `dsh-godview` and `pi-godview` were
rejected with 403 while `godview@0.2.0` (not similar to anything) published.

## Decision

The two abandoned old-name packages are unpublished whole, which clears the
similarity block for the names ADR 27 chose. The packages qualify: each was
published within the 72-hour unpublish window, both are owned by this
project's maintainer, and neither has a dependent in the registry — they were
never documented, never depended on, and ADR 27 had already abandoned the
names.

`godview` is untouched: it is live, similar to nothing, and its 0.1.0 was a
real release of the pre-rename core. The core keeps its unscoped name; the
adapters keep theirs; ADR 27's choice stands unchanged. What changes is only
the factual record — ADR 27's "never published" claim is corrected here, not
by editing that record.

Registry artifact note: npm's 2FA browser publish flow stages a tarball as
`0.0.0-stage` before finalizing the real version. The two adapter packages
finalized cleanly and their staged versions were unpublished. `godview`'s
staged `0.0.0-stage` cannot be unpublished (the package now has dependents in
the registry) and is deprecated with a pointer to 0.2.0 instead. It is a
staging artifact of the publish flow, not a release.

## Alternatives considered

- **Scope the adapters** (`@luochang212/dsh-godview`). Rejected once the old
  packages could be removed: npm itself suggests scoping around the similarity
  rule, but scoping changes the consumer-facing names ADR 27 had just settled,
  splits the package family's style, and buys nothing once the block is gone.
- **Keep publishing under the old names.** Rejected: it reverses ADR 27 and
  reintroduces the split `god-view` spelling that record exists to remove.
- **Leave the old packages published.** Rejected: the new names would stay
  unpublishable forever, forcing either scoping or a third rename.

## Consequences

`godview`, `dsh-godview`, and `pi-godview` all publish under the names ADR 27
chose, and the registry no longer carries the abandoned spellings. The
unpublish is permanent — if a future adapter ever wanted `dsh-god-view` back,
it would need npm support. Deprecating, rather than unpublishing, the
`godview@0.0.0-stage` artifact leaves one visible but marked version in the
core package's history.

ADR 27's Problem section states the old names were never published; this
record corrects that. The rename itself was unaffected.
