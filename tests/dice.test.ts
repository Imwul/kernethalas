import { describe, it, expect } from 'vitest';
import { parseDice, roll, d100FromValue, resolveCheck, resolveOpposed, resolveAttack, d100FromDigits } from '../src/lib/dice';

const seq = (vals: number[]) => { let i = 0; return () => vals[i++ % vals.length]; };

describe('parseDice', () => {
  it('parses notation', () => {
    expect(parseDice('D6')).toEqual({ count: 1, sides: 6, mod: 0 });
    expect(parseDice('2D6+2')).toEqual({ count: 2, sides: 6, mod: 2 });
    expect(parseDice('d10 - 1')).toEqual({ count: 1, sides: 10, mod: -1 });
    expect(parseDice('foo')).toBeNull();
  });
  it('rolls within range', () => {
    for (let k = 0; k < 500; k++) {
      const r = roll('3D6+1')!;
      expect(r.total).toBeGreaterThanOrEqual(4);
      expect(r.total).toBeLessThanOrEqual(19);
    }
  });
  it('uses the rng', () => {
    expect(roll('D10', seq([0.0]))!.total).toBe(1);
    expect(roll('D10', seq([0.999]))!.total).toBe(10);
  });
});

describe('D100 checks (Core p.69–71)', () => {
  it('00 reads as 100 and is a doubles fumble', () => {
    const r = d100FromDigits(0, 0);
    expect(r.value).toBe(100);
    expect(resolveCheck(r, 80).outcome).toBe('fumble');
  });
  it('doubles under skill are critical, over are fumble', () => {
    expect(resolveCheck(d100FromValue(33), 50).outcome).toBe('critical');
    expect(resolveCheck(d100FromValue(66), 50).outcome).toBe('fumble');
    expect(resolveCheck(d100FromValue(50), 50).outcome).toBe('success');
  });
  it('advantage flips 62 to 26 vs skill 50 (book example p.70)', () => {
    const c = resolveCheck(d100FromValue(62), 50, 'advantage');
    expect(c.read.value).toBe(26);
    expect(c.outcome).toBe('success');
  });
  it('disadvantage only flips when it hampers', () => {
    expect(resolveCheck(d100FromValue(26), 50, 'disadvantage').read.value).toBe(62);
    expect(resolveCheck(d100FromValue(62), 50, 'disadvantage').read.value).toBe(62);
  });
  it('keeps the original roll when changing digits would keep the same outcome', () => {
    for (const skill of [20, 70]) {
      expect(resolveCheck(d100FromValue(26), skill, 'advantage').read.value).toBe(26);
      expect(resolveCheck(d100FromValue(62), skill, 'disadvantage').read.value).toBe(62);
    }
  });
  it('uses the adjusted skill even outside the bounds of the die', () => {
    expect(resolveCheck(d100FromValue(12), -20).outcome).toBe('failure');
    expect(resolveCheck(d100FromValue(99), 103).outcome).toBe('critical');
  });
});

describe('opposed & attack (Core p.70, 75)', () => {
  const C = (v: number, s: number) => resolveCheck(d100FromValue(v), s);
  it('book example: both succeed, higher roll wins (Arathos 23 vs Necropede 34)', () => {
    expect(resolveOpposed(C(23, 54), C(34, 60)).winner).toBe('B');
  });
  it('both fumble is left undefined', () => {
    expect(resolveOpposed(C(99, 50), C(88, 50)).winner).toBe('undefined');
  });
  it('attack: both fail → defender takes 1', () => {
    expect(resolveAttack(C(90, 50), C(95, 50)).outcome).toBe('both-failed');
  });
  it('attack: example p.86 — Erthos 12 vs Necropede 25, defender wins', () => {
    expect(resolveAttack(C(12, 103), C(25, 50)).outcome).toBe('defended');
  });
  it('attack: crit beats normal success', () => {
    expect(resolveAttack(C(11, 50), C(45, 50)).outcome).toBe('critical-hit');
  });
  it('attack: attacker fumble with defender fail is both-failed + fumble flag', () => {
    const r = resolveAttack(C(77, 50), C(90, 50));
    expect(r.outcome).toBe('both-failed');
    expect(r.attackerFumble).toBe(true);
  });
});
