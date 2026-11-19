import { describe, expect, it } from 'vitest';
import { encounterCheck, encounterFear, encounterInitiativeModifier, encounterInteger, encounterOpposed } from '../src/lib/encounter-start';

describe('encounter start', () => {
  it('takes the greatest fear loss for a mixed group', () => {
    expect(encounterFear(['Alert', 'Frightening', 'Frightening'])).toBe(2);
    expect(encounterFear(['Horrifying', 'Frightening'])).toBe(4);
    expect(encounterFear(['Alert'])).toBe(0);
  });

  it('uses the generic opposed-check resolution when both sides fail', () => {
    const pc = encounterCheck('94', 30, 'none')!;
    const enemy = encounterCheck('72', 40, 'none')!;
    expect(encounterOpposed(pc, enemy)).toMatchObject({ winner: 'pc' });
    expect(encounterOpposed(pc, pc)).toMatchObject({ winner: 'reroll' });
    const fumble = encounterCheck('00', 30, 'none')!;
    expect(encounterOpposed(fumble, fumble)).toMatchObject({ winner: 'undefined' });
  });

  it('applies Quick and failed-surprise modifiers together', () => {
    expect(encounterInitiativeModifier(false, false)).toBe(0);
    expect(encounterInitiativeModifier(false, true)).toBe(10);
    expect(encounterInitiativeModifier(true, false)).toBe(-20);
    expect(encounterInitiativeModifier(true, true)).toBe(-10);
    expect(encounterCheck('41', 50 - 10, 'none')?.outcome).toBe('failure');
  });

  it('uses existing D100 reading and rejects invalid inputs', () => {
    expect(encounterCheck('74', 50, 'advantage')).toMatchObject({ outcome: 'success', flippedRead: true });
    expect(encounterCheck('00', 50, 'none')?.outcome).toBe('fumble');
    expect(encounterCheck('101', 40, 'none')).toBeNull();
    expect(encounterInteger(' −20 ')).toBe(-20);
    expect(encounterInteger('  ')).toBeNull();
  });
});
