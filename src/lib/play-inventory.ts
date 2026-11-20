import { tableById } from '../content';
import { CARRY_TYPES, type CarryType } from './play-equipment';
import { campaignStorageKey } from './play-campaigns';

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
  quickUse?: boolean;
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
  linkedQuickUses?: string[];
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

const QUICK_CONSUMABLES = new Set(['광원', '횃불', '붕대', '식량', '자물쇠 따개', '물약',
  'torch', 'bandage', 'ration', 'lockpick', 'potion', 'candle', 'flare', 'lamp oil', 'ritual ingredient']);
export const isQuickGear = (item: GearItem) => !item.integrity && item.weight !== 'coins' && item.weight !== 'gems'
  && (item.quickUse ?? QUICK_CONSUMABLES.has(gearKey(item.name)));

function isGearItem(value: unknown): value is GearItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as GearItem;
  return typeof item.id === 'string' && typeof item.name === 'string' && item.name.trim() !== ''
    && Number.isSafeInteger(item.count) && item.count >= 0 && Object.hasOwn(GEAR_LOCATIONS, item.location)
    && Object.hasOwn(GEAR_WEIGHTS, item.weight)
    && (item.quickUse === undefined || typeof item.quickUse === 'boolean')
    && (item.integrity === undefined || item.integrity === 'broken' || ARMOR_DICE.some((die) => die === item.integrity));
}

function isGearEntry(value: unknown): value is GearEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<GearEntry>;
  return typeof entry.id === 'string' && typeof entry.reason === 'string'
    && (entry.source === undefined || typeof entry.source === 'string')
    && (entry.linkedQuickUses === undefined || Array.isArray(entry.linkedQuickUses)
      && entry.linkedQuickUses.every((id) => typeof id === 'string'))
    && isGearItem(entry.next) && (entry.old === null || isGearItem(entry.old) && entry.old.id === entry.next.id);
}

export function readGearLedger(campaignId?: string): GearLedger | null {
  try {
    const raw = localStorage.getItem(campaignStorageKey(STORAGE_KEY, campaignId));
    if (!raw) return EMPTY;
    const data = JSON.parse(raw) as Partial<GearLedger> | null;
    if (!Array.isArray(data?.items) || !Array.isArray(data?.entries)) return null;
    const items = data.items.filter(isGearItem);
    const entries = data.entries.filter(isGearEntry);
    return { items, entries };
  } catch { return null; }
}

export function isGearLedger(value: unknown): value is GearLedger {
  if (!value || typeof value !== 'object') return false;
  const ledger = value as Partial<GearLedger>;
  return Array.isArray(ledger.items) && ledger.items.every(isGearItem)
    && new Set(ledger.items.map(({ id }) => id)).size === ledger.items.length
    && Array.isArray(ledger.entries) && ledger.entries.every(isGearEntry)
    && new Set(ledger.entries.map(({ id }) => id)).size === ledger.entries.length;
}

export function storeGearLedger(ledger: GearLedger, campaignId?: string) {
  try { localStorage.setItem(campaignStorageKey(STORAGE_KEY, campaignId), JSON.stringify(ledger)); return true; }
  catch { return false; }
}

export function isGearStorageEvent(event: StorageEvent, campaignId?: string) {
  return event.key === campaignStorageKey(STORAGE_KEY, campaignId) || event.key === null;
}

function replaceItem(items: GearItem[], item: GearItem | null, id: string) {
  if (!item) return items.filter((current) => current.id !== id);
  return items.some((current) => current.id === id)
    ? items.map((current) => current.id === id ? item : current)
    : [...items, item];
}

type LedgerResult = { ledger: GearLedger } | { error: string };

export function sameGearItem(current: GearItem | undefined, expected: GearItem) {
  return !!current && current.id === expected.id && current.name === expected.name && current.count === expected.count
    && current.location === expected.location && current.weight === expected.weight && current.integrity === expected.integrity
    && current.quickUse === expected.quickUse;
}

export function saveGearItem(ledger: GearLedger, item: GearItem, reason: string, source?: string, linkedQuickUses?: string[]): LedgerResult {
  if (!isGearItem(item) || !reason.trim()) return { error: '품목 이름과 수량, 변경 이유를 확인하세요.' };
  if (source && ledger.entries.some((entry) => entry.source === source)) return { error: '이 변경은 이미 장부에 반영했습니다.' };
  const old = ledger.items.find(({ id }) => id === item.id) ?? null;
  if (sameGearItem(old ?? undefined, item) && !linkedQuickUses?.length) return { error: '바뀐 항목이 없습니다.' };
  return { ledger: {
    items: replaceItem(ledger.items, item, item.id),
    entries: [...ledger.entries, { id: crypto.randomUUID(), old, next: item, reason, source, linkedQuickUses }],
  } };
}

const quickPrefix = (roomId: string) => `${roomId}/quick-use/`;

export function isQuickUseEntry(entry: GearEntry, roomId: string) {
  return entry.source?.startsWith(quickPrefix(roomId)) && entry.old?.count === entry.next.count + 1;
}

export function useOneGearItem(ledger: GearLedger, expected: GearItem, roomId: string, operationId: string): LedgerResult {
  const item = ledger.items.find(({ id }) => id === expected.id);
  if (!item || !isQuickGear(item) || item.count < 1 || !sameGearItem(item, expected)) {
    return { error: '장부 수량이 바뀌었습니다. 품목을 다시 확인하세요.' };
  }
  return saveGearItem(ledger, { ...item, count: item.count - 1 }, '빠른 사용 · 1개', `${quickPrefix(roomId)}${operationId}`);
}

export function availableQuickUses(ledger: GearLedger, roomId: string, itemId: string, amount: number) {
  const linked = new Set(ledger.entries.flatMap(({ linkedQuickUses }) => linkedQuickUses ?? []));
  return ledger.entries.filter((entry) => entry.next.id === itemId && isQuickUseEntry(entry, roomId) && !linked.has(entry.id))
    .slice(-amount).map(({ id }) => id);
}

export function matchingGear(ledger: GearLedger, name: string) {
  return ledger.items.filter((item) => gearKey(item.name) === gearKey(name) && item.integrity !== 'broken');
}

export function applyGearEffect(ledger: GearLedger, effect: GearEffect, reason: string, source: string, target?: string,
  accounted?: { roomId: string; ids: string[] }): LedgerResult {
  if (effect.kind === 'integrity') {
    const item = ledger.items.find(({ id }) => id === effect.itemId);
    if (!item || item.integrity !== effect.before) return { error: '장부의 현재 내구도가 굴릴 때와 다릅니다. 내구도를 확인하세요.' };
    return saveGearItem(ledger, { ...item, integrity: effect.after, count: effect.after === 'broken' ? 0 : item.count }, reason, source);
  }
  const matches = matchingGear(ledger, effect.name);
  const current = target ? matches.find(({ id }) => id === target) : matches.length === 1 ? matches[0] : undefined;
  if (!current && (target || matches.length > 1)) return { error: '반영할 장비를 선택하세요.' };
  if (accounted) {
    const available = new Set(current && effect.amount < 0 ? availableQuickUses(ledger, accounted.roomId, current.id, -effect.amount) : []);
    if (!accounted.ids.length || new Set(accounted.ids).size !== accounted.ids.length || accounted.ids.some((id) => !available.has(id))) {
      return { error: '연결할 사용 기록이 바뀌었습니다. 장부를 다시 확인하세요.' };
    }
  }
  const count = (current?.count ?? 0) + effect.amount + (accounted?.ids.length ?? 0);
  if (!Number.isSafeInteger(count) || count < 0) return { error: '현재 수량으로 반영할 수 없습니다. 장부의 수량을 확인하세요.' };
  const item = current ? { ...current, count } : {
    id: crypto.randomUUID(), name: effect.name, count, location: 'pack' as const, weight: effect.weight ?? gearWeight(effect.name),
  };
  return saveGearItem(ledger, item, reason, source, accounted?.ids);
}

export function undoGearEntry(ledger: GearLedger, expectedId?: string): LedgerResult {
  const latest = ledger.entries.at(-1);
  if (expectedId && latest?.id !== expectedId) return { error: '그 뒤에 장부가 바뀌었습니다. 최근 변경부터 되돌릴 수 있습니다.' };
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
