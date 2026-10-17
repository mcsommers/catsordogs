import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://catsordogs.net';

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site,
  integrations: [sitemap()],
  compressHTML: true,
  server: {
    // Listen on IPv4 so http://127.0.0.1:4321 works (Astro/Vite default is often IPv6-only localhost).
    host: '127.0.0.1',
    port: 4321,
  },
  build: {
    inlineStylesheets: 'auto',
  },
});
