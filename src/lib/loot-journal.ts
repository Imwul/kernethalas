import { tableById } from '../content';
import type { TableRow } from '../content/schema';

export function journalRow(tableId: string, value: number | null) {
  return value === null ? undefined : tableById.get(tableId)?.rows.find(({ min, max }) => value >= min && value <= max);
}

export function journalRowName(row: TableRow) {
  return row.label ?? row.ko.replace(/\.$/, '');
}

function sentence(text: string) {
  return text.trim().replace(/\.$/, '');
}

export function potionJournalLine(potion: TableRow, aging: TableRow, tasted: boolean) {
  const title = `${journalRowName(potion)} 물약${tasted ? ' (마심)' : ''}`;
  const effect = aging.max <= 6 ? [] : [`기본 효과 ${sentence(potion.ko)}`];
  const agingText = aging.min === 11 ? [] : [`노화 ${sentence(aging.ko)}`];
  return [title, ...effect, ...agingText].join(' · ');
}

const RARITIES = ['Uncommon', 'Rare', 'Epic'] as const;
export type JournalRarity = typeof RARITIES[number];

export function journalRarity(row: TableRow | undefined) {
  return RARITIES.find((rarity) => rarity === row?.label);
}

export function propertyCount(rarity: JournalRarity) {
  return RARITIES.indexOf(rarity) + 1;
}

// Property table summaries use an ordered three-value notation for rarity bonuses.
const RARITY_VALUE = String.raw`\+?(?:\d*D\d+(?:\+\d+)?|\d+)`;
const RARITY_TRIPLE = new RegExp(`(${RARITY_VALUE}) / (${RARITY_VALUE}) / (${RARITY_VALUE})`);

export function journalPropertyText(row: TableRow, rarity: JournalRarity, detail: { subject?: string; fixedD10?: number } = {}) {
  const effect = sentence(row.ko).replace(RARITY_TRIPLE, (_all, uncommon, rare, epic) =>
    [uncommon, rare, epic][RARITIES.indexOf(rarity)],
  );
  if (detail.fixedD10 !== undefined) return effect.replace(/\+D10$/, `+${detail.fixedD10}`);
  return detail.subject ? `${effect} (${detail.subject})` : effect;
}
