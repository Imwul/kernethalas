import { describe, expect, it } from 'vitest';
import { isUsageDieRule, resolveUsageDie } from '../src/lib/usage-die';

describe('usage dice by rule', () => {
  it('recognizes exactly the rules supported by the tool', () => {
    expect(isUsageDieRule('armor-integrity')).toBe(true);
    expect(isUsageDieRule('lair-check')).toBe(true);
    expect(isUsageDieRule('domain-exit-check')).toBe(true);
    expect(isUsageDieRule('tension-die')).toBe(false);
    expect(isUsageDieRule('constructor')).toBe(false);
  });

  it('keeps the die on 3+ and lowers it by one stage on 1–2', () => {
    expect(resolveUsageDie('armor-integrity', 'D12', 12)).toEqual({ kind: 'unchanged', next: 'D12' });
    expect(resolveUsageDie('armor-integrity', 'D12', 1)).toEqual({ kind: 'decreased', next: 'D10' });
    expect(resolveUsageDie('lair-check', 'D20', 2)).toEqual({ kind: 'decreased', next: 'D12' });
    expect(resolveUsageDie('domain-exit-check', 'D10', 1)).toEqual({ kind: 'decreased', next: 'D8' });
    expect(resolveUsageDie('domain-exit-check', 'D6', 2)).toEqual({ kind: 'decreased', next: 'D4' });
  });

  it('distinguishes the D4 effects of each rule', () => {
    expect(resolveUsageDie('armor-integrity', 'D4', 2)).toMatchObject({ kind: 'trigger', title: '방어구 파괴' });
    expect(resolveUsageDie('lair-check', 'D4', 1)).toMatchObject({
      kind: 'trigger',
      title: 'Overseer 은신처 발견',
      effect: expect.stringContaining('이후 새 방·통로부터 출구 판정을 D8로 시작'),
    });
    expect(resolveUsageDie('domain-exit-check', 'D4', 2)).toMatchObject({
      kind: 'trigger',
      title: '도메인 출구 발견',
      effect: expect.stringContaining('긴장 주사위와 조우 등 일반 판정'),
    });
    expect(resolveUsageDie('domain-exit-check', 'D4', 3)).toEqual({ kind: 'unchanged', next: 'D4' });
  });

  it('rejects unavailable dice and invalid results', () => {
    expect(resolveUsageDie('armor-integrity', 'D20', 1)).toBeNull();
    expect(resolveUsageDie('lair-check', 'D6', 0)).toBeNull();
    expect(resolveUsageDie('domain-exit-check', 'D4', 5)).toBeNull();
    expect(resolveUsageDie('domain-exit-check', 'D8', 1.5)).toBeNull();
  });
});
