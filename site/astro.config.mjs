import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The site publishes the dark atlas only. There are no Astro pages: the build
// copies public/ (the generated atlas) to dist/, and the atlas itself is the
// page at the base path root.
export default defineConfig({
  site: 'https://www.luochang.ink',
  base: '/godview',
  output: 'static',
  integrations: [
    sitemap({
      customPages: ['https://www.luochang.ink/godview/', 'https://www.luochang.ink/godview/decisions/signal.en.html'],
    }),
  ],
  build: { format: 'directory' },
});
