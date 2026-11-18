import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The local source overlay holds the rulebook's original wording. It is only for the owner's
 * own machine: `vite dev` uses it, but production builds swap it for an empty stub unless
 * LOCAL_SOURCE=1 is set explicitly (never do that for a public deploy).
 */
function stripLocalSource(): Plugin {
  let keep = false;
  return {
    name: 'strip-local-source',
    configResolved(c) {
      keep = c.command === 'serve' || process.env.LOCAL_SOURCE === '1';
    },
    load(id) {
      if (!keep && id.replace(/\\/g, '/').endsWith('/src/local/source-overlay.json')) return 'null';
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), stripLocalSource()],
  test: { environment: 'node' },
} as never);
