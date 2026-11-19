# Ossuary Index — Ker Nethalas: Gravebound Edition

An unofficial play-time reference for *Ker Nethalas: Into the Midnight Throne — Gravebound Edition v1.2*:
rules index, official oracle tables, procedure atlas, quick rulings, and a workbench for comparing rules side by side.

It is a **reference companion** for a paper character sheet and journal. Choose when to advance a procedure
or roll a die.

**Play mode** (`/play`) brings the current location's exploration, encounters, combat, and wrap-up into one screen.
Enter dice you rolled at the table or roll in the app. Review the changes to mark on paper, copy a journal line,
and carry the Tension Die into the next location. The current location and domain effects recover within the browser tab.
Named custom encounter tables are saved on the device and can be shared as JSON files.

## Commands

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # content validation + dice + search tests
npm run e2e          # browser tests on the production build (layout 360/768/1280/3440, search, roller, offline)
npm run build        # validates content first, then builds dist/
npm run overlay      # optional: original wording from YOUR PDF, local only (see below)
```

Live: https://ker-nethalas-ossuary.vercel.app (Vercel project `ker-nethalas-ossuary`).

`npm run deploy` runs the unit and browser tests, builds, stages **only** `dist/` into `.deploy/` (git-ignored, linked to the Vercel project) and publishes to production. Never deploy the project folder itself: it holds the rulebook PDFs and the local overlay. `vercel.json` rewrites all paths to `index.html` so every rule has a shareable URL.

## Layout of the code

| Path | What it holds |
| --- | --- |
| `src/content/schema.ts` | Data model: entries, oracle tables, procedures, rulings, relations, verification state |
| `src/content/entries/*` | Rule entries (Korean summaries, English terms, aliases, page refs) |
| `src/content/tables/*` | Oracle and lookup tables (ranges, results, follow-up links) |
| `src/content/procedures.ts` | Procedure graphs (nodes on a grid, labelled edges, required/conditional/optional) |
| `src/content/rulings.ts` | Quick rulings with comparison matrices |
| `src/content/generated/creatures.json` | Creature stats, action names and tags (numbers only) |
| `src/lib/dice.ts` | Independent dice engine and the verified check/opposed/attack readers |
| `src/lib/search.ts` | Bilingual search (Korean/English, Hangul initials, typo tolerance) |
| `src/lib/store.ts` | Navigation-only local storage: Pins, Recent, open Workbench panes, theme |
| `tests/content.test.ts` | Integrity checks run before every build |

## Editing content

Fix a fact once in `src/content/**` and every screen that shows it updates. `npm test` will catch:
duplicate IDs, links to IDs that do not exist, table ranges with gaps or overlaps or not ending at the die maximum,
bad dice expressions, unfilled table columns, procedure nodes that are unreachable or share a grid cell,
creature action tables that do not cover their die, entries without a source page, and discrepancy flags without an explanation.

Relations carry a strength (`required` / `conditional` / `optional`) and a basis. Use `basis: 'source'` only when the book itself
links the two topics; anything else must be `ed(...)` (editorial), which the UI labels separately.

## Copyright

The Gravebound Edition (p.4) allows free use of its mechanics but reserves its wording and forbids copying or translating the text.
So every Korean sentence here is an original summary of mechanics. Creature actions ship as name, range and Physical/Magical tag only;
flavor tables (room/corridor descriptions, magic item peculiarities) ship as numbers and page pointers only. No art is included.

`npm run overlay` reads your own PDF (default `./KerNethalas-Corebook.pdf`, or `npm run overlay --pdf=/path/to/book.pdf`)
and writes `src/local/source-overlay.json`, which shows the original English next to each summary **in the dev server only**.
That file is git-ignored, and production builds replace it with an empty stub unless `LOCAL_SOURCE=1` is set. Never deploy with that flag.

## Status

See the in-app **Sources & Coverage** page (`/sources`) for live counts by verification state and the list of flagged entries.

## Offline & sharing

- Production builds ship a service worker (generated in `vite.config.ts`). After one online visit the whole reference works without a connection; Google Fonts are cached as they are used. It can be added to the phone home screen (`public/manifest.webmanifest`).
- Every rule, table and procedure gets its own static HTML (`dist/ref/<id>.html` …) with its title, summary and a preview image (`public/og.png`), so shared links show the right page. Titles and descriptions come from `src/lib/meta.ts`.
