/**
 * Reads XP and Exhaustion changes out of the place's "changes to mark on paper" list, so the character tab
 * can show the running totals without a second bookkeeping step. Only resolved numbers count ("XP +10",
 * "Exhaustion −2"); a change that still shows a die is left to the player.
 */
import type { MadnessTiming, RoomProgress } from './play-character';

type SheetLine = { id: string; text: string };

const XP_GAIN = /XP \+(\d{1,3}(?:,\d{3})+|\d+)/g;
const EXHAUSTION = /Exhaustion\s*([+−-])\s*(\d+)(?!\s*[dD]\d)/g;
// current Sanity only: "최대 Sanity −5" and "Sanity 최대치 +3" change the maximum
const SANITY = /(?<!최대 )Sanity\s*([+−-])\s*(\d+)(?!\s*[dD]\d)/g;

export function xpGain(text: string) {
  let total = 0;
  for (const match of text.matchAll(XP_GAIN)) total += Number(match[1].replaceAll(',', ''));
  return total;
}

export function sanityChange(text: string, extraLoss = 0) {
  let total = 0;
  for (const match of text.matchAll(SANITY)) total += match[1] === '+' ? Number(match[2]) : -(Number(match[2]) + extraLoss);
  return total;
}

export function exhaustionChange(text: string) {
  let total = 0;
  for (const match of text.matchAll(EXHAUSTION)) total += (match[1] === '+' ? 1 : -1) * Number(match[2]);
  return total;
}

/**
 * XP spent on level-ups this place is subtracted, since a level-up resets XP (p.62). Madness results 4 and 7
 * make every Sanity loss 1 larger and every XP gain 10 smaller per result.
 */
export function roomProgress(sheet: readonly SheetLine[], xpSpent = 0,
  { xpLoss = 0, extraSanityLoss = 0, goals = {}, madnessTiming = [] }: {
    xpLoss?: number; extraSanityLoss?: number; goals?: Record<string, number>; madnessTiming?: MadnessTiming[];
  } = {}): RoomProgress {
  const xpItems: string[] = [];
  const exhaustionItems: string[] = [];
  const sanityItems: string[] = [];
  let xp = 0;
  let exhaustion = 0;
  let sanity = 0;
  const exemptions = { 4: new Map<string, number>(), 7: new Map<string, number>() };
  for (const { result, previousLines } of madnessTiming) {
    const counts = exemptions[result];
    for (const id of previousLines) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const { id, text } of sheet) {
    const gained = xpGain(text);
    const penalty = Math.max(0, xpLoss - (exemptions[7].get(id) ?? 0) * 10);
    if (gained) { xp += Math.max(0, gained - penalty); xpItems.push(text); }
    const changed = exhaustionChange(text);
    if (changed) { exhaustion += changed; exhaustionItems.push(text); }
    const mind = sanityChange(text, Math.max(0, extraSanityLoss - (exemptions[4].get(id) ?? 0)));
    if (mind) { sanity += mind; sanityItems.push(text); }
  }
  return { xp: xp - xpSpent, exhaustion, sanity, xpItems, exhaustionItems, sanityItems, goals, lineIds: [...new Set(sheet.map(({ id }) => id))] };
}

/** Personal Goals the place's records can count (p.64–67); the rest are kept by hand. */
const KILL_GOALS: Record<string, string> = {
  'Astral Bane': 'Astral', 'Beast Hunter': 'Animal', 'Botanical Exterminator': 'Plant', 'Demon Bane': 'Demon',
  'Elemental Vanquisher': 'Elemental', Marauder: 'Humanoid', 'Sentinel Smasher': 'Construct', Wraithstalker: 'Undead',
};
export const COUNTED_GOALS = new Set([...Object.keys(KILL_GOALS), 'Annihilator', 'Overseer Overthrown', 'Decapitate the Leadership',
  'Vaelorian Erudite', 'Thrill Seeker', 'Relic Hunter']);
export function goalCounts({ defeated, sheet, darkness }: {
  defeated: { types: readonly string[]; overseer: boolean }[];
  sheet: readonly SheetLine[];
  darkness: number;
}) {
  const counts: Record<string, number> = {};
  const add = (goal: string, amount: number) => { if (amount > 0) counts[goal] = (counts[goal] ?? 0) + amount; };
  add('Annihilator', defeated.length);
  for (const [goal, type] of Object.entries(KILL_GOALS)) add(goal, defeated.filter(({ types }) => types.includes(type)).length);
  const overseers = defeated.filter(({ overseer }) => overseer).length;
  add('Overseer Overthrown', Math.min(1, overseers));
  add('Decapitate the Leadership', overseers);
  add('Vaelorian Erudite', sheet.filter(({ text }) => /Lore Book/.test(text)).length);
  add('Relic Hunter', Math.min(1, sheet.filter(({ text }) => /\bRelic\b/.test(text)).length));
  add('Thrill Seeker', darkness);
  return counts;
}

/** Accumulated Exhaustion (p.90): the effects stack as the score climbs. */
export const EXHAUSTION_BANDS = [
  { min: 0, max: 10, short: '영향 없음', text: '숨이 차고 땀이 나는 것 말고는 효과가 없다.' },
  { min: 11, max: 15, short: 'Wounds 회복 절반', text: '모든 근원에서 회복하는 Wounds가 절반이 된다.' },
  { min: 16, max: 20, short: '모든 판정 불리', text: '모든 판정에 Disadvantage를 받는다. Wounds 회복 절반도 계속된다.' },
  { min: 21, max: 99, short: '사망', text: '몸이 더 버티지 못해 죽는다.' },
] as const;
export const exhaustionBand = (value: number) => EXHAUSTION_BANDS.find(({ min, max }) => value >= min && value <= max) ?? EXHAUSTION_BANDS[3];
export const exhaustionDisadvantage = (value: number | undefined) => value !== undefined && value >= 16 && value <= 20;
export const exhaustionHalfHealing = (value: number | undefined) => value !== undefined && value >= 11 && value <= 20;
