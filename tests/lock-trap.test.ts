import { describe, expect, it } from 'vitest';
import { forceOpeningBonus, lockpickDifficulty, trapInvestigation } from '../src/lib/lock-trap';

describe('lock and trap resolution', () => {
  it('rolls for a feature only on successful detection or after touching it', () => {
    expect(trapInvestigation('door', 'failure', false, null)).toBe('choose');
    expect(trapInvestigation('door', 'failure', true, null)).toBe('roll');
    expect(trapInvestigation('door', 'success', false, 6)).toBe('clear');
    expect(trapInvestigation('door', 'success', false, 7)).toBe('spotted');
    expect(trapInvestigation('container', 'failure', true, 7)).toBe('triggered');
  });

  it('resolves detection at a known environmental trap without a presence roll', () => {
    expect(trapInvestigation('environment', 'success', false, null)).toBe('spotted');
    expect(trapInvestigation('environment', 'failure', false, null)).toBe('triggered');
  });

  it('adds Crowbar and retry bonuses and stops lockpick difficulty at Child’s Play', () => {
    expect(forceOpeningBonus(0, false)).toBe(0);
    expect(forceOpeningBonus(1, true)).toBe(30);
    expect(forceOpeningBonus(2, false)).toBe(40);
    expect(lockpickDifficulty(1)).toBe(10);
    expect(lockpickDifficulty(4)).toBe(30);
  });
});
