import { tableById } from '../content';
import { masteryCatalog } from '../content/entries/masteries';
import type { TableRow } from '../content/schema';
import { roll, rollDie, type RollResult } from './dice';
import { journalRow, journalRowName } from './loot-journal';
import { rollTable } from './oracle';
import { CHARACTER_WEAPONS, type PlayCharacter } from './play-character';
import { gearKey, saveGearItem, type GearItem, type GearLedger } from './play-inventory';
import { GROWTH_SKILLS } from './skill-growth';

/**
 * Creating a survivor (Core v1.2 pp.16–21, 64, 67). Only the arithmetic and the order of the steps live here;
 * the player can type every die they rolled at the table, let the app roll one step, or fill everything at once.
 */

export const CREATION_ATTRIBUTES = [
  { id: 'Health', dice: 'D6+10' },
  { id: 'Toughness', dice: '3D6+20' },
  { id: 'Aether', dice: 'D6+8' },
  { id: 'Sanity', dice: 'D6+10' },
] as const;
export type AttributeId = (typeof CREATION_ATTRIBUTES)[number]['id'];

export const CREATION_SKILLS = GROWTH_SKILLS;
export type CreationSkill = (typeof CREATION_SKILLS)[number];
const WEAPON_SKILLS: readonly string[] = CHARACTER_WEAPONS;
export const isWeaponSkill = (skill: string) => WEAPON_SKILLS.includes(skill);

/** The numbers in brackets on p.19–20; every other Skill starts at 0. */
export const SKILL_BASE: Partial<Record<CreationSkill, number>> = { Acrobatics: 10, Athletics: 10, Dodge: 10, Perception: 20 };
export const skillBase = (skill: string) => SKILL_BASE[skill as CreationSkill] ?? 0;

export const ALLOTMENTS = [
  { amount: 60, count: 1, weapon: true },
  { amount: 40, count: 1, weapon: true },
  { amount: 30, count: 3, weapon: false },
  { amount: 20, count: 2, weapon: false },
  { amount: 10, count: 3, weapon: false },
] as const;
export type Allotment = (typeof ALLOTMENTS)[number]['amount'];
export type AllotmentMap = Partial<Record<CreationSkill, Allotment>>;
export const isAllotment = (value: unknown): value is Allotment => ALLOTMENTS.some(({ amount }) => amount === value);

export function allotmentUse(allot: AllotmentMap) {
  const used = new Map<Allotment, number>(ALLOTMENTS.map(({ amount }) => [amount, 0]));
  for (const amount of Object.values(allot)) if (amount) used.set(amount, (used.get(amount) ?? 0) + 1);
  return ALLOTMENTS.map((rule) => ({ ...rule, used: used.get(rule.amount) ?? 0, left: rule.count - (used.get(rule.amount) ?? 0) }));
}

/** Problems that block finishing the Skill step; an incomplete board is not an error. */
export function allotmentErrors(allot: AllotmentMap) {
  const errors: string[] = [];
  for (const { amount, count, used } of allotmentUse(allot)) {
    if (used > count) errors.push(`+${amount}은 ${count}번만 줄 수 있습니다.`);
  }
  for (const [skill, amount] of Object.entries(allot)) {
    if ((amount === 60 || amount === 40) && !isWeaponSkill(skill)) errors.push(`+${amount}은 무기 Skill에만 줄 수 있습니다.`);
  }
  return errors;
}

export const allotmentComplete = (allot: AllotmentMap) => !allotmentErrors(allot).length && allotmentUse(allot).every(({ left }) => left === 0);

export function skillScores(allot: AllotmentMap) {
  return Object.fromEntries(CREATION_SKILLS.map((skill) => [skill, skillBase(skill) + (allot[skill] ?? 0)])) as Record<CreationSkill, number>;
}

export const RESISTANCES = ['Endurance', 'Resolve', 'Spellward'] as const;
export type Resistance = (typeof RESISTANCES)[number];
export const resistanceScores = (primary: Resistance) =>
  Object.fromEntries(RESISTANCES.map((id) => [id, id === primary ? 40 : 20])) as Record<Resistance, number>;

export type PersonalGoal = { name: string; objective: string; reward: string; target: number };
/** "Acid 피해 200" → 200, "누적 5,000₵ 획득" → 5000, "Overseer 처치" → 1 */
export function goalTarget(objective: string) {
  const match = /(\d{1,3}(?:,\d{3})+|\d+)/.exec(objective);
  return match ? Number(match[1].replaceAll(',', '')) : 1;
}
export const PERSONAL_GOALS: PersonalGoal[] = (tableById.get('t-personal-goals')?.rows ?? []).flatMap(({ label, cols }) =>
  label && cols?.obj && cols.rew ? [{ name: label, objective: cols.obj, reward: cols.rew, target: goalTarget(cols.obj) }] : []);
export const RECOMMENDED_GOAL = 'Overseer Overthrown';
export const goalByName = new Map(PERSONAL_GOALS.map((goal) => [goal.name, goal]));

export type StartingWeapon = {
  name: string; skill: (typeof CHARACTER_WEAPONS)[number]; damage: string; speed: string; traits: string[]; heavy: boolean;
};
const SKILL_COLUMN: Record<string, (typeof CHARACTER_WEAPONS)[number]> = {
  Bladed: 'Bladed Weapons', Bludgeoning: 'Bludgeoning Weapons', Shafted: 'Shafted Weapons', Fist: 'Unarmed Combat & Fist Weapons',
};
export const STARTING_WEAPONS: StartingWeapon[] = (tableById.get('t-weapons')?.rows ?? []).flatMap(({ label, ko, cols }) => {
  const skill = cols?.skill && SKILL_COLUMN[cols.skill];
  return label && skill ? [{
    name: label, skill, damage: cols.dmg ?? '', speed: cols.speed ?? '', traits: ko.split(/,\s*/), heavy: /Two-Handed/.test(ko),
  }] : [];
});

/** The Random Armor D10 piece and the table its grade comes from. */
export const ARMOR_PIECES = [
  { min: 1, max: 2, piece: 'Torso', grades: 't-random-torso', stats: 't-armor-torso' },
  { min: 3, max: 4, piece: 'Vambraces', grades: 't-random-limbs', stats: 't-armor-limbs' },
  { min: 5, max: 6, piece: 'Greaves', grades: 't-random-limbs', stats: 't-armor-limbs' },
  { min: 7, max: 8, piece: 'Helmet', grades: 't-random-limbs', stats: 't-helmets' },
  { min: 9, max: 10, piece: 'Shield', grades: 't-random-shield', stats: 't-shields' },
] as const;
export const armorPiece = (roll: number | null) => roll === null ? undefined : ARMOR_PIECES.find(({ min, max }) => roll >= min && roll <= max);

export type StartingArmor = { name: string; piece: string; grade: string; integrity?: string; detail: string; heavy: boolean; magic: boolean };
export function startingArmor(pieceRoll: number | null, gradeRoll: number | null): StartingArmor | null {
  const piece = armorPiece(pieceRoll);
  if (!piece || gradeRoll === null) return null;
  const row = journalRow(piece.grades, gradeRoll);
  if (!row) return null;
  const grade = journalRowName(row);
  if (/Magic|마법/i.test(`${row.label ?? ''} ${row.ko}`)) {
    return { name: '마법 흉갑', piece: piece.piece, grade: '마법', detail: '마법 아이템 생성 절차로 속성을 정한다(원문 224쪽).', heavy: false, magic: true };
  }
  const stats = tableById.get(piece.stats)?.rows.find((item: TableRow) => item.label === grade);
  const name = piece.piece === 'Torso' ? grade : `${grade} ${piece.piece}`;
  const integrity = stats?.cols?.int;
  const detail = piece.piece === 'Shield'
    ? `Parry ${stats?.cols?.parry ?? '?'} · Integrity ${integrity ?? '?'}`
    : `Armor ${stats?.cols?.prot ?? '?'} · Integrity ${integrity ?? '?'}${stats?.cols?.man ? ` · 기동성 ${stats.cols.man}` : ''}${stats?.cols?.note ? ` · ${stats.cols.note}` : ''}`;
  return { name, piece: piece.piece, grade, integrity, detail, heavy: piece.piece === 'Shield' && grade === 'Wall', magic: false };
}

export const STARTING_SUPPLIES = [
  { id: 'cooking', name: 'Cooking Ingredients', dice: 'D10' },
  { id: 'crafting', name: 'Crafting Supplies', dice: 'D10+5' },
  { id: 'coins', name: '동전', dice: 'D20' },
] as const;
export type SupplyId = (typeof STARTING_SUPPLIES)[number]['id'];

export type StartMode = 'gear' | 'empty';
export interface CreationDraft {
  name: string;
  crime: number | null;
  attributes: Partial<Record<AttributeId, RollResult>>;
  allot: AllotmentMap;
  resistance: Resistance | '';
  masteries: string[];
  goals: string[];
  start: StartMode;
  weapon: string;
  armorPiece: number | null;
  armorGrade: number | null;
  supplies: Partial<Record<SupplyId, RollResult>>;
}

export const EMPTY_CREATION: CreationDraft = {
  name: '', crime: null, attributes: {}, allot: {}, resistance: '', masteries: [], goals: [], start: 'gear',
  weapon: '', armorPiece: null, armorGrade: null, supplies: {},
};

export const CREATION_STEPS = [
  { id: 'attributes', numeral: 'I', label: '속성' },
  { id: 'skills', numeral: 'II', label: 'Skill' },
  { id: 'resistance', numeral: 'III', label: 'Resistance' },
  { id: 'masteries', numeral: 'IV', label: 'Mastery' },
  { id: 'goals', numeral: 'V', label: 'Goal' },
  { id: 'gear', numeral: 'VI', label: '장비' },
  { id: 'summary', numeral: 'VII', label: '정리' },
] as const;
export type CreationStep = (typeof CREATION_STEPS)[number]['id'];

export const mainWeaponSkill = (draft: CreationDraft) => {
  const chosen = STARTING_WEAPONS.find(({ name }) => name === draft.weapon);
  if (draft.start === 'gear' && chosen) return chosen.skill;
  return CHARACTER_WEAPONS.find((skill) => draft.allot[skill] === 60);
};

export function armorFor(draft: CreationDraft) {
  return draft.start === 'gear' ? startingArmor(draft.armorPiece, draft.armorGrade) : null;
}

/** Which steps are finished; the summary is done once all others are. */
export function stepStatus(draft: CreationDraft): Record<CreationStep, boolean> {
  const attributes = CREATION_ATTRIBUTES.every(({ id }) => !!draft.attributes[id]);
  const skills = allotmentComplete(draft.allot);
  const resistance = !!draft.resistance;
  const masteries = draft.masteries.length === 2 && new Set(draft.masteries).size === 2;
  const goals = draft.goals.length === 2 && new Set(draft.goals).size === 2;
  const gear = draft.start === 'empty' || (!!draft.weapon && !!armorFor(draft) && STARTING_SUPPLIES.every(({ id }) => !!draft.supplies[id]));
  return { attributes, skills, resistance, masteries, goals, gear, summary: attributes && skills && resistance && masteries && goals && gear };
}

const pick = <T,>(items: readonly T[]) => items[rollDie(items.length) - 1];

/** Gives every unused allotment to a random Skill that has none, +60 and +40 to weapon Skills. Assigned Skills stay. */
export function fillAllotment(allot: AllotmentMap): AllotmentMap {
  const next: AllotmentMap = allotmentErrors(allot).length ? {} : { ...allot };
  for (const { amount, weapon, left } of allotmentUse(next)) {
    for (let index = 0; index < left; index += 1) {
      const pool = CREATION_SKILLS.filter((skill) => !next[skill] && (!weapon || isWeaponSkill(skill)));
      if (!pool.length) break;
      next[pick(pool)] = amount;
    }
  }
  return next;
}
const rolled = (dice: string) => roll(dice)!;
export const masteryFromRoll = (value: number) => {
  const name = journalRow('t-random-mastery', value)?.label;
  return masteryCatalog.find((item) => item.name === name)?.id;
};

/** Random Mastery (D20, p.222) for every empty slot, re-rolling a Mastery that is already taken. */
export function rollMasteries(current: string[]) {
  const table = tableById.get('t-random-mastery')!;
  const next = [...current];
  while (next.length < 2) {
    const id = masteryFromRoll(rollTable(table)!);
    if (id && !next.includes(id)) next.push(id);
  }
  return next;
}

/** Rolls Random Armor until the result is ordinary gear unless magic armor is acceptable. */
export function rollArmor() {
  const pieceRoll = rollDie(10);
  const piece = armorPiece(pieceRoll)!;
  return { armorPiece: pieceRoll, armorGrade: rollTable(tableById.get(piece.grades)!)! };
}

/**
 * Fills every empty part of the draft: dice are rolled, choices are made at random
 * (the recommended Personal Goal first, a starting weapon that uses the +60 Skill). Filled parts stay as they are.
 */
export function autoCreate(draft: CreationDraft): CreationDraft {
  const attributes = { ...draft.attributes };
  for (const { id, dice } of CREATION_ATTRIBUTES) attributes[id] ??= rolled(dice);
  const allot = allotmentComplete(draft.allot) ? draft.allot : fillAllotment(draft.allot);
  const goals = [...draft.goals];
  if (goals.length < 2 && !goals.includes(RECOMMENDED_GOAL)) goals.push(RECOMMENDED_GOAL);
  while (goals.length < 2) {
    const goal = pick(PERSONAL_GOALS).name;
    if (!goals.includes(goal)) goals.push(goal);
  }
  const next: CreationDraft = {
    ...draft,
    crime: draft.crime ?? rollTable(tableById.get('t-crime')!),
    attributes,
    allot,
    resistance: draft.resistance || pick(RESISTANCES),
    masteries: rollMasteries(draft.masteries),
    goals,
  };
  if (next.start === 'empty') return next;
  const skill = CHARACTER_WEAPONS.find((name) => allot[name] === 60);
  const weapons = STARTING_WEAPONS.filter((weapon) => weapon.skill === skill);
  const supplies = { ...draft.supplies };
  for (const { id, dice } of STARTING_SUPPLIES) supplies[id] ??= rolled(dice);
  const armor = draft.armorPiece !== null && draft.armorGrade !== null ? {} : rollArmor();
  return { ...next, weapon: draft.weapon || pick(weapons.length ? weapons : STARTING_WEAPONS).name, supplies, ...armor };
}

export function crimeName(value: number | null) {
  const row = journalRow('t-crime', value);
  return row ? `${row.ko} (${row.label})` : '';
}

export type GearLine = { name: string; count: number; weight: 'normal' | 'heavy' | 'light' | 'coins'; integrity?: string; location: 'equipped' | 'pack' };

/** Starting gear for Further Runs (p.67), ready for the paper sheet and the gear ledger. */
export function startingGear(draft: CreationDraft): GearLine[] {
  if (draft.start !== 'gear') return [];
  const weapon = STARTING_WEAPONS.find(({ name }) => name === draft.weapon);
  const armor = armorFor(draft);
  const supply = (id: SupplyId) => draft.supplies[id]?.total;
  const lines: GearLine[] = [];
  if (weapon) lines.push({ name: weapon.name, count: 1, weight: weapon.heavy ? 'heavy' : 'normal', location: 'equipped' });
  if (armor) lines.push({ name: armor.name, count: 1, weight: armor.heavy ? 'heavy' : 'normal', integrity: armor.integrity, location: 'equipped' });
  lines.push({ name: 'Torch', count: 1, weight: 'light', location: 'pack' });
  const cooking = supply('cooking');
  const crafting = supply('crafting');
  const coins = supply('coins');
  if (cooking) lines.push({ name: 'Cooking Ingredients', count: cooking, weight: 'light', location: 'pack' });
  if (crafting) lines.push({ name: 'Crafting Supplies', count: crafting, weight: 'light', location: 'pack' });
  if (coins) lines.push({ name: '동전', count: coins, weight: 'coins', location: 'pack' });
  return lines;
}

/** The character record and the skill values the play desk reuses. */
export function creationRecord(draft: CreationDraft): { character: PlayCharacter; skills: Record<string, number> } {
  const scores = skillScores(draft.allot);
  const resistance = draft.resistance ? resistanceScores(draft.resistance) : undefined;
  const weapon = mainWeaponSkill(draft);
  const defense = weapon && scores[weapon] > scores.Dodge ? weapon : 'Dodge';
  return {
    character: {
      ...(draft.name.trim() ? { name: draft.name.trim().slice(0, 40) } : {}),
      level: 1,
      xp: 0,
      ...(weapon ? { weapon } : {}),
      defense,
      masteries: draft.masteries.map((id) => ({ id, tier: 1 })),
      goals: draft.goals.map((name) => ({ name, progress: 0 })),
      exhaustion: 0,
      ...(draft.attributes.Sanity ? { sanity: draft.attributes.Sanity.total, sanityMax: draft.attributes.Sanity.total } : {}),
    },
    skills: { ...scores, ...(resistance ?? {}) },
  };
}

/** What to copy onto the paper sheet, one line per box. */
export function creationLines(draft: CreationDraft) {
  const scores = skillScores(draft.allot);
  const lines: { label: string; text: string }[] = [];
  const name = draft.name.trim();
  lines.push({ label: '생존자', text: [name || '이름 없음', '레벨 1', 'XP 0', crimeName(draft.crime) && `죄목 ${crimeName(draft.crime)}`].filter(Boolean).join(' · ') });
  lines.push({ label: '속성', text: [...CREATION_ATTRIBUTES.map(({ id }) => `${id} ${draft.attributes[id]?.total ?? '?'}`), 'Exhaustion 0'].join(' · ') });
  lines.push({ label: 'Skill', text: CREATION_SKILLS.map((skill) => `${skill} ${scores[skill]}`).join(' · ') });
  if (draft.resistance) {
    const res = resistanceScores(draft.resistance);
    lines.push({ label: 'Resistance', text: RESISTANCES.map((id) => `${id} ${res[id]}`).join(' · ') });
  }
  const masteries = draft.masteries.flatMap((id) => {
    const mastery = masteryCatalog.find((item) => item.id === id);
    return mastery ? [`${mastery.name} (Tier 1 ${mastery.abilities[0].name} · Feature ${mastery.feature.name})`] : [];
  });
  if (masteries.length) lines.push({ label: 'Mastery', text: `${masteries.join(' · ')} · Ability Point 2점 사용` });
  if (draft.goals.length) lines.push({ label: 'Personal Goal', text: draft.goals.join(' · ') });
  const gear = startingGear(draft);
  lines.push({ label: '장비', text: draft.start === 'empty' ? '시작 장비 없음' : gear.map(({ name, count, integrity }) =>
    name === '동전' ? `${count}₵` : `${name}${count > 1 ? ` ${count}` : ''}${integrity ? ` (${integrity})` : ''}`).join(' · ') });
  return lines;
}

/** Puts the starting gear into the gear ledger: counts are added to items of the same name, new items are created. */
export function startingGearToLedger(ledger: GearLedger, lines: GearLine[], source: string): { ledger: GearLedger } | { error: string } {
  let current = ledger;
  for (const [index, line] of lines.entries()) {
    const existing = !line.integrity && current.items.find((item) => gearKey(item.name) === gearKey(line.name) && item.integrity !== 'broken');
    const item: GearItem = existing ? { ...existing, count: existing.count + line.count } : {
      id: crypto.randomUUID(), name: line.name, count: line.count, location: line.location, weight: line.weight,
      ...(line.integrity && /^D(?:4|6|8|10|12)$/.test(line.integrity) ? { integrity: line.integrity as GearItem['integrity'] } : {}),
    };
    const result = saveGearItem(current, item, `시작 장비 · ${line.name}`, `${source}:${index}`);
    if ('error' in result) return result;
    current = result.ledger;
  }
  return { ledger: current };
}
