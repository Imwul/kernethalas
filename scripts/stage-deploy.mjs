// Stage ONLY the built site for Vercel: dist/ + routing config. Never the project folder,
// which holds the rulebook PDFs and the local original-text overlay.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const out = '.deploy';
const keep = new Set(['.vercel', 'vercel.json', '.vercelignore']);
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(`${out}/${f}`, { recursive: true, force: true });
cpSync('dist', out, { recursive: true });
writeFileSync(`${out}/.vercelignore`, '.env*\n.gitignore\n.vercel\n.DS_Store\n');
writeFileSync(
  `${out}/vercel.json`,
  JSON.stringify(
    {
      // /ref/prone → ref/prone.html (per-page titles and link previews); anything else → the SPA
      cleanUrls: true,
      rewrites: [{ source: '/(.*)', destination: '/' }], // with cleanUrls, /index.html itself redirects to /
      headers: [
        { source: '/assets/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
        // the offline worker must always be re-checked so new deploys reach installed copies
        { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      ],
    },
    null,
    2,
  ),
);
if (!existsSync(`${out}/.vercel`)) console.warn('No Vercel link in .deploy — run: cd .deploy && npx vercel link --project ker-nethalas-ossuary');
console.log('staged', readdirSync(out).join(', '));
