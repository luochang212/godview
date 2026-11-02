#!/usr/bin/env node
// Build the published ADR archive. Runs before "astro dev" and "astro build".
//
// The site is one thing: the adr-kit Signal (dark) atlas. Its Chinese edition is
// copied byte for byte to public/index.html so the Pages base path root serves
// the atlas itself; there is no landing page, no theme switch, and no second
// edition. The English chrome stays available next to it.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const siteRoot = resolve(here, '..');
const repoRoot = resolve(siteRoot, '..');
const publicDir = join(siteRoot, 'public');
const outDir = join(publicDir, 'decisions');
const cli = join(repoRoot, 'node_modules', 'adr-kit', 'bin', 'adrkit.js');

if (!existsSync(cli)) {
  throw new Error('adr-kit is not installed at the repository root; run npm ci there first.');
}

const atlasPages = [
  ['signal', 'zh'],
  ['signal', 'en'],
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const [theme, language] of atlasPages) {
  execFileSync(
    process.execPath,
    [
      cli,
      'atlas',
      '--format',
      'html',
      '--theme',
      theme,
      '--lang',
      language,
      '--out',
      join(outDir, theme + '.' + language + '.html'),
    ],
    { cwd: repoRoot, stdio: 'inherit' },
  );
}

copyFileSync(join(outDir, 'signal.zh.html'), join(publicDir, 'index.html'));
console.log('archive ready: signal.zh.html is index.html; signal.en.html sits beside it.');
