import { describe, expect, it } from 'vitest';
import { campTotals, resolveCampCheck } from '../src/lib/camp';

const basePlan = {
  quantities: {},
  hasRation: true,
  sleep: false,
  bedroll: false,
  darkness: false,
  extraCheck: 0,
};

describe('camp calculator', () => {
  it('charges Camp Check and Exhaustion once for batches and per item for barricades, treatment and attunement', () => {
    const plan = campTotals({
      ...basePlan,
      quantities: { barricade: 2, bandages: 3, 'lamp-oil': 2, repair: 4, treat: 2, attune: 2 },
      bedroll: true,
      darkness: true,
      extraCheck: -2,
    });
    expect(plan.spent).toEqual({ Ration: 1, 'Crafting Supplies': 17, Bandage: 2, 'Attunement Crystal': 2 });
    expect(plan.produced).toEqual({ Bandage: 3, 'Lamp Oil': 2 });
    expect(plan.exhaustion).toBe(10);
    expect(plan.check).toBe(3);
  });

  it('uses one freshly cooked Ration and preserves any additional rations', () => {
    expect(campTotals({ ...basePlan, hasRation: false, quantities: { cooking: 1 } })).toMatchObject({
      ration: 'cooked', spent: { 'Cooking Ingredients': 1 }, produced: {}, check: -1, exhaustion: 1,
    });
    expect(campTotals({ ...basePlan, hasRation: false, quantities: { cooking: 3 } })).toMatchObject({
      ration: 'cooked', spent: { 'Cooking Ingredients': 3 }, produced: { Ration: 2 }, check: -1, exhaustion: 1,
    });
  });

  it('combines Sleep, barricades and Bedroll while suspending other activities', () => {
    expect(campTotals({
      ...basePlan, sleep: true, bedroll: true, hasRation: false, quantities: { barricade: 2, cooking: 1, repair: 2 },
    })).toEqual({
      spent: { 'Crafting Supplies': 2 }, produced: {}, check: 13, exhaustion: -3, sleepHealth: 1, ration: 'missing',
    });
  });

  it('allows totals outside the die range and leaves overlapping half-benefits unresolved', () => {
    expect(resolveCampCheck(19, 6, true)).toEqual({ total: 25, passed: true, benefits: 'full' });
    expect(resolveCampCheck(11, 1, false)).toEqual({ total: 12, passed: true, benefits: 'half' });
    expect(resolveCampCheck(12, -1, true)).toEqual({ total: 11, passed: false, benefits: 'half' });
    expect(resolveCampCheck(1, -3, false)).toEqual({ total: -2, passed: false, benefits: 'unclear' });
  });
});
