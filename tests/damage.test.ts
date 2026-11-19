import { describe, expect, it } from 'vitest';
import { calculateDirectDamage, splitPcDamage } from '../src/lib/damage';

const normal = { vulnerable: false, resistant: false, immune: false, restored: false };
const hit = { roll: 4, modifier: 1, critical: 1 as const, weak: false, armor: 2, extraArmorIgnore: 0, reduction: 0, reactions: normal };

describe('direct damage', () => {
  it('doubles the fixed modifier and applies Piercing after a Critical Strike without stacking the weak spot', () => {
    expect(calculateDirectDamage({ ...hit, type: 'Piercing', critical: 2, weak: true })).toMatchObject({
      base: 5, multiplier: 2, piercing: 2, beforeArmor: 12, amount: 10,
    });
    expect(calculateDirectDamage({ ...hit, type: 'Piercing', weak: true })).toMatchObject({
      multiplier: 2, piercing: 0, amount: 8,
    });
  });

  it('combines Armor bypass and applies Slashing after Armor', () => {
    expect(calculateDirectDamage({ ...hit, type: 'Bludgeoning', armor: 3, extraArmorIgnore: 1 })).toMatchObject({
      armorIgnore: 2, absorbed: 1, amount: 4,
    });
    expect(calculateDirectDamage({ ...hit, type: 'Slashing' })).toMatchObject({ afterArmor: 3, slashing: 1, amount: 4 });
    expect(calculateDirectDamage({ ...hit, type: 'Acid' })).toMatchObject({ armorIgnore: 0, amount: 3 });
  });

  it('bypasses Armor for Holy, rounds resistance up, and returns healing for restoration', () => {
    expect(calculateDirectDamage({ ...hit, type: 'Holy', reactions: { ...normal, vulnerable: true } }).amount).toBe(10);
    expect(calculateDirectDamage({ ...hit, type: 'Necrotic', reactions: { ...normal, resistant: true, restored: true } }))
      .toMatchObject({ amount: 3, restored: true });
    expect(calculateDirectDamage({ ...hit, type: 'Holy', reduction: 1, reactions: { ...normal, vulnerable: true, resistant: true } }).amount).toBe(4);
    expect(calculateDirectDamage({ ...hit, type: 'Holy', reactions: { ...normal, immune: true, restored: true } })).toMatchObject({
      amount: 0, restored: false,
    });
  });
});

describe('PC damage allocation', () => {
  it('deducts Toughness first and sends only the remainder to Health', () => {
    expect(splitPcDamage(8, 3, false)).toEqual({ toughnessLoss: 3, healthLoss: 5 });
    expect(splitPcDamage(2, 3, false)).toEqual({ toughnessLoss: 2, healthLoss: 0 });
    expect(splitPcDamage(6, 0, false)).toEqual({ toughnessLoss: 0, healthLoss: 6 });
  });

  it('allocates direct Health damage without spending Toughness', () => {
    expect(splitPcDamage(4, 3, true)).toEqual({ toughnessLoss: 0, healthLoss: 4 });
  });
});
