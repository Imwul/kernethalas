import { availableQuickUses, gearKey, type GearLedger, type PaperChange } from './play-inventory';
import type { PlaySlots } from './play-roll-history';

export const PLAY_LIGHT_SLOT = 'playLight';
export const BREATHER_LIGHT_COST = 5;
export const STANDARD_LIGHT_UNITS = 20;
export const CANDLE_LIGHT_UNITS = 10;

export type PlayLight = { remaining: number; included: string[] };
type LightEntry = { id: string; amount: number };

export interface PlaySupplies {
  lightEntries: LightEntry[];
  torch: number | null;
  lamp: number | null;
  oil: number | null;
  candle: number | null;
  ration: number | null;
}

export const EMPTY_SUPPLIES: PlaySupplies = { lightEntries: [], torch: null, lamp: null, oil: null, candle: null, ration: null };

export function isPlayLight(value: unknown): value is PlayLight | null {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const { remaining, included } = value as Partial<PlayLight>;
  return typeof remaining === 'number' && Number.isSafeInteger(remaining) && remaining >= 0
    && Array.isArray(included) && included.every((id) => typeof id === 'string' && id.length <= 600);
}

export function lightEntries(sheet: readonly PaperChange[]): LightEntry[] {
  return sheet.flatMap(({ id, gear }) => gear?.kind === 'count' && gearKey(gear.name) === '광원'
    ? [{ id, amount: gear.amount }] : []);
}

export function readPlayLight(slots: PlaySlots): PlayLight | null {
  const stored = slots[PLAY_LIGHT_SLOT];
  return isPlayLight(stored) ? stored : null;
}

export function lightRemaining(value: PlayLight | null, entries: readonly LightEntry[]) {
  if (!value) return null;
  const accounted = new Set(value.included);
  const delta = entries.reduce((total, { id, amount }) => accounted.has(id) ? total : total + amount, 0);
  return Math.max(0, value.remaining + delta);
}

export function carryPlayLight(slots: PlaySlots, sheet: readonly PaperChange[]): PlayLight | null {
  const remaining = lightRemaining(readPlayLight(slots), lightEntries(sheet));
  return remaining === null ? null : { remaining, included: [] };
}

export function playSupplies(ledger: GearLedger, sheet: readonly PaperChange[], roomId: string): PlaySupplies {
  const posted = new Set(ledger.entries.map(({ source }) => source));
  const stock = (names: readonly string[]) => {
    const items = ledger.items.filter(({ name, integrity }) => names.includes(gearKey(name)) && integrity !== 'broken');
    if (!items.length) return null;
    const used = sheet.reduce((count, { id, gear }) => gear?.kind === 'count' && gear.amount < 0
      && names.includes(gearKey(gear.name)) && !posted.has(`${roomId}/${id}`) ? count - gear.amount : count, 0);
    const alreadyUsed = used ? items.reduce((count, { id }) => count + availableQuickUses(ledger, roomId, id, used).length, 0) : 0;
    return Math.max(0, items.reduce((count, { count: amount }) => count + amount, 0) - Math.max(0, used - alreadyUsed));
  };
  return { lightEntries: lightEntries(sheet), torch: stock(['torch', '횃불']), lamp: stock(['lamp', 'belt lamp', '램프', '벨트 램프']),
    oil: stock(['lamp oil', '램프 기름']), candle: stock(['candle', '양초']), ration: stock(['ration', '식량']) };
}

export function afterLightCost(remaining: number | null, cost: number) {
  if (remaining === null) return `광원 ${cost} 소모 · 잔량 미기록`;
  return `광원 ${remaining} → ${Math.max(0, remaining - cost)}${remaining < cost ? ` · ${cost - remaining} 부족` : ''}`;
}
