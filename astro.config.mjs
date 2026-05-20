import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://ansgar.theglasshaus.org',
  output: 'hybrid',
  adapter: node({
    mode: 'standalone',
  }),
});
