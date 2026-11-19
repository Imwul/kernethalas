import { tableById } from '../content';
import { CARRY_TYPES, type CarryType } from './play-equipment';

export const GEAR_LOCATIONS = { equipped: '착용', belt: '벨트', pack: '가방' } as const;
export const GEAR_WEIGHTS = { normal: 'Normal', heavy: 'Heavy', light: 'Light', coins: '동전', gems: '보석', free: '칸 제외' } as const;
export const ARMOR_DICE = ['D12', 'D10', 'D8', 'D6', 'D4'] as const;
type GearLocation = keyof typeof GEAR_LOCATIONS;
type GearWeight = keyof typeof GEAR_WEIGHTS;
export type Integrity = (typeof ARMOR_DICE)[number] | 'broken';

export interface GearItem {
  id: string;
  name: string;
  count: number;
  location: GearLocation;
  weight: GearWeight;
  integrity?: Integrity;
}

export type GearEffect =
  | { kind: 'count'; name: string; amount: number; weight?: GearWeight }
  | { kind: 'integrity'; itemId: string; before: Integrity; after: Integrity };

export interface PaperChange {
  id: string;
  text: string;
  gear?: GearEffect;
}

interface GearEntry {
  id: string;
  old: GearItem | null;
  next: GearItem;
  reason: string;
  source?: string;
}

export interface GearLedger {
  items: GearItem[];
  entries: GearEntry[];
}

const STORAGE_KEY = 'kn-play-gear-v1';
const EMPTY: GearLedger = { items: [], entries: [] };
const DEFAULT_WEIGHT: Partial<Record<string, GearWeight>> = {
  '광원': 'free', '동전': 'coins', '보석': 'gems', '물약': 'light', 'bandage': 'light', 'torch': 'light', 'ration': 'light',
  'potion': 'light', 'crafting supplies': 'light', 'cooking ingredients': 'light', 'attunement crystal': 'light',
  'fragment': 'light',
};

export const gearKey = (name: string) => name.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
const catalogWeights = new Map(tableById.get('t-common-gear')?.rows.flatMap(({ label, cols }) => {
  const weight = cols?.w?.toLowerCase();
  return label && (weight === 'normal' || weight === 'heavy' || weight === 'light') ? [[gearKey(label), weight] as const] : [];
}));
export const gearWeight = (name: string): GearWeight => catalogWeights.get(gearKey(name))
  ?? (Object.hasOwn(DEFAULT_WEIGHT, gearKey(name)) ? DEFAULT_WEIGHT[gearKey(name)]! : 'normal');
export const gearCount = (name: string, amount: number): GearEffect => ({ kind: 'count', name, amount, weight: gearWeight(name) });
export const showIntegrity = (die: Integrity) => die === 'broken' ? '파괴' : die;

function isGearItem(value: unknown): value is GearItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as GearItem;
  return typeof item.id === 'string' && typeof item.name === 'string' && item.name.trim() !== ''
    && Number.isSafeInteger(item.count) && item.count >= 0 && Object.hasOwn(GEAR_LOCATIONS, item.location)
    && Object.hasOwn(GEAR_WEIGHTS, item.weight)
    && (item.integrity === undefined || item.integrity === 'broken' || ARMOR_DICE.some((die) => die === item.integrity));
}

export function readGearLedger(): GearLedger | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const data = JSON.parse(raw) as Partial<GearLedger> | null;
    if (!Array.isArray(data?.items) || !Array.isArray(data?.entries)) return null;
    const items = data.items.filter(isGearItem);
    const entries = data.entries.filter((entry) => entry && typeof entry.id === 'string' && typeof entry.reason === 'string'
      && (entry.old === null || isGearItem(entry.old)) && isGearItem(entry.next));
    return { items, entries };
  } catch { return null; }
}

export function storeGearLedger(ledger: GearLedger) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)); return true; }
  catch { return false; }
}

export function isGearStorageEvent(event: StorageEvent) {
  return event.key === STORAGE_KEY || event.key === null;
}

function replaceItem(items: GearItem[], item: GearItem | null, id: string) {
  if (!item) return items.filter((current) => current.id !== id);
  return items.some((current) => current.id === id)
    ? items.map((current) => current.id === id ? item : current)
    : [...items, item];
}

type LedgerResult = { ledger: GearLedger } | { error: string };

export function saveGearItem(ledger: GearLedger, item: GearItem, reason: string, source?: string): LedgerResult {
  if (!isGearItem(item) || !reason.trim()) return { error: '품목 이름과 수량, 변경 이유를 확인하세요.' };
  if (source && ledger.entries.some((entry) => entry.source === source)) return { error: '이 변경은 이미 장부에 반영했습니다.' };
  const old = ledger.items.find(({ id }) => id === item.id) ?? null;
  if (old && JSON.stringify(old) === JSON.stringify(item)) return { error: '바뀐 항목이 없습니다.' };
  return { ledger: {
    items: replaceItem(ledger.items, item, item.id),
    entries: [...ledger.entries, { id: crypto.randomUUID(), old, next: item, reason, source }],
  } };
}

export function matchingGear(ledger: GearLedger, name: string) {
  return ledger.items.filter((item) => gearKey(item.name) === gearKey(name) && item.integrity !== 'broken');
}

export function applyGearEffect(ledger: GearLedger, effect: GearEffect, reason: string, source: string, target?: string): LedgerResult {
  if (effect.kind === 'integrity') {
    const item = ledger.items.find(({ id }) => id === effect.itemId);
    if (!item || item.integrity !== effect.before) return { error: '장부의 현재 내구도가 굴릴 때와 다릅니다. 내구도를 확인하세요.' };
    return saveGearItem(ledger, { ...item, integrity: effect.after, count: effect.after === 'broken' ? 0 : item.count }, reason, source);
  }
  const matches = matchingGear(ledger, effect.name);
  const current = target ? matches.find(({ id }) => id === target) : matches.length === 1 ? matches[0] : undefined;
  if (!current && (target || matches.length > 1)) return { error: '반영할 장비를 선택하세요.' };
  const count = (current?.count ?? 0) + effect.amount;
  if (!Number.isSafeInteger(count) || count < 0) return { error: '현재 수량으로 반영할 수 없습니다. 장부의 수량을 확인하세요.' };
  const item = current ? { ...current, count } : {
    id: crypto.randomUUID(), name: effect.name, count, location: 'pack' as const, weight: effect.weight ?? gearWeight(effect.name),
  };
  return saveGearItem(ledger, item, reason, source);
}

export function undoGearEntry(ledger: GearLedger): LedgerResult {
  const latest = ledger.entries.at(-1);
  return latest ? { ledger: { items: replaceItem(ledger.items, latest.old, latest.next.id), entries: ledger.entries.slice(0, -1) } }
    : { error: '되돌릴 장부 기록이 없습니다.' };
}

export function ledgerCarry(items: GearItem[]) {
  const totals = Object.fromEntries(CARRY_TYPES.map(({ id }) => [id, 0])) as Record<CarryType, number>;
  for (const item of items) {
    if (item.location !== 'equipped' && item.weight !== 'free') totals[item.weight] += item.count;
  }
  const countOf = (name: string) => items.filter((item) => gearKey(item.name) === name).reduce((total, item) => total + item.count, 0);
  return { totals, backpack: countOf('backpack') > 0, pouches: Math.min(3, countOf('pouch')) };
}
