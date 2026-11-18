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

/**
 * After the build, write one HTML file per route (dist/ref/prone.html …) carrying that page's
 * title, description and link-preview tags. The SPA still boots from the same assets; the files
 * only make shared links and search results show the right page. Served via cleanUrls on Vercel.
 */
function prerenderMeta(): Plugin {
  let outDir = 'dist';
  return {
    name: 'prerender-meta',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    async closeBundle() {
      const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs');
      const { dirname, join } = await import('node:path');
      const { pageMeta, allRoutes, SITE_URL, SITE_NAME } = await import('./src/lib/meta');
      const base = readFileSync(join(outDir, 'index.html'), 'utf8');
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      const render = (path: string) => {
        const m = pageMeta(path);
        const url = SITE_URL + (path === '/' ? '/' : path);
        const tags = [
          `<link rel="canonical" href="${url}" />`,
          `<meta property="og:type" content="website" />`,
          `<meta property="og:site_name" content="${SITE_NAME}" />`,
          `<meta property="og:title" content="${esc(m.title)}" />`,
          `<meta property="og:description" content="${esc(m.description)}" />`,
          `<meta property="og:url" content="${url}" />`,
          `<meta property="og:image" content="${SITE_URL}/og.png" />`,
          `<meta property="og:image:width" content="1200" />`,
          `<meta property="og:image:height" content="630" />`,
          `<meta property="og:locale" content="ko_KR" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
        ].join('\n    ');
        return base
          .replace(/<title>[^<]*<\/title>/, `<title>${esc(m.title)}</title>`)
          .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(m.description)}" />\n    ${tags}`);
      };
      const routes = allRoutes();
      for (const path of routes) {
        const file = path === '/' ? join(outDir, 'index.html') : join(outDir, `${path.slice(1)}.html`);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, render(path));
      }
      this.info?.(`prerendered meta for ${routes.length} routes`);
    },
  };
}

export default defineConfig({
  plugins: [react(), stripLocalSource(), prerenderMeta()],
  test: { environment: 'node' },
} as never);
