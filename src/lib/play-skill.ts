import { encounterInteger } from './encounter-start';
import { GROWTH_SKILLS } from './skill-growth';

export const SKILL_PRESETS_SLOT = 'skillPresets';
export const PLAY_SKILL_PRESETS = [...GROWTH_SKILLS, 'Parry', 'Endurance', 'Resolve', 'Spellward', 'Initiative'] as const;
export const SKILL_MODIFIER_REASONS = ['난이도', '상태·어둠', '장비·특성', '기타'] as const;
export type SkillModifier = { reason: string; amount: string };
export type SkillTerm = { label: string; value: number };

export function skillPresetName(value: string | undefined) {
  return PLAY_SKILL_PRESETS.find((skill) => skill.toLowerCase() === value?.trim().toLowerCase());
}

export function isSkillPresetRecord(value: unknown) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([name, score]) => skillPresetName(name) === name && Number.isSafeInteger(score) && score >= 0);
}

export function isSkillModifierList(value: unknown): value is SkillModifier[] {
  return Array.isArray(value) && value.length <= 8 && value.every((item) => item && typeof item === 'object'
    && SKILL_MODIFIER_REASONS.some((reason) => reason === item.reason) && typeof item.amount === 'string' && item.amount.length <= 24);
}

export function skillBreakdown(raw: string, modifiers: SkillModifier[] = [], fixed: SkillTerm[] = []) {
  const base = encounterInteger(raw);
  if (base === null) return null;
  const terms = fixed.filter(({ value }) => value !== 0);
  for (const { reason, amount } of modifiers) {
    if (!amount.trim()) continue;
    const value = encounterInteger(amount);
    if (value === null) return null;
    if (value) terms.push({ label: reason, value });
  }
  let total = base;
  for (const { value } of terms) {
    total += value;
    if (!Number.isSafeInteger(total)) return null;
  }
  return { base, total, terms };
}

export function formatSkillBreakdown({ base, terms, total }: NonNullable<ReturnType<typeof skillBreakdown>>) {
  if (!terms.length) return `기본 ${base}`;
  return `기본 ${base}${terms.map(({ label, value }) => ` · ${label} ${value > 0 ? '+' : '−'}${Math.abs(value)}`).join('')} = ${total}`;
}
