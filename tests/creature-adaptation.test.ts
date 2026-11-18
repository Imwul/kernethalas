import { describe, expect, it } from 'vitest';
import { creatures } from '../src/content/entries/creatures';
import { adaptationArmorBonus, calculateCreatureAdaptation, readCreatureLevel } from '../src/lib/creature-adaptation';

const creature = (id: string) => creatures.find((entry) => entry.id === `cr-${id}`)!;

describe('creature level adaptation', () => {
  it('applies the 5 and 10 thresholds strictly after the listed level and keeps damage terms separate', () => {
    const necropede = creature('necropede');
    expect(calculateCreatureAdaptation(necropede, 5).stats.health.value).toBe(16);
    expect(calculateCreatureAdaptation(necropede, 6).stats.health.value).toBe(20);
    expect(calculateCreatureAdaptation(necropede, 10).stats.combatSkill.value).toBe(60);

    const afterTen = calculateCreatureAdaptation(necropede, 11);
    expect(afterTen.stats.health).toEqual({ base: '16', value: 20, unknown: false });
    expect(afterTen.stats.combatSkill.value).toBe(70);
    expect(afterTen.damageBonuses).toEqual(['+D6', '+2']);
  });

  it('computes per-level Health even before any adaptation threshold and does not assume a PC level', () => {
    const vexator = creature('abyssal-vexator');
    expect(calculateCreatureAdaptation(vexator, null).stats.health.value).toBeNull();
    expect(calculateCreatureAdaptation(vexator, 3).stats.health.value).toBe(20);
    expect(calculateCreatureAdaptation(vexator, 11).stats.health.value).toBe(52);
  });

  it('applies MR bonuses and leaves compound damage dice intact', () => {
    const bladewings = calculateCreatureAdaptation(creature('bladewings'), 11);
    expect(bladewings.stats.magicResistance.value).toBe(30);
    const devourer = calculateCreatureAdaptation(creature('carnage-devourer'), 11);
    expect(devourer.damageBonuses).toEqual(['+D6+2', '+D10']);
  });

  it('applies Armor only to the allowed hit locations', () => {
    const { armorBonuses } = calculateCreatureAdaptation(creature('amalgam'), 6);
    expect(adaptationArmorBonus(armorBonuses, 'Head')).toBe(1);
    expect(adaptationArmorBonus(armorBonuses, 'Chest')).toBe(0);
    expect(adaptationArmorBonus(armorBonuses, null)).toBeNull();
    const wholeBody = calculateCreatureAdaptation(creature('armor-construct'), 6).armorBonuses;
    expect(adaptationArmorBonus(wholeBody, null)).toBe(1);
  });

  it('flags the single unsigned Health amount and still applies the remaining rules', () => {
    const burrower = calculateCreatureAdaptation(creature('glacial-burrower'), 11);
    expect(burrower.stats.health).toEqual({ base: '30', value: 30, unknown: true });
    expect(burrower.stats.combatSkill.value).toBe(70);
    expect(burrower.unresolved).toEqual(['10 Health']);
    expect(burrower.damageBonuses).toEqual(['+5', '+D6']);
  });

  it('validates the temporary level input', () => {
    expect(readCreatureLevel('11')).toBe(11);
    for (const raw of ['', '0', '-1', '2.5', '1e2', '9007199254740992']) expect(readCreatureLevel(raw)).toBeNull();
  });
});
