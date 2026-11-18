/**
 * Writes scripts/.overlay-manifest.json (table ids, page numbers, ranges, creature action names).
 * Contains no book text. Consumed by scripts/extract_overlay.py.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { tables } from '../src/content';
import { creatures } from '../src/content/entries/creatures';

it('writes overlay manifest', () => {
  const m = {
    tables: tables
      .filter((t) => t.dice !== '—')
      .map((t) => ({ id: t.id, en: t.en, dice: t.dice, pages: t.source.find((s) => s.book === 'core')?.pages ?? [], rows: t.rows.map((r) => [r.min, r.max]) })),
    creatures: creatures.map((c) => ({ id: c.id, name: c.name, pages: [c.page, c.statPage], actions: c.actions.map((a) => a.name) })),
  };
  writeFileSync(new URL('./.overlay-manifest.json', import.meta.url), JSON.stringify(m));
});
