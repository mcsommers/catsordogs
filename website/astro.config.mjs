import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const site =
  process.env.PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://catsordogs.com';

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site,
  integrations: [sitemap()],
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
