import { d100FromValue, resolveCheck, resolveOpposed, type CheckResult, type Edge } from './dice';
import { readOracleValue } from './oracle';

export function encounterFear(traits: readonly string[]) {
  return traits.includes('Horrifying') ? 4 : traits.includes('Frightening') ? 2 : 0;
}

export function encounterInteger(raw: string) {
  const text = raw.trim().replace(/^−/, '-');
  const number = Number(text);
  return /^[+-]?\d+$/.test(text) && Number.isSafeInteger(number) ? number : null;
}

export function encounterCheck(roll: string, skill: number | null, edge: Edge) {
  const value = readOracleValue(roll.trim(), 100);
  return value === null || skill === null || !Number.isSafeInteger(skill) ? null : resolveCheck(d100FromValue(value), skill, edge);
}

export function encounterOpposed(pc: CheckResult, enemy: CheckResult) {
  const { winner, reason } = resolveOpposed(pc, enemy);
  return {
    winner: winner === 'A' ? 'pc' : winner === 'B' ? 'enemy' : winner,
    reason: reason.replace(/A/g, 'PC').replace(/B/g, '적'),
  } as const;
}

export function encounterInitiativeModifier(failedSurprise: boolean, quick: boolean) {
  return (quick ? 10 : 0) - (failedSurprise ? 20 : 0);
}
