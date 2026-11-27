import { describe, expect, it } from 'vitest';
import { creatureById, creatures } from '../src/content/entries/creatures';
import { creatureActionKo } from '../src/content/creature-actions';
import {
  creatureAttackDamage, creatureAttackPool, creaturePenetration, formatAttackDamage, poolDieCount,
} from '../src/lib/creature-combat';
import { withDamageBonuses } from '../src/lib/damage-pool';

const action = (id: string, min: number) => {
  const creature = creatureById.get(id)!;
  return [creature, creature.actions.find((entry) => entry.min === min)!] as const;
};

describe('creature attacks from the action table', () => {
  it('gives every Physical action the damage its hit deals', () => {
    const missing = creatures.flatMap((creature) => creature.actions
      .filter((entry) => entry.tag === 'Physical' && creatureAttackDamage(creature, entry).length === 0)
      .map((entry) => `${creature.id} ${entry.name}`));
    expect(missing).toEqual([]);
  });

  it('reads dice, fixed bonuses and fixed amounts', () => {
    expect(creatureAttackDamage(...action('cr-abyssal-vexator', 1))).toEqual([{ dice: 'D6', mod: 0, type: 'Piercing' }]);
    expect(creatureAttackDamage(...action('cr-desiccated-cryptguards', 3))).toEqual([{ dice: 'D4', mod: 1, type: 'Slashing' }]);
    expect(creatureAttackDamage(...action('cr-gorehoof', 2))).toEqual([{ dice: '3D6', mod: 0, type: 'Bludgeoning' }]);
    expect(creatureAttackDamage(...action('cr-razorjaw', 3))).toEqual([{ dice: '', mod: 2, type: 'Slashing' }]);
    // The first damage in the text is the hit; the Necrotic follows a failed Endurance check.
    expect(creatureAttackDamage(...action('cr-bloodstalker', 1))).toEqual([{ dice: 'D6', mod: 0, type: 'Piercing' }]);
  });

  it('leaves non-attacks alone and lists alternatives', () => {
    expect(creatureAttackDamage(...action('cr-abyssal-vexator', 3))).toEqual([]);
    expect(creatureAttackDamage(...action('cr-abyssal-vexator', 5))).toEqual([]);
    expect(creatureAttackDamage(...action('cr-cavebound-leech', 5)).map(({ dice, type }) => `${dice} ${type}`))
      .toEqual(['2D8 Acid', 'D6 Piercing']);
    expect(creatureAttackDamage(...action('cr-bladewings', 5))).toMatchObject([{ dice: 'D6', type: 'Slashing' }]);
    expect(creatureAttackDamage(...action('cr-razorjaw', 5))).toMatchObject([{ dice: 'D4', type: 'Piercing' }]);
    expect(creatureAttackDamage(...action('cr-veilshifter', 4))).toMatchObject([{ dice: '2D4', type: 'Psychic' }]);
  });

  it('adds Level Adaptation dice to the pool and fixed bonuses to the chosen die', () => {
    const chain = { dice: 'D6', mod: 0, type: 'Piercing' as const };
    expect(creatureAttackPool(chain, [])).toEqual({ dice: 'D6', mod: 0, type: 'Piercing', bonuses: [] });
    expect(creatureAttackPool(chain, ['+D6', '+D8'])).toMatchObject({ dice: 'D6+D6+D8', mod: 0 });
    expect(creatureAttackPool({ ...chain, mod: 1 }, ['+D6+2'])).toMatchObject({ dice: 'D6+D6+3', mod: 3 });
    expect(creatureAttackPool({ dice: '', mod: 2, type: 'Slashing' }, ['+1'])).toMatchObject({ dice: null, mod: 3 });
    expect(poolDieCount('3D6+D4+2')).toBe(4);
    expect(formatAttackDamage(creatureAttackPool(chain, ['+D6']), 1)).toBe('D6+D6 Piercing · 레벨 적응 +D6 포함 · 가장 높은 눈 · Armor 1 무시');
  });

  it('reads Penetrating from the traits', () => {
    expect(creatures.some((creature) => creaturePenetration(creature) === 1)).toBe(true);
    expect(creaturePenetration(creatureById.get('cr-abyssal-vexator')!)).toBe(0);
  });
});

describe('Level Adaptation on action damage', () => {
  it('adds dice to the pool and fixed bonuses to the die that counts', () => {
    expect(withDamageBonuses([['Necrotic', 'D6']], ['+D6'])).toEqual({ damage: [['Necrotic', 'D6'], ['Necrotic', 'D6']], applied: ['+D6'] });
    expect(withDamageBonuses([['Arcane', 'D4+1']], ['+2']).damage).toEqual([['Arcane', 'D4+3']]);
    expect(withDamageBonuses([['Fire', '2D6']], ['+D6+2']).damage).toEqual([['Fire', '2D6'], ['Fire', 'D6+2']]);
    expect(withDamageBonuses([['Necrotic', 2]], ['+1']).damage).toEqual([['Necrotic', 3]]);
    expect(withDamageBonuses([], ['+D6'])).toEqual({ damage: [], applied: [] });
  });
});

describe('Magical action wording', () => {
  it('never describes a Magical action as landing on a hit, since the target resists it with a check', () => {
    const misleading = creatures.flatMap((creature) => creature.actions.flatMap((entry, index) =>
      entry.tag === 'Magical' && /명중|맞은 대상/.test(creatureActionKo[creature.id]?.[index] ?? '') ? [`${creature.id} ${entry.name}`] : []));
    expect(misleading).toEqual([]);
  });
});
