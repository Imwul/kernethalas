import { exhaustionDisadvantage } from './character-progress';
import type { Edge } from './dice';
import { CHARACTER_WEAPONS, type usePlayCharacter } from './play-character';
import type { SkillTerm } from './play-skill';

type Character = ReturnType<typeof usePlayCharacter>;
const ROT_SKILLS: readonly string[] = [...CHARACTER_WEAPONS, '무기 Skill', 'Dodge', 'Athletics', 'Acrobatics'];

/** Defaults for an unrolled check. An explicit edge still lets the player account for other effects at the table. */
export function pcCheckModifiers(pc: Character, skill: string, perk?: 'Scholar' | 'Trap Buster', rot = pc?.character.rotStage ?? 0) {
  const exhausted = rot < 7 && exhaustionDisadvantage(pc?.exhaustion);
  const rotDisadvantage = rot >= 6 && ROT_SKILLS.includes(skill);
  const disadvantage = exhausted || rotDisadvantage;
  const edge: Edge = disadvantage === !!perk ? 'none' : disadvantage ? 'disadvantage' : 'advantage';
  const madness = skill === 'Resolve' ? pc?.madness.resolve ?? 0 : skill === 'Scavenge' ? pc?.madness.scavenging ?? 0 : 0;
  const fixed: SkillTerm[] = madness ? [{ label: '광기', value: -madness }] : [];
  return {
    edge,
    fixed,
    notes: [
      ...(exhausted ? [`Exhaustion ${pc?.exhaustion} · 모든 판정 불리`] : []),
      ...(rotDisadvantage ? [`부패병 ${rot}단계 · ${skill} 불리`] : []),
      ...(perk ? [`${perk} · 유리`] : []),
      ...(disadvantage && perk ? ['둘 다 해당 · 직접 고르세요'] : []),
      ...(madness ? [`광기 · ${skill} −${madness}`] : []),
    ],
  };
}
