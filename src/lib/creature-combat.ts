import { tableById } from '../content';
import { creatureActionKo } from '../content/creature-actions';
import type { CreatureRecord } from '../content/entries/creatures';
import type { Entry, OracleTable } from '../content/schema';
import { adaptationArmorBonus, type ArmorBonus } from './creature-adaptation';

const ACTION_FOLLOW_ON: Record<string, Record<number, string>> = {
  'cr-infernal-archon': { 3: 'cr-lesser-demon' },
};
const ACTION_KIND = {
  Physical: 'Physical · 공격 판정',
  Magical: 'Magical · 저항은 행동 설명 참조',
};

const SPOILS_TABLES: Record<string, string[]> = {
  'Spoils table': ['t-spoils'],
  'Resources table': ['t-resources'],
  '1 roll on the Valuable table, 1 roll on the Precious table': ['t-valuable', 't-precious'],
};

export function creatureSpoilsTables(creature: CreatureRecord): string[] {
  return creature.spoils ? SPOILS_TABLES[creature.spoils] ?? [] : [];
}

export function creatureActionTable(creature: CreatureRecord, entry: Entry): OracleTable {
  const effects = creatureActionKo[creature.id] ?? [];
  return {
    id: creature.id,
    ko: '행동',
    en: `${creature.name} Actions`,
    aliases: [],
    dice: creature.actionDice ?? 'D6',
    group: 'creatures',
    usage: '',
    mode: 'summary',
    columns: [{ key: 'kind', ko: '처리' }],
    rows: creature.actions.map((action, index) => {
      const next = ACTION_FOLLOW_ON[creature.id]?.[action.min];
      return {
        min: action.min,
        max: action.max,
        label: action.name,
        ko: effects[index] ?? '',
        cols: { kind: action.tag ? ACTION_KIND[action.tag] : '행동 설명대로 적용' },
        ...(next ? { next: [{ id: next, note: '소환수 능력치' }] } : {}),
      };
    }),
    related: [],
    source: entry.source,
    verification: entry.verification,
  };
}

function armorAt(armor: string, location: string, bonuses: readonly ArmorBonus[]): number | null {
  const match = /^(\d+)\s*\(([^)]+)\)$/.exec(armor);
  const bonus = adaptationArmorBonus(bonuses, location);
  if (bonus === null) return null;
  if (/^[–—-]$/.test(armor)) return bonus;
  if (!match) return null;
  const applies = /^all( hit)? locations$/i.test(match[2]) || match[2].split(',').some((part) => part.trim() === location);
  return (applies ? Number(match[1]) : 0) + bonus;
}

export function creatureHitTable(creature: CreatureRecord, entry: Entry, bonuses: readonly ArmorBonus[]): OracleTable | undefined {
  const table = tableById.get(entry.tables?.[0] ?? '');
  if (!table) return;
  return {
    ...table,
    columns: [{ key: 'armor', ko: 'Armor' }, { key: 'weak', ko: '약점' }],
    rows: table.rows.map((row) => ({
      ...row,
      cols: {
        armor: String(armorAt(creature.armor, row.label ?? '', bonuses) ?? '능력치 확인'),
        weak: row.label === creature.weakSpot ? '해당' : '—',
      },
    })),
  };
}
