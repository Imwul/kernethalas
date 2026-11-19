import { tableById } from '../content';
import { creatureActionKo } from '../content/creature-actions';
import { creatureActionRule } from '../content/creature-action-rules';
import type { CreatureRecord } from '../content/entries/creatures';
import type { Entry, OracleTable } from '../content/schema';
import { adaptationArmorBonus, type ArmorBonus } from './creature-adaptation';

const ACTION_FOLLOW_ON: Record<string, Record<number, string>> = {
  'cr-infernal-archon': { 3: 'cr-lesser-demon' },
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
      const { resistance, after } = creatureActionRule(creature, action);
      const check = action.tag === 'Physical' ? '공격 판정' : resistance ? `${resistance} 판정` : '행동 효과 적용';
      const kind = [action.tag, check, after && `추가 ${after}`].filter(Boolean).join(' · ');
      return {
        min: action.min,
        max: action.max,
        label: action.name,
        ko: effects[index] ?? '',
        cols: { kind },
        ...(next ? { next: [{ id: next, note: '소환수 능력치' }] } : {}),
      };
    }),
    related: [],
    source: entry.source,
    verification: entry.verification,
  };
}

function armorAt(armor: string, location: string | null, bonuses: readonly ArmorBonus[]): number | null {
  const match = /^(\d+)\s*\(([^)]+)\)$/.exec(armor);
  const bonus = adaptationArmorBonus(bonuses, location);
  if (bonus === null) return null;
  if (/^[–—-]$/.test(armor)) return bonus;
  if (!match) return null;
  const appliesToAll = /^all( hit)? locations$/i.test(match[2]);
  if (!location && !appliesToAll) return null;
  const applies = appliesToAll || match[2].split(',').some((part) => part.trim() === location);
  return (applies ? Number(match[1]) : 0) + bonus;
}

export function creatureHitImpact(creature: CreatureRecord, location: string | null, bonuses: readonly ArmorBonus[]) {
  return { armor: armorAt(creature.armor, location, bonuses), weak: location !== null && location === creature.weakSpot };
}

export function creatureHitTable(creature: CreatureRecord, entry: Entry, bonuses: readonly ArmorBonus[]): OracleTable | undefined {
  const table = tableById.get(entry.tables?.[0] ?? '');
  if (!table) return;
  return {
    ...table,
    columns: [{ key: 'armor', ko: 'Armor' }, { key: 'weak', ko: '약점' }],
    rows: table.rows.map((row) => {
      const { armor, weak } = creatureHitImpact(creature, row.label ?? '', bonuses);
      return { ...row, cols: { armor: String(armor ?? '능력치 확인'), weak: weak ? '해당' : '—' } };
    }),
  };
}
