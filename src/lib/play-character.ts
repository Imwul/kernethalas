import { usePlayDraft } from './play-draft';
import { SKILL_PRESETS_SLOT, skillPresetName } from './play-skill';

/**
 * What the player copies once from the paper sheet: level, main weapon, defense and learned Masteries.
 * Skill values live in the skill preset slot, so the Skill adjustments and this tab share them.
 */
export const PLAY_CHARACTER_SLOT = 'pcCharacter';
export const CHARACTER_WEAPONS = ['Bladed Weapons', 'Bludgeoning Weapons', 'Shafted Weapons', 'Unarmed Combat & Fist Weapons'] as const;
export const CHARACTER_DEFENSES = ['Dodge', ...CHARACTER_WEAPONS] as const;
export const CHARACTER_MASTERY_LIMIT = 6;

export type CharacterMastery = { id: string; tier: number };
export type PlayCharacter = {
  level?: number;
  weapon?: string;
  defense?: string;
  masteries?: CharacterMastery[];
};

const EMPTY_CHARACTER: PlayCharacter = {};
const EMPTY_PRESETS: Record<string, number> = {};

const isLevel = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 99;
const oneOf = (items: readonly string[]) => (value: unknown) => typeof value === 'string' && items.includes(value);

export function isPlayCharacter(value: unknown): value is PlayCharacter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { level, weapon, defense, masteries, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return false;
  if (level !== undefined && !isLevel(level)) return false;
  if (weapon !== undefined && !oneOf(CHARACTER_WEAPONS)(weapon)) return false;
  if (defense !== undefined && !oneOf(CHARACTER_DEFENSES)(defense)) return false;
  if (masteries === undefined) return true;
  return Array.isArray(masteries) && masteries.length <= CHARACTER_MASTERY_LIMIT
    && masteries.every((item) => !!item && typeof item === 'object' && typeof item.id === 'string' && /^m-[a-z0-9-]{1,60}$/.test(item.id)
      && Number.isSafeInteger(item.tier) && item.tier >= 1 && item.tier <= 10 && Object.keys(item).length === 2)
    && new Set(masteries.map(({ id }) => id)).size === masteries.length;
}

/** Reads and edits the character record; null outside play mode. */
export function usePlayCharacter() {
  const play = usePlayDraft();
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
    update(patch: Partial<PlayCharacter>) {
      play.write(play.generation, PLAY_CHARACTER_SLOT, (previous: PlayCharacter) => {
        const next: PlayCharacter = { ...previous, ...patch };
        for (const key of Object.keys(next) as (keyof PlayCharacter)[]) if (next[key] === undefined) delete next[key];
        return next;
      }, EMPTY_CHARACTER);
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
