import { creatureActionKo } from '../content/creature-actions';
import type { CreatureRecord } from '../content/entries/creatures';
import { isPhysicalDamage, type DamageReactions, type DamageType } from './damage';

type Modifier = {
  reaction: 'immune' | 'resistant' | 'vulnerable';
  type?: DamageType;
  except?: DamageType;
  physical?: true;
  nonMagical?: true;
};
type Effect = { name: string; modifiers: readonly Modifier[] };

// These are action effects, so their duration remains a player decision.
const EFFECTS: Record<string, readonly Effect[]> = {
  'cr-astral-beast': [{ name: 'Nebula Shield', modifiers: [{ reaction: 'resistant' }] }],
  'cr-wraithskull': [{ name: 'Ethereal Phantasm', modifiers: [{ reaction: 'immune', nonMagical: true }] }],
  'cr-dreadlord': [{ name: 'Shroud of Darkness', modifiers: [{ reaction: 'resistant', except: 'Holy' }] }],
  'cr-gorehoof': [
    { name: 'Bloodlust Frenzy', modifiers: [{ reaction: 'vulnerable' }] },
    { name: 'Endurance Surge', modifiers: [{ reaction: 'resistant', physical: true }] },
  ],
  'cr-infernal-tormentor': [
    { name: 'Infernal Shapechange', modifiers: [{ reaction: 'immune', type: 'Fire' }, { reaction: 'resistant', physical: true }] },
  ],
  'cr-zephyrous-shadow': [{ name: 'Shadow Cloak', modifiers: [{ reaction: 'resistant', except: 'Arcane' }] }],
};

export function temporaryDamageEffects(creature: CreatureRecord) {
  return (EFFECTS[creature.id] ?? []).flatMap((effect) => {
    const index = creature.actions.findIndex(({ name }) => name === effect.name);
    const description = creatureActionKo[creature.id]?.[index];
    return description ? [{ ...effect, description }] : [];
  });
}

export function damageReactionsWithEffects(base: DamageReactions, modifiers: readonly Modifier[], type: DamageType, magical: boolean) {
  const result = { ...base };
  for (const modifier of modifiers) {
    if ((!modifier.type || modifier.type === type) && modifier.except !== type
      && (!modifier.physical || isPhysicalDamage(type)) && (!modifier.nonMagical || !magical)) {
      result[modifier.reaction] = true;
    }
  }
  return result;
}
