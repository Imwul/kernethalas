import { describe, expect, it } from 'vitest';
import { creatureDefenses } from '../src/content/creature-defenses';
import { creatures } from '../src/content/entries/creatures';

const defensesOf = (id: string) => creatureDefenses(creatures.find((creature) => creature.id === id)!);

describe('creature defenses', () => {
  it('combines a creature type and individual damage traits', () => {
    expect(defensesOf('cr-pyreborn')).toMatchObject({
      vulnerable: ['Cold'],
      restored: ['Fire'],
      immuneConditions: ['Bleeding', 'Sickened', 'Poisoned'],
    });
    expect(defensesOf('cr-lesser-demon')).toMatchObject({
      vulnerable: ['Holy'],
      restored: ['Infernal', 'Fire'],
      immuneConditions: ['Poisoned'],
    });
    expect(defensesOf('cr-umbra-fiend').resistsNonMagicalPhysical).toBe(true);
  });

  it('deduplicates overlapping type and trait effects', () => {
    expect(defensesOf('cr-wrath-elemental').restored).toEqual(['Infernal']);
    expect(defensesOf('cr-wraithskull').immuneConditions).toEqual([
      'Bleeding', 'Sickened', 'Poisoned', 'Frightened',
    ]);
  });
});
