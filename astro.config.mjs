import { defineConfig } from 'astro/config';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://ansgar.theglasshaus.org',
  output: "hybrid",
  adapter: cloudflare()
});