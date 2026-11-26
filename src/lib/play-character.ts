import { createContext, useContext } from 'react';
import { usePlayDraft } from './play-draft';
import { SKILL_PRESETS_SLOT, skillPresetName } from './play-skill';

/**
 * What the player copies once from the paper sheet: name, level, XP, main weapon, defense, Masteries,
 * Personal Goals and Exhaustion. Skill values live in the skill preset slot, so the Skill adjustments and this tab share them.
 * XP and Exhaustion are the values carried into the current place; what this place's records add is shown on top
 * and folded in when the player moves on.
 */
export const PLAY_CHARACTER_SLOT = 'pcCharacter';
export const CHARACTER_WEAPONS = ['Bladed Weapons', 'Bludgeoning Weapons', 'Shafted Weapons', 'Unarmed Combat & Fist Weapons'] as const;
export const CHARACTER_DEFENSES = ['Dodge', ...CHARACTER_WEAPONS] as const;
/** Older saves allowed up to six; the rules allow two plus an Amulet Mastery (p.21). */
export const CHARACTER_MASTERY_LIMIT = 6;
export const BASE_MASTERY_LIMIT = 2;
export const ACTIVE_GOAL_LIMIT = 2;
export const XP_TO_LEVEL = 1000;

export type CharacterMastery = { id: string; tier: number };
export type CharacterGoal = { name: string; progress: number };
export type PlayCharacter = {
  name?: string;
  level?: number;
  xp?: number;
  weapon?: string;
  defense?: string;
  masteries?: CharacterMastery[];
  /** The worn Amulet's Mastery; tier is how many Amulet abilities are unlocked (kept when the Amulet is swapped). */
  amulet?: CharacterMastery;
  goals?: CharacterGoal[];
  completedGoals?: string[];
  exhaustion?: number;
  /** current Sanity carried into this place (this place's records add on top) and the sheet's maximum */
  sanity?: number;
  sanityMax?: number;
  /** Madness table results so far (p.91); most of them stack */
  madness?: number[];
  perks?: string[];
};

export const PERKS = ['Living Shadow', 'Lucky Find', 'Precision Striker', 'Scavenger', 'Scholar', 'Trap Buster'] as const;
/** Cumulative Madness effects (p.91) read from the results so far. */
export function madnessEffects(results: readonly number[] = []) {
  const count = (result: number) => results.filter((value) => value === result).length;
  return {
    rollPenalty: count(2), toughnessMax: count(3), extraSanityLoss: count(4), scavenging: count(5) * 10,
    resolve: count(6) * 10, xpLoss: count(7) * 10, dead: results.includes(1),
  };
}

const EMPTY_CHARACTER: PlayCharacter = {};
const EMPTY_PRESETS: Record<string, number> = {};

const isLevel = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 99;
const isCount = (value: unknown, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max;
const oneOf = (items: readonly string[]) => (value: unknown) => typeof value === 'string' && items.includes(value);
const isMastery = (item: unknown, min = 1): item is CharacterMastery => !!item && typeof item === 'object'
  && typeof (item as CharacterMastery).id === 'string' && /^m-[a-z0-9-]{1,60}$/.test((item as CharacterMastery).id)
  && Number.isSafeInteger((item as CharacterMastery).tier) && (item as CharacterMastery).tier >= min && (item as CharacterMastery).tier <= 10
  && Object.keys(item).length === 2;
const isName = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 60;

export function isPlayCharacter(value: unknown): value is PlayCharacter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { name, level, xp, weapon, defense, masteries, amulet, goals, completedGoals, exhaustion, sanity, sanityMax, madness, perks, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return false;
  if (name !== undefined && !(typeof name === 'string' && name.length <= 40)) return false;
  if (level !== undefined && !isLevel(level)) return false;
  // stored values may sit below zero while this place's records add to them (see currentProgress)
  if (xp !== undefined && !(Number.isSafeInteger(xp) && Math.abs(xp as number) <= 1_000_000)) return false;
  if (exhaustion !== undefined && !(Number.isSafeInteger(exhaustion) && Math.abs(exhaustion as number) <= 99)) return false;
  if (sanity !== undefined && !(Number.isSafeInteger(sanity) && Math.abs(sanity as number) <= 999)) return false;
  if (sanityMax !== undefined && !isCount(sanityMax, 999)) return false;
  if (madness !== undefined && !(Array.isArray(madness) && madness.length <= 100 && madness.every((result) => Number.isSafeInteger(result) && result >= 1 && result <= 10))) return false;
  if (perks !== undefined && !(Array.isArray(perks) && perks.every(oneOf(PERKS)) && new Set(perks).size === perks.length)) return false;
  if (weapon !== undefined && !oneOf(CHARACTER_WEAPONS)(weapon)) return false;
  if (defense !== undefined && !oneOf(CHARACTER_DEFENSES)(defense)) return false;
  if (amulet !== undefined && !isMastery(amulet, 0)) return false;
  if (goals !== undefined && !(Array.isArray(goals) && goals.length <= ACTIVE_GOAL_LIMIT && goals.every((goal) => !!goal && typeof goal === 'object'
    && isName(goal.name) && isCount(goal.progress, 1_000_000) && Object.keys(goal).length === 2)
    && new Set(goals.map(({ name: goal }) => goal)).size === goals.length)) return false;
  if (completedGoals !== undefined && !(Array.isArray(completedGoals) && completedGoals.length <= 100 && completedGoals.every(isName)
    && new Set(completedGoals).size === completedGoals.length)) return false;
  if (masteries === undefined) return true;
  return Array.isArray(masteries) && masteries.length <= CHARACTER_MASTERY_LIMIT
    && masteries.every((item) => isMastery(item))
    && new Set(masteries.map(({ id }) => id)).size === masteries.length
    && (amulet === undefined || !masteries.some(({ id }) => id === (amulet as CharacterMastery).id));
}

/** Ability Points: two at creation, one more per level (pp.21, 62). */
export function abilityPoints(character: PlayCharacter) {
  const used = (character.masteries ?? []).reduce((total, { tier }) => total + tier, 0) + (character.amulet?.tier ?? 0);
  const total = character.level === undefined ? undefined : character.level + 1;
  return { used, total, left: total === undefined ? undefined : total - used };
}

/** What this place's records add to XP and Exhaustion, provided by the play desk. */
export type RoomProgress = {
  xp: number;
  exhaustion: number;
  sanity: number;
  xpItems: string[];
  exhaustionItems: string[];
  sanityItems: string[];
  /** Personal Goal progress this place's records show (kills by type, Lore Books, …) */
  goals: Record<string, number>;
};
export const NO_ROOM_PROGRESS: RoomProgress = { xp: 0, exhaustion: 0, sanity: 0, xpItems: [], exhaustionItems: [], sanityItems: [], goals: {} };
export const CharacterRoomContext = createContext<RoomProgress>(NO_ROOM_PROGRESS);

export function currentProgress(character: PlayCharacter, room: RoomProgress) {
  const sanity = character.sanity === undefined ? undefined : character.sanity + room.sanity;
  return {
    xp: character.xp === undefined ? undefined : Math.max(0, character.xp + room.xp),
    exhaustion: character.exhaustion === undefined ? undefined : Math.max(0, character.exhaustion + room.exhaustion),
    sanity: sanity === undefined ? undefined : Math.max(0, character.sanityMax === undefined ? sanity : Math.min(sanity, character.sanityMax)),
    goals: (character.goals ?? []).map((goal) => ({ ...goal, progress: goal.progress + (room.goals[goal.name] ?? 0) })),
  };
}

/** Carries this place's XP and Exhaustion into the record before the next place starts. */
export function foldRoomProgress(character: PlayCharacter, room: RoomProgress): PlayCharacter {
  const now = currentProgress(character, room);
  return {
    ...character,
    ...(now.xp !== undefined ? { xp: Math.min(now.xp, 1_000_000) } : {}),
    ...(now.exhaustion !== undefined ? { exhaustion: Math.min(now.exhaustion, 99) } : {}),
    ...(now.sanity !== undefined ? { sanity: Math.min(now.sanity, 999) } : {}),
    ...(character.goals ? { goals: now.goals.map((goal) => ({ ...goal, progress: Math.min(goal.progress, 1_000_000) })) } : {}),
  };
}

/** Reads and edits the character record; null outside play mode. */
export function usePlayCharacter() {
  const play = usePlayDraft();
  const room = useContext(CharacterRoomContext);
  if (!play) return null;
  const character = (play.slots[PLAY_CHARACTER_SLOT] as PlayCharacter | undefined) ?? EMPTY_CHARACTER;
  const presets = (play.slots[SKILL_PRESETS_SLOT] as Record<string, number> | undefined) ?? EMPTY_PRESETS;
  const skill = (name: string | undefined) => {
    const key = skillPresetName(name);
    return key && Object.hasOwn(presets, key) ? String(presets[key]) : '';
  };
  return {
    character,
    presets,
    level: character.level === undefined ? '' : String(character.level),
    skill,
    /** The PC's attack value from the main weapon, and the defense value from the chosen defense skill. */
    attackSkill: skill(character.weapon),
    defenseSkill: skill(character.defense),
    room,
    /** XP, Exhaustion, Sanity and goal progress including what this place has recorded so far. */
    ...currentProgress(character, room),
    madness: madnessEffects(character.madness),
    hasPerk: (perk: (typeof PERKS)[number]) => !!character.perks?.includes(perk),
    points: abilityPoints(character),
    update(patch: Partial<PlayCharacter>) {
      play.write(play.generation, PLAY_CHARACTER_SLOT, (previous: PlayCharacter) => {
        const next: PlayCharacter = { ...previous, ...patch };
        for (const key of Object.keys(next) as (keyof PlayCharacter)[]) if (next[key] === undefined) delete next[key];
        return next;
      }, EMPTY_CHARACTER);
    },
    /** Replaces the whole record (a new survivor) and merges the given Skill values. */
    replace(next: PlayCharacter, skills?: Record<string, number>) {
      play.write(play.generation, PLAY_CHARACTER_SLOT, next, EMPTY_CHARACTER);
      if (!skills) return;
      const known = Object.fromEntries(Object.entries(skills).flatMap(([name, score]) => {
        const key = skillPresetName(name);
        return key && Number.isSafeInteger(score) && score >= 0 ? [[key, score]] : [];
      }));
      play.write(play.generation, SKILL_PRESETS_SLOT, (previous: Record<string, number>) => ({ ...previous, ...known }), EMPTY_PRESETS);
    },
    /** Puts back an exact earlier record and Skill values (undo of a replace). */
    restore(previous: PlayCharacter, previousPresets: Record<string, number>) {
      play.write(play.generation, PLAY_CHARACTER_SLOT, previous, EMPTY_CHARACTER);
      play.write(play.generation, SKILL_PRESETS_SLOT, previousPresets, EMPTY_PRESETS);
    },
    setSkill(name: string, value: number | undefined) {
      const key = skillPresetName(name);
      if (!key) return;
      play.write(play.generation, SKILL_PRESETS_SLOT, (previous: Record<string, number>) => {
        const next = { ...previous };
        if (value === undefined) delete next[key];
        else next[key] = value;
        return next;
      }, EMPTY_PRESETS);
    },
  };
}
