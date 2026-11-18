import type { Entry, OracleTable } from './schema';
import { coreEntries } from './entries/core';
import { combatEntries } from './entries/combat';
import { conditionEntries } from './entries/conditions';
import { survivalEntries } from './entries/survival';
import { explorationEntries } from './entries/exploration';
import { creatureEntries } from './entries/creatures';
import { equipmentEntries, characterEntries } from './entries/equipment';
import { containerRelicEntries } from './entries/container-relics';
import { masteryEntries } from './entries/masteries';
import { combatTables } from './tables/combat';
import { explorationTables } from './tables/exploration';
import { lootTables } from './tables/loot';
import { referenceTables } from './tables/reference';
import { procedures } from './procedures';
import { rulings } from './rulings';

export const entries: Entry[] = [
  ...coreEntries,
  ...combatEntries,
  ...conditionEntries,
  ...survivalEntries,
  ...explorationEntries,
  ...creatureEntries,
  ...equipmentEntries,
  ...containerRelicEntries,
  ...characterEntries,
  ...masteryEntries,
];
export const tables: OracleTable[] = [...combatTables, ...explorationTables, ...lootTables, ...referenceTables];
export { procedures, rulings };

export const entryById = new Map(entries.map((e) => [e.id, e]));
export const tableById = new Map(tables.map((t) => [t.id, t]));
export const procById = new Map(procedures.map((p) => [p.id, p]));
export const rulingById = new Map(rulings.map((r) => [r.id, r]));

export type AnyKind = 'entry' | 'table' | 'procedure' | 'ruling';
export function kindOf(id: string): AnyKind | null {
  if (entryById.has(id)) return 'entry';
  if (tableById.has(id)) return 'table';
  if (procById.has(id)) return 'procedure';
  if (rulingById.has(id)) return 'ruling';
  return null;
}
export function hrefOf(id: string): string {
  const k = kindOf(id);
  if (k === 'table') return `/oracle/${id}`;
  if (k === 'procedure') return `/atlas/${id}`;
  if (k === 'ruling') return `/rulings#${id}`;
  return `/ref/${id}`;
}
export function titleOf(id: string): { ko: string; en: string } {
  const e = entryById.get(id) ?? tableById.get(id) ?? procById.get(id);
  if (e) return { ko: e.ko, en: e.en };
  const r = rulingById.get(id);
  if (r) return { ko: r.q, en: r.qEn ?? '' };
  return { ko: id, en: id };
}

export const CATEGORY_LABEL: Record<string, { ko: string; en: string; plate: string }> = {
  core: { ko: '기본 판정', en: 'Core Mechanics', plate: 'I' },
  combat: { ko: '전투', en: 'Combat', plate: 'II' },
  conditions: { ko: '상태 이상', en: 'Conditions', plate: 'III' },
  health: { ko: '부상과 죽음', en: 'Healing & Death', plate: 'IV' },
  survival: { ko: '생존', en: 'Survival', plate: 'V' },
  exploration: { ko: '탐험', en: 'Exploration', plate: 'VI' },
  creatures: { ko: '생물', en: 'Creatures', plate: 'VII' },
  overseers: { ko: 'Overseer', en: 'Overseers', plate: 'VIII' },
  equipment: { ko: '장비', en: 'Equipment', plate: 'IX' },
  loot: { ko: '전리품', en: 'Spoils & Loot', plate: 'X' },
  character: { ko: '캐릭터', en: 'Character', plate: 'XI' },
};

export const TABLE_GROUP_LABEL: Record<string, string> = {
  exploration: '탐험',
  combat: '전투',
  survival: '생존',
  loot: '전리품',
  'magic-items': '마법 아이템',
  creatures: '생물',
  character: '캐릭터',
  flavor: '분위기',
};

export const BOOK_LABEL: Record<string, string> = {
  core: 'Core v1.2',
  rr: 'Rules Ref.',
  'flow-combat': 'Combat Flowchart',
  'flow-explore': 'Exploration Loop',
};
