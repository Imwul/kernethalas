/**
 * Writes scripts/.overlay-manifest.json (table ids, page numbers, ranges, creature action names,
 * rule entry titles and pages, Mastery ability names). Contains no book text.
 * Consumed by scripts/extract_overlay.py.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { entries, tables } from '../src/content';
import { creatures } from '../src/content/entries/creatures';
import { masteryCatalog } from '../src/content/entries/masteries';

it('writes overlay manifest', () => {
  const m = {
    tables: tables
      .filter((t) => t.dice !== '—')
      .map((t) => ({ id: t.id, en: t.en, dice: t.dice, pages: t.source.find((s) => s.book === 'core')?.pages ?? [], rows: t.rows.map((r) => [r.min, r.max]) })),
    creatures: creatures.map((c) => ({ id: c.id, name: c.name, pages: [c.page, c.statPage], actions: c.actions.map((a) => a.name) })),
    entries: entries
      .filter((e) => e.kind !== 'mastery' && e.kind !== 'creature')
      .map((e) => ({
        id: e.id, en: e.en, kind: e.kind,
        terms: e.aliases.filter((alias) => /^[\x20-\x7e]+$/.test(alias)),
        pages: e.source.find((s) => s.book === 'core')?.pages ?? [],
      })),
    masteries: masteryCatalog.map((m) => ({
      id: m.id, name: m.name, feature: m.feature.name, abilities: m.abilities.map((a) => a.name),
      page: (entries.find((e) => e.id === m.id)?.source.find((s) => s.book === 'core')?.pages ?? [])[0] ?? null,
    })),
  };
  writeFileSync(new URL('./.overlay-manifest.json', import.meta.url), JSON.stringify(m));
});
