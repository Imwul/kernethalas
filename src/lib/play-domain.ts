import { tableById } from '../content';
import { creatureById } from '../content/entries/creatures';
import type { OracleTable } from '../content/schema';
import type { DomainProgress } from './domain-progress';

export type TensionSides = 8 | 6 | 4;
export type DarknessEvent = { id: string; roll: number };
export type InfluenceRoll = { roll: number | null; damageRoll: number | null };
export type RetreatedEncounter = {
  id: string;
  place: string;
  creatureIds: string[];
  kind: 'encounter' | 'overseer';
  origin?: { area?: 'room' | 'corridor'; paperId?: string };
};
export const RETREAT_RETURN_SLOT = 'retreatReturnId';
export const RETREAT_BATTLE_ID = 'reentry';
export const RETREAT_AMBUSH_ID = 'reentry-ambush';
export type PlayDomainRecord = {
  id: number;
  name: string;
  overseerRoll: number | null;
  overseerRevealedRoll?: number | null;
  defeated: boolean;
  influence: InfluenceRoll;
  extra: Record<string, InfluenceRoll>;
  darkness: DarknessEvent[];
  encounterSetId?: string;
  retreats?: RetreatedEncounter[];
  progress?: DomainProgress;
};

export const EMPTY_INFLUENCE: InfluenceRoll = { roll: null, damageRoll: null };
export const OVERSEER_TABLE = tableById.get('t-overseer')!;
export const INFLUENCE_TABLE = tableById.get('t-overseer-influence')!;
export const DAMAGE_TYPE_TABLE = tableById.get('t-damage-type')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;

export function newPlayDomain(id: number): PlayDomainRecord {
  return { id, name: '', overseerRoll: null, defeated: false, influence: EMPTY_INFLUENCE, extra: {}, darkness: [] };
}

export function playTableRow(table: OracleTable, roll: number | null) {
  return roll === null ? undefined : table.rows.find(({ min, max }) => min <= roll && roll <= max);
}

export function domainOverseer(roll: number | null) {
  const id = playTableRow(OVERSEER_TABLE, roll)?.next?.[0]?.id;
  return id ? creatureById.get(id) : undefined;
}

export function influenceText({ roll, damageRoll }: InfluenceRoll) {
  const row = playTableRow(INFLUENCE_TABLE, roll);
  const type = playTableRow(DAMAGE_TYPE_TABLE, damageRoll)?.ko;
  if (roll === 6 && type) return `Resistant · ${type} 저항`;
  return row ? `${row.label} · ${row.ko}` : '';
}

// Table ranges which apply again later, or impose a modifier that can be lifted.
const ONGOING = new Set([1, 9, 11, 13, 15, 17, 19, 21, 23, 29, 35, 51, 55, 57, 59, 61, 65, 69, 73, 77, 81]);

export function activeDarkness(events: DarknessEvent[], dismissed: string[]) {
  let active: DarknessEvent[] = [];
  for (const event of events) {
    const key = playTableRow(DARKNESS_TABLE, event.roll)?.min;
    if (key === 33) active = [];
    else if (key && ONGOING.has(key) && !dismissed.includes(event.id)) active.push(event);
  }
  return active;
}

export function darknessDetails(event: DarknessEvent) {
  return playTableRow(DARKNESS_TABLE, event.roll);
}

export function tensionSides(label: string | null | undefined): TensionSides | null {
  return label === 'D8' ? 8 : label === 'D6' ? 6 : label === 'D4' ? 4 : null;
}
