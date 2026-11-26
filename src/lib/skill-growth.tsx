import { useCallback } from 'react';
import type { CheckResult } from './dice';
import { usePlayDraft } from './play-draft';
import { isSkillDouble, skillCriticalEffect } from './skill-criticals';

export const SKILL_GROWTH_SLOT = 'pendingSkillGrowth';
const SKILL_CRITICAL_SLOT = 'skillCriticalHistory';
const NO_CRITICALS: readonly string[] = [];

export const GROWTH_SKILLS = [
  'Acrobatics', 'Athletics', 'Dodge', 'Medicine', 'Perception', 'Reason',
  'Scavenge', 'Stealth', 'Thievery', 'Bladed Weapons', 'Bludgeoning Weapons',
  'Shafted Weapons', 'Unarmed Combat & Fist Weapons',
] as const;

export type GrowthSkill = typeof GROWTH_SKILLS[number];
const EMPTY: readonly GrowthSkill[] = [];
const byName = new Map(GROWTH_SKILLS.map((skill) => [skill.toLowerCase(), skill]));
byName.set('scavenging', 'Scavenge');
byName.set('unarmed', 'Unarmed Combat & Fist Weapons');
byName.set('unarmed combat', 'Unarmed Combat & Fist Weapons');
byName.set('fist weapons', 'Unarmed Combat & Fist Weapons');

function normalizedName(skill: string) {
  return skill.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function skillGrowthName(skill: string) {
  return byName.get(normalizedName(skill));
}

export function isGrowthSkill(skill: string) {
  return skillGrowthName(skill) !== undefined;
}

export function skillGrowthKey(skill: string) {
  return normalizedName(skillGrowthName(skill) ?? skill);
}

export function usePendingSkillGrowth(): readonly GrowthSkill[] {
  return (usePlayDraft()?.slots[SKILL_GROWTH_SLOT] as readonly GrowthSkill[] | undefined) ?? EMPTY;
}

export function useMarkSkillGrowth() {
  const draft = usePlayDraft();
  const write = draft?.write;
  const generation = draft?.generation ?? 0;
  return useCallback((skill: string) => {
    const name = skillGrowthName(skill);
    if (!name) return;
    write?.(generation, SKILL_GROWTH_SLOT, (previous) =>
      previous.includes(name) ? previous : [...previous, name], EMPTY);
  }, [generation, write]);
}

export function useSkillCriticalHistory(): readonly string[] {
  return (usePlayDraft()?.slots[SKILL_CRITICAL_SLOT] as readonly string[] | undefined) ?? NO_CRITICALS;
}

export function useRecordSkillCritical() {
  const draft = usePlayDraft();
  const write = draft?.write;
  const generation = draft?.generation ?? 0;
  const markGrowth = useMarkSkillGrowth();
  return useCallback((skill: string, result: CheckResult, effectSkill: string | null = skill, effectOverride?: string) => {
    if (!isSkillDouble(result.outcome)) return;
    const effect = effectOverride ?? (effectSkill ? skillCriticalEffect(effectSkill, result.outcome) : undefined);
    const label = effectSkill && effectSkill !== skill ? `${effectSkill} (${skill})` : skill;
    const line = [label, `D100 ${result.raw.value === 100 ? '00' : result.raw.value}`,
      result.outcome === 'critical' ? '대성공' : '대실패', effect].filter(Boolean).join(' · ');
    write?.(generation, SKILL_CRITICAL_SLOT, (previous) => [...previous, line], NO_CRITICALS);
    markGrowth(skill);
  }, [generation, markGrowth, write]);
}

export function useClearSkillGrowth() {
  const draft = usePlayDraft();
  const write = draft?.write;
  const generation = draft?.generation ?? 0;
  return useCallback((skill: string) => {
    const name = skillGrowthName(skill);
    if (!name) return;
    write?.(generation, SKILL_GROWTH_SLOT, (previous) =>
      previous.includes(name) ? previous.filter((item) => item !== name) : previous, EMPTY);
  }, [generation, write]);
}
