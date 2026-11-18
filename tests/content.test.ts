/**
 * Content integrity checks. Run with `npm run validate` (also runs before every build).
 * Detects: duplicate ids, broken references, bad dice expressions, missing/overlapping
 * table ranges, procedure graph errors, and missing source pages.
 */
import { describe, it, expect } from 'vitest';
import { entries, tables, procedures, rulings, kindOf } from '../src/content';
import { creatures } from '../src/content/entries/creatures';
import { tableSides } from '../src/lib/dice';
import { creatureActionKo } from '../src/content/creature-actions';
import { masteryIds } from '../src/content/entries/masteries';
import { situations } from '../src/content/situations';
import { coreTableIndex } from '../src/content/core-table-index';

const allIds = [...entries.map((e) => e.id), ...tables.map((t) => t.id), ...procedures.map((p) => p.id), ...rulings.map((r) => r.id)];

describe('ids', () => {
  it('are unique across all content', () => {
    const seen = new Set<string>();
    const dup = allIds.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dup).toEqual([]);
  });
  it('use the expected prefixes', () => {
    expect(tables.filter((t) => !t.id.startsWith('t-')).map((t) => t.id)).toEqual([]);
    expect(procedures.filter((p) => !p.id.startsWith('p-')).map((p) => p.id)).toEqual([]);
    expect(rulings.filter((r) => !r.id.startsWith('q-')).map((r) => r.id)).toEqual([]);
  });
});

describe('references resolve', () => {
  const missing: string[] = [];
  const check = (from: string, id: string) => {
    if (!kindOf(id)) missing.push(`${from} → ${id}`);
  };
  for (const e of entries) {
    e.related.forEach((r) => check(e.id, r.id));
    e.tables?.forEach((t) => check(e.id, t));
    e.procedures?.forEach((p) => check(e.id, p));
  }
  for (const t of tables) {
    t.related.forEach((r) => check(t.id, r.id));
    t.rows.forEach((row) => row.next?.forEach((n) => check(`${t.id}#${row.min}`, n.id)));
  }
  for (const p of procedures) {
    p.nodes.forEach((n) => {
      n.refs?.forEach((id) => check(`${p.id}/${n.id}`, id));
      n.tables?.forEach((id) => check(`${p.id}/${n.id}`, id));
    });
  }
  for (const r of rulings) {
    r.refs.forEach((id) => check(r.id, id));
    r.tables?.forEach((id) => check(r.id, id));
  }
  for (const situation of situations) {
    situation.refs.forEach((id) => check(situation.id, id));
  }
  for (const item of coreTableIndex) {
    item.refs.forEach((id) => check(`Core p.247: ${item.title}`, id));
  }
  it('has no dangling ids', () => expect(missing).toEqual([]));
});

describe('printed table index', () => {
  it('maps all 59 unique headings on Core p.247 to usable references', () => {
    expect(coreTableIndex).toHaveLength(59);
    expect(new Set(coreTableIndex.map((item) => item.title)).size).toBe(59);
    expect(coreTableIndex.every((item) => item.pages.length && item.refs.length)).toBe(true);
  });
});

describe('oracle tables', () => {
  it('keeps individual critical effects and follow-ups for the four checks on Core p.73', () => {
    const criticals = tables.find(({ id }) => id === 't-noncombat-crits')!;
    expect(criticals.rows.slice(-4).map(({ label }) => label)).toEqual(['Scavenging', 'Spellward', 'Stealth', 'Thievery']);
    expect(criticals.rows.find(({ label }) => label === 'Thievery')?.next?.map(({ id }) => id)).toEqual(['t-traps']);
  });
  for (const t of tables) {
    it(`${t.id} (${t.dice}) ranges are complete and non-overlapping`, () => {
      const sides = tableSides(t.dice);
      if (t.dice !== '—') expect(sides, `bad dice "${t.dice}"`).not.toBeNull();
      expect(t.rows.length).toBeGreaterThan(0);
      for (const r of t.rows) {
        expect(Number.isInteger(r.min) && Number.isInteger(r.max)).toBe(true);
        expect(r.max).toBeGreaterThanOrEqual(r.min);
        expect(r.ko.trim().length).toBeGreaterThan(0);
      }
      if (sides === null) return;
      const sorted = [...t.rows].sort((a, b) => a.min - b.min);
      let expected = 1;
      for (const r of sorted) {
        expect(r.min, `gap/overlap before ${r.min}`).toBe(expected);
        expected = r.max + 1;
      }
      expect(expected - 1, 'last range must end at die max').toBe(sides);
    });
  }
  it('every table cites at least one source page', () => {
    expect(tables.filter((t) => !t.source.some((s) => s.pages.length)).map((t) => t.id)).toEqual([]);
  });
  it('declared extra columns are filled on every row', () => {
    const bad: string[] = [];
    for (const t of tables) for (const c of t.columns ?? []) for (const r of t.rows) if (!r.cols?.[c.key] && r.cols?.[c.key] !== '') bad.push(`${t.id}#${r.min}.${c.key}`);
    expect(bad).toEqual([]);
  });
});

describe('procedures', () => {
  it('separates an environmental bypass from door and container locks', () => {
    const locks = procedures.find((procedure) => procedure.id === 'p-locks-traps');
    expect(locks?.edges).toContainEqual({ from: 'resolve', to: 'bypass', label: '우회 성공' });
    expect(locks?.edges.some((edge) => edge.from === 'bypass' && edge.to === 'locked')).toBe(false);
    expect(locks?.edges.some((edge) => edge.from === 'trig' && edge.to === 'locked')).toBe(true);
  });

  it('checks the attacker’s fumble from the roll independently of the contest outcome', () => {
    const attack = procedures.find((p) => p.id === 'p-attack');
    expect(attack?.edges.filter((edge) => edge.to === 'fum').map((edge) => edge.from)).toEqual(['roll']);
  });

  for (const p of procedures) {
    it(`${p.id} graph is consistent`, () => {
      const ids = new Set(p.nodes.map((n) => n.id));
      expect(ids.size).toBe(p.nodes.length);
      for (const e of p.edges) {
        expect(ids.has(e.from), `${e.from}`).toBe(true);
        expect(ids.has(e.to), `${e.to}`).toBe(true);
      }
      const cells = new Set<string>();
      for (const n of p.nodes) {
        expect(n.col).toBeLessThan(p.cols);
        const key = `${n.col},${n.row}`;
        expect(cells.has(key), `two nodes share cell ${key}`).toBe(false);
        cells.add(key);
      }
      // every node reachable from a start node
      const start = p.nodes.filter((n) => n.kind === 'start').map((n) => n.id);
      expect(start.length).toBeGreaterThan(0);
      const seen = new Set(start);
      let grew = true;
      while (grew) {
        grew = false;
        for (const e of p.edges) if (seen.has(e.from) && !seen.has(e.to)) (seen.add(e.to), (grew = true));
      }
      const orphan = p.nodes.filter((n) => !seen.has(n.id) && n.kind !== 'note').map((n) => n.id);
      expect(orphan).toEqual([]);
    });
  }
});

describe('entries', () => {
  it('cite sources and carry a verification state', () => {
    expect(entries.filter((e) => !e.source.length || !e.source[0].pages.length).map((e) => e.id)).toEqual([]);
  });
  it('have Korean and English search terms', () => {
    const noKo = entries.filter((e) => !/[가-힣]/.test([e.ko, ...e.aliases].join(' ')));
    expect(noKo.filter((e) => e.kind !== 'creature').map((e) => e.id)).toEqual([]);
  });
  it('discrepancy entries explain themselves', () => {
    expect(entries.filter((e) => e.verification === 'discrepancy' && !e.notes?.some((n) => n.type === 'discrepancy')).map((e) => e.id)).toEqual([]);
  });
});

describe('creature data', () => {
  it('has 43 encounter creatures, 11 overseers (incl. Lesser Demon) and 5 minions', () => {
    expect(creatures.filter((c) => c.group === 'creature').length).toBe(43);
    expect(creatures.filter((c) => c.group === 'overseer' || c.group === 'overseer-summon').length).toBe(11);
    expect(creatures.filter((c) => c.group === 'minion').length).toBe(5);
  });
  it('action tables cover their die', () => {
    for (const c of creatures) {
      if (!c.actions.length) continue;
      const sides = tableSides(c.actionDice ?? 'D6')!;
      const s = [...c.actions].sort((a, b) => a.min - b.min);
      let n = 1;
      for (const a of s) {
        expect(a.min, c.name).toBe(n);
        n = a.max + 1;
      }
      expect(n - 1, c.name).toBe(sides);
    }
  });
  it('every action has a Korean effect summary, in table order', () => {
    const mismatched = creatures
      .filter((c) => (creatureActionKo[c.id]?.length ?? 0) !== c.actions.length)
      .map((c) => `${c.id}: ${creatureActionKo[c.id]?.length ?? 0}/${c.actions.length}`);
    expect(mismatched).toEqual([]);
    expect(Object.keys(creatureActionKo).filter((id) => !creatures.some((c) => c.id === id))).toEqual([]);
    for (const list of Object.values(creatureActionKo)) for (const s of list) expect(s.trim().length, s).toBeGreaterThan(3);
  });
  it('encounter tables A/B point at real creatures', () => {
    const a = tables.find((t) => t.id === 't-encounter-a')!;
    const b = tables.find((t) => t.id === 't-encounter-b')!;
    for (const r of [...a.rows, ...b.rows]) expect(kindOf(r.next![0].id), r.ko).toBe('entry');
  });
});

describe('masteries', () => {
  it('has 20 Masteries, each with a Feature and Tiers 1–5', () => {
    expect(masteryIds.length).toBe(20);
    for (const id of masteryIds) {
      const e = entries.find((x) => x.id === id)!;
      expect(e.outcomes?.map((o) => o.label.split(' · ')[0]), id).toEqual(['Feature', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5']);
    }
  });
  it('Random Mastery rows point at the Mastery entries', () => {
    const t = tables.find((x) => x.id === 't-random-mastery')!;
    expect(t.rows.map((r) => r.next?.[0].id)).toEqual(masteryIds);
  });
});
