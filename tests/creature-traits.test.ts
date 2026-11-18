import { describe, expect, it } from 'vitest';
import { entryById } from '../src/content';
import { creatureDefenses } from '../src/content/creature-defenses';
import { creatures, describeCreatureTrait } from '../src/content/entries/creatures';

describe('creature trait summaries', () => {
  it('uses the creature’s printed Penetrating amount', () => {
    expect(describeCreatureTrait('Penetrating (2)')).toEqual({
      text: '공격 시 Armor 2 무시.',
      reference: 'creature-traits',
    });
    expect(describeCreatureTrait('Penetrating (1)')?.text).toContain('Armor 1');
  });

  it('lists distinct encounter-start Sanity losses and their reference', () => {
    const frightening = describeCreatureTrait('Frightening');
    const horrifying = describeCreatureTrait('Horrifying');
    expect(frightening?.text).toContain('전투 시작 시 조우당 Resolve 1회');
    expect(frightening?.text).toContain('Sanity 2');
    expect(horrifying?.text).toContain('Sanity 4');
    expect(horrifying?.reference).toBe('frightening-horrifying');
  });

  it('gives every trait shown in the inline list an effect and a reference', () => {
    const traits = new Set(creatures.flatMap((creature) => creatureDefenses(creature).otherTraits));
    for (const trait of traits) {
      const rule = describeCreatureTrait(trait);
      expect(rule?.text, trait).toBeTruthy();
      expect(entryById.has(rule?.reference ?? ''), trait).toBe(true);
    }
  });
});
