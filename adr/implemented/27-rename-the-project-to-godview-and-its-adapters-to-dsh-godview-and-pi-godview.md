---
status: implemented
date: 2026-11-02
description: Rename the repository and the adapter packages so the brand, the
  core package, and both adapter names all spell godview the same way.
raised-by: human
decided-by: human
created: 2026-11-02
commit: 14cd2b0
paths:
  - package.json
  - package-lock.json
  - .changeset/config.json
  - packages/dsh-godview/package.json
  - packages/dsh-godview/cordis.patch.yml
  - packages/dsh-godview/lib/index.js
  - packages/dsh-godview/lib/client.js
  - packages/pi-godview/package.json
  - packages/pi-godview/extensions/pi-godview.js
  - examples/cordis.patch.yml
  - site/astro.config.mjs
  - site/scripts/build-archive.mjs
  - README.md
  - README.en.md
  - AGENTS.md
  - docs/protocol.md
---

# ADR: 27 rename the project to godview and its adapters to dsh-godview and pi-godview

## Problem

The project started as a single DSH plugin called `dsh-god-view`, and the
repository was named after that adapter. ADR 25 then split a host-neutral core
(`godview`) out of the plugin, and ADR 26 added a second adapter for the Pi
coding agent. The project is now a board with a generic core and two adapters,
but its names still describe the first adapter: the repository is
`dsh-god-view`, and both adapters spell the product as `god-view` while the
core package spells it `godview`.

That split spelling is the concrete defect. Ecosystem convention keeps the
brand's own spelling inside a `<platform>-<brand>` name (`tailwindcss-animate`
follows `tailwindcss`, not `tailwind-css`), so `dsh-god-view` asserts a brand
of "god view" that no longer exists anywhere else.

## Decision

The brand is `godview`, spelled as one word everywhere. The repository is
`godview`; the three npm packages are `godview` (core), `dsh-godview` (DSH
adapter), and `pi-godview` (Pi adapter). Adapter names keep the platform-first
pattern and keep the brand intact.

The old names `dsh-god-view` and `pi-god-view` are abandoned, not aliased. They
were never published to a registry, so this rename ships no deprecation notice
and no compatibility package.

Names that derive from the package name move with it:

- the DSH plugin id and the HTTP route prefix become `dsh-godview` and
  `/plugins/dsh-godview/api`;
- the browser storage key for the rail becomes `dsh-godview:rail`;
- package `repository`/`homepage` URLs point at the `godview` repository;
- the ADR archive publishes at the Pages base path `/godview/`.

The copy on the panel itself does not change: the sidebar entry is still
上帝视角 / God's Eye, and the board is still a read-only coordination surface.

## Alternatives considered

- **Keep `dsh-god-view` and `pi-god-view`.** Rejected: those names encode a
  brand spelling the project no longer uses, and the repository they were named
  after is being renamed.
- **Use `godview-dsh` and `godview-pi`.** Rejected: it would be consistent, but
  it inverts the platform-first order every existing adapter name and doc uses,
  and buys nothing beyond the rename already required.
- **Publish the new names and deprecate the old ones.** Rejected: nothing was
  ever published under the old names, so deprecation would create a pointer to a
  package that never existed.
- **Alias the old directory paths while renaming the packages.** Rejected: two
  names for one workspace member is the exact drift this decision removes.

## Consequences

The rename is breaking for anyone already pointing a DSH profile at
`dsh-god-view`: the profile patch row and the `node_modules` link must both move
to `dsh-godview`, and the host must be restarted before the panel appears again.
A browser that had collapsed the rail reopens it once, because the storage key
changed. The ADR archive's old `/dsh-god-view/` URL stops resolving; GitHub
Pages does not redirect project paths.

The repository gains one spelling for one brand: the repository, the core
package, both adapters, the plugin id, and the published archive all agree.
Version numbers do not move: `0.1.0` was never published under the old names, so
the rename is a naming change, not a release.
