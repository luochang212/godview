import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://luochang212.github.io',
  base: '/godview',
  output: 'static',
  integrations: [
    sitemap({
      customPages: [
        'https://luochang212.github.io/godview/decisions/folio.zh.html',
        'https://luochang212.github.io/godview/decisions/folio.en.html',
        'https://luochang212.github.io/godview/decisions/signal.zh.html',
        'https://luochang212.github.io/godview/decisions/signal.en.html',
      ],
    }),
  ],
  build: { format: 'directory' },
});
