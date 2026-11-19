import { tableById } from '../content';

export const CARRY_TYPES = [
  { id: 'normal', label: 'Normal' },
  { id: 'heavy', label: 'Heavy' },
  { id: 'light', label: 'Light' },
  { id: 'coins', label: '동전' },
  { id: 'gems', label: '보석' },
] as const;

export type CarryType = (typeof CARRY_TYPES)[number]['id'];
type CarryCounts = Record<CarryType, number>;

export function readEquipmentCount(raw: string) {
  const value = raw.trim();
  if (!value) return 0;
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) return null;
  const number = Number(value.replaceAll(',', ''));
  return Number.isSafeInteger(number) ? number : null;
}

function usedSlots({ normal, heavy, light, coins, gems }: CarryCounts) {
  if (!Number.isSafeInteger(coins + gems)) return null;
  const used = normal + heavy * 2 + Math.ceil(light / 10) + Math.ceil((coins + gems) / 100);
  return Number.isSafeInteger(used) ? used : null;
}

export function carryingSpace(current: CarryCounts, loot: CarryCounts, backpack: boolean, pouches: number) {
  const combined = {
    normal: current.normal + loot.normal,
    heavy: current.heavy + loot.heavy,
    light: current.light + loot.light,
    coins: current.coins + loot.coins,
    gems: current.gems + loot.gems,
  };
  if (!Object.values(combined).every(Number.isSafeInteger)) return null;
  const before = usedSlots(current);
  const after = usedSlots(combined);
  if (before === null || after === null) return null;
  return { capacity: 10 + (backpack ? 20 : 0) + pouches * 5, before, after };
}

interface PricedItem { id: string; name: string; price: number }
interface ItemCategory { name: string; items: PricedItem[] }

function pricedItems(tableId: string, category: string, qualify?: string): ItemCategory {
  const rows = tableById.get(tableId)?.rows ?? [];
  const items = rows.flatMap(({ label, cols, min }) => {
    const price = readEquipmentCount(cols?.cost ?? '');
    if (!label || !price) return [];
    const name = qualify ? `${label} ${qualify}` : label;
    return [{ id: `${tableId}:${min}`, name, price }];
  });
  return { name: category, items: items.sort((a, b) => a.name.localeCompare(b.name, 'en')) };
}

export const MERCHANT_STOCK: ItemCategory[] = [
  pricedItems('t-common-gear', '일반 장비'),
  pricedItems('t-weapons', '무기'),
  pricedItems('t-armor-torso', '몸통 방어구', 'Torso'),
  pricedItems('t-armor-limbs', '팔 보호대', 'Vambraces'),
  pricedItems('t-armor-limbs', '정강이 보호대', 'Greaves'),
  pricedItems('t-helmets', '투구', 'Helmet'),
  pricedItems('t-shields', '방패', 'Shield'),
  { name: '재료', items: [
    { id: 'crystal', name: 'Attunement Crystal', price: 50 },
    { id: 'cooking', name: 'Cooking Ingredients', price: 5 },
    { id: 'crafting', name: 'Crafting Supplies', price: 5 },
  ] },
].map(({ name, items }) => ({ name, items: items.map((item) => ({ ...item, id: `${name}:${item.id}` })) }));

export const MAGIC_SALE: PricedItem[] = [
  { id: 'uncommon', name: 'Uncommon 마법 아이템', price: 200 },
  { id: 'rare', name: 'Rare 마법 아이템', price: 400 },
  { id: 'epic', name: 'Epic 마법 아이템', price: 600 },
  { id: 'relic', name: 'Relic 마법 아이템', price: 1000 },
];

export const merchantPrices = new Map(MERCHANT_STOCK.flatMap(({ items }) => items).map((item) => [item.id, item]));
export const magicPrices = new Map(MAGIC_SALE.map((item) => [item.id, item]));

export type TradeDirection = 'buy' | 'sell';

export interface TradeLine {
  direction: TradeDirection;
  name: string;
  quantity: number;
  price: number;
}

export function tradeTotals(lines: TradeLine[]) {
  const buy = lines.reduce((sum, line) => line.direction === 'buy' ? sum + line.price * line.quantity : sum, 0);
  const sell = lines.reduce((sum, line) => line.direction === 'sell' ? sum + line.price * line.quantity : sum, 0);
  if (!Number.isSafeInteger(buy) || !Number.isSafeInteger(sell)) return null;
  return { buy, sell, net: sell - buy };
}
