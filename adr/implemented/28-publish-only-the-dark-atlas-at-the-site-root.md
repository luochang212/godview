---
status: implemented
date: 2026-11-02
description: Read when changing what the published archive contains, the site
  build, or the Pages base path.
raised-by: human
decided-by: human
created: 2026-11-02
commit: 497f31c
paths:
  - site/**
  - .github/workflows/site.yml
  - AGENTS.md
---

# ADR: 28 publish only the dark atlas at the site root

## Problem

The published archive carried two editions of the same records and a landing
page that introduced the project before either of them. The landing page
restated the record index, the counts, and the colophon, and its main job was to
ask the reader to choose between a light Folio edition and a dark Signal
edition. Every record was therefore reachable only through a page that existed
to describe a choice nobody needed: the owner reads the dark edition, and the
site's whole purpose is to open it.

A second surface also means a second thing to keep in sync with the records.
The landing page read a generated JSON index of the frontmatter, so a record
that added a field or changed its heading could break the page independently of
the atlas.

## Decision

The published site is the adr-kit Signal (dark) atlas and nothing else.

`site/scripts/build-archive.mjs` generates `decisions/signal.zh.html` and
`decisions/signal.en.html`, then copies the Chinese atlas byte for byte to
`site/public/index.html`, so the Pages base path `/godview/` serves the atlas
itself. The copy is a copy: the published bytes are exactly what
`adrkit atlas --theme signal --lang zh` writes, and no wrapper, frame, or
injected chrome is added around it.

The landing page, its layout, its stylesheet, and the generated
`site/src/data/decisions.json` are deleted. `site/src` holds no pages.

Astro stays as the static build, but only as the static build: it copies
`public/` into `dist/` and emits the sitemap. It renders no page of its own.
The sitemap lists the two real URLs at the domain Pages serves
(`www.luochang.ink`), not the `github.io` alias.

The English chrome stays available at `/godview/decisions/signal.en.html`. It
is not linked from the atlas; it exists so an English reader is not forced into
Chinese UI chrome.

## Alternatives considered

**Keep the landing page and link the dark edition from it.** Rejected: that is
the architecture being removed. A page whose only content is a link into the
atlas is a hop, and every hop is a thing that can go stale.

**Serve the atlas at `/godview/signal/` and keep a redirect at the root.**
Rejected: it keeps two URLs where one is enough, and a redirect is exactly the
click-through this decision removes.

**Publish both editions and drop only the landing page.** Rejected: the owner
reads the dark edition. A light edition with no reader is maintenance without a
user.

**Drop Astro and write `site/dist` straight from the build script.** Rejected
for now: Astro still does the copying and the sitemap, the dependency tree and
the workflow stay untouched, and removing it would churn `site/package.json`
and its lockfile for no reader-visible gain.

## Consequences

- `/godview/` now opens the atlas directly. The `folio` pages and the old
  landing page are gone; a bookmark to either path 404s.
- The published record index and the counts are gone with the landing page. A
  reader navigates through the atlas's own directory, timeline, and map.
- One less surface to keep in sync with the records: nothing reads the
  frontmatter except adr-kit itself.
- `astro build` reports "0 page(s) built" and warns that `src/pages` is missing.
  That is the intended state, not a regression; the warning is Astro's, and the
  build still copies the atlas into `dist/`.
- `site/package.json` keeps its dependencies, including `yaml` and
  `@astrojs/sitemap`, which no script reads any more. They are harmless and
  removable once a lockfile can be regenerated.
