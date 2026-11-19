import type { CreatureRecord } from './entries/creatures';

interface TypeDefense {
  immuneConditions?: string[];
  vulnerable?: string[];
  restored?: string[];
  elementalAffinity?: boolean;
}

// Core pp.129–131. Condition immunity and a damage type are separate effects.
export const CREATURE_TYPE_DEFENSES: Record<string, TypeDefense> = {
  Animal: {},
  Astral: { immuneConditions: ['Bleeding', 'Poisoned', 'Sickened', 'Frightened'] },
  Construct: { immuneConditions: ['Charmed', 'Poisoned', 'Bleeding', 'Sickened', 'Frightened', 'Sleeping'] },
  Demon: { immuneConditions: ['Poisoned'], vulnerable: ['Holy'], restored: ['Infernal'] },
  Elemental: { immuneConditions: ['Bleeding', 'Sickened', 'Poisoned'], elementalAffinity: true },
  Humanoid: {},
  Plant: { immuneConditions: ['Frightened', 'Blinded'], vulnerable: ['Fire'] },
  Undead: { immuneConditions: ['Bleeding', 'Sickened', 'Poisoned', 'Frightened'], vulnerable: ['Holy'], restored: ['Necrotic'] },
};

export function describeTypeDefense(type: TypeDefense): string {
  const details = [
    type.vulnerable && `${type.vulnerable.join(', ')} 피해에 취약하다.`,
    type.restored && `${type.restored.join(', ')} 피해로 회복한다.`,
    type.elementalAffinity && '자신이 속한 원소의 피해로 회복한다.',
    type.immuneConditions && `${type.immuneConditions.join(', ')} 상태에 면역이다.`,
  ].filter(Boolean);
  return details.length ? details.join(' ') : '유형 공통 효과 없음. 개별 생물의 특성을 확인한다.';
}

const SUMMONED_AFFINITIES: Record<string, string> = {
  'cr-fire-elemental': 'Fire',
  'cr-frost-elemental': 'Cold',
};

export function creatureDefenses(creature: Pick<CreatureRecord, 'id' | 'types' | 'traits'>) {
  const vulnerable = new Set<string>();
  let resistsNonMagicalPhysical = false;
  const restored = new Set<string>();
  const immuneConditions = new Set<string>();
  const otherTraits: string[] = [];

  for (const kind of creature.types) {
    const type = CREATURE_TYPE_DEFENSES[kind];
    type?.vulnerable?.forEach((damage) => vulnerable.add(damage));
    type?.restored?.forEach((damage) => restored.add(damage));
    type?.immuneConditions?.forEach((condition) => immuneConditions.add(condition));
    if (type?.elementalAffinity && SUMMONED_AFFINITIES[creature.id]) restored.add(SUMMONED_AFFINITIES[creature.id]);
  }

  for (const trait of creature.traits) {
    const affinity = /^Elemental Affinity:\s*(\w+)$/.exec(trait);
    const restoredBy = /^Restored by (\w+) damage$/.exec(trait);
    const vulnerableTo = /^Vulnerable to (\w+) damage$/.exec(trait);
    if (affinity) restored.add(affinity[1]);
    else if (restoredBy) restored.add(restoredBy[1]);
    else if (vulnerableTo) vulnerable.add(vulnerableTo[1]);
    else if (trait === 'Resistant to all Physical, non-Magical damage') resistsNonMagicalPhysical = true;
    else if (!trait.startsWith('Ruthlessness (')) otherTraits.push(trait);
  }

  return {
    vulnerable: [...vulnerable],
    resistsNonMagicalPhysical,
    restored: [...restored],
    immuneConditions: [...immuneConditions],
    otherTraits,
  };
}
