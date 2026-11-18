/** Independent dice engine. Never touches app state; returns plain values. */

export interface DiceExpr {
  count: number;
  sides: number;
  mod: number;
}

const DICE_RE = /^\s*(\d*)\s*[dD]\s*(\d+)\s*([+-]\s*\d+)?\s*$/;

export function parseDice(expr: string): DiceExpr | null {
  const m = DICE_RE.exec(expr);
  if (!m) return null;
  const count = m[1] ? Number(m[1]) : 1;
  const sides = Number(m[2]);
  const mod = m[3] ? Number(m[3].replace(/\s/g, '')) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) return null;
  return { count, sides, mod };
}

export type Rng = () => number; // returns float in [0,1)

export const cryptoRng: Rng = () => {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};

export function rollDie(sides: number, rng: Rng = cryptoRng): number {
  return Math.floor(rng() * sides) + 1;
}

export interface RollResult {
  expr: string;
  dice: number[];
  mod: number;
  total: number;
}

export function roll(expr: string, rng: Rng = cryptoRng): RollResult | null {
  const p = parseDice(expr);
  if (!p) return null;
  const dice = Array.from({ length: p.count }, () => rollDie(p.sides, rng));
  return { expr, dice, mod: p.mod, total: dice.reduce((a, b) => a + b, 0) + p.mod };
}

/** D100 as two D10 digits; 0/0 reads as 100. */
export interface D100 {
  tens: number; // 0-9
  ones: number; // 0-9
  value: number; // 1-100
}

export function d100FromDigits(tens: number, ones: number): D100 {
  const v = tens * 10 + ones;
  return { tens, ones, value: v === 0 ? 100 : v };
}

export function rollD100(rng: Rng = cryptoRng): D100 {
  return d100FromDigits(rollDie(10, rng) - 1, rollDie(10, rng) - 1);
}

export function d100FromValue(value: number): D100 {
  const v = value === 100 ? 0 : value;
  return d100FromDigits(Math.floor(v / 10), v % 10);
}

export const isDoubles = (r: D100) => r.tens === r.ones;

/** Swap digits (Advantage/Disadvantage reading). */
export const flipped = (r: D100): D100 => d100FromDigits(r.ones, r.tens);

export type Edge = 'none' | 'advantage' | 'disadvantage';

export type CheckOutcome = 'critical' | 'success' | 'failure' | 'fumble';

export interface CheckResult {
  raw: D100;
  read: D100;
  flippedRead: boolean;
  skill: number;
  outcome: CheckOutcome;
}

const outcomeOf = (r: D100, skill: number): CheckOutcome => {
  const ok = r.value <= skill;
  if (isDoubles(r)) return ok ? 'critical' : 'fumble';
  return ok ? 'success' : 'failure';
};

/**
 * Core p.70 allows the lower reading for Advantage and the higher reading for Disadvantage
 * when it helps or hinders the check. If both readings have the same outcome, keep the original.
 */
export function resolveCheck(raw: D100, skill: number, edge: Edge = 'none'): CheckResult {
  const originalOutcome = outcomeOf(raw, skill);
  if (edge === 'none' || isDoubles(raw)) {
    return { raw, read: raw, flippedRead: false, skill, outcome: originalOutcome };
  }
  const alternative = flipped(raw);
  const alternativeOutcome = outcomeOf(alternative, skill);
  const useFlip = edge === 'advantage'
    ? originalOutcome === 'failure' && alternativeOutcome === 'success'
    : originalOutcome === 'success' && alternativeOutcome === 'failure';
  return {
    raw,
    read: useFlip ? alternative : raw,
    flippedRead: useFlip,
    skill,
    outcome: useFlip ? alternativeOutcome : originalOutcome,
  };
}

export interface OpposedResult {
  winner: 'A' | 'B' | 'reroll' | 'undefined';
  reason: string;
  bothFailed: boolean;
}

/**
 * Generic opposed check, Core p.70. Returns 'undefined' for the one case the
 * book does not settle (both sides fumble) instead of guessing.
 */
export function resolveOpposed(a: CheckResult, b: CheckResult): OpposedResult {
  const aOk = a.outcome === 'success' || a.outcome === 'critical';
  const bOk = b.outcome === 'success' || b.outcome === 'critical';
  if (a.outcome === 'fumble' && b.outcome === 'fumble') {
    return { winner: 'undefined', reason: '양쪽 모두 대실패 — 일반 대항 판정 규칙에 명시되지 않음', bothFailed: true };
  }
  if (a.outcome === 'critical' && b.outcome !== 'critical') return { winner: 'A', reason: 'A만 대성공', bothFailed: false };
  if (b.outcome === 'critical' && a.outcome !== 'critical') return { winner: 'B', reason: 'B만 대성공', bothFailed: false };
  if (a.outcome === 'fumble') return { winner: 'B', reason: 'A 대실패', bothFailed: !bOk };
  if (b.outcome === 'fumble') return { winner: 'A', reason: 'B 대실패', bothFailed: !aOk };
  if (aOk && !bOk) return { winner: 'A', reason: 'A만 성공', bothFailed: false };
  if (bOk && !aOk) return { winner: 'B', reason: 'B만 성공', bothFailed: false };
  const label = aOk ? '둘 다 성공' : '둘 다 실패';
  if (a.read.value !== b.read.value) {
    return a.read.value > b.read.value
      ? { winner: 'A', reason: `${label} — A의 굴림이 더 높음`, bothFailed: !aOk }
      : { winner: 'B', reason: `${label} — B의 굴림이 더 높음`, bothFailed: !aOk };
  }
  if (a.skill !== b.skill) {
    return a.skill > b.skill
      ? { winner: 'A', reason: `${label}, 굴림 동률 — A의 Skill이 더 높음`, bothFailed: !aOk }
      : { winner: 'B', reason: `${label}, 굴림 동률 — B의 Skill이 더 높음`, bothFailed: !aOk };
  }
  return { winner: 'reroll', reason: `${label}, 굴림·Skill 동률 — 다시 굴림`, bothFailed: !aOk };
}

export interface AttackResult {
  outcome: 'hit' | 'critical-hit' | 'defended' | 'both-failed' | 'reroll';
  reason: string;
  attackerFumble: boolean;
}

/** Attack check, Core p.75: crit beats non-crit; both fail (crit or not) → defender takes 1. */
export function resolveAttack(atk: CheckResult, def: CheckResult): AttackResult {
  const attackerFumble = atk.outcome === 'fumble';
  const aOk = atk.outcome === 'success' || atk.outcome === 'critical';
  const dOk = def.outcome === 'success' || def.outcome === 'critical';
  if (!aOk && !dOk) return { outcome: 'both-failed', reason: '양쪽 실패 — 방어자 1 피해(감소 불가)', attackerFumble };
  if (atk.outcome === 'critical' && def.outcome === 'critical') {
    if (atk.read.value !== def.read.value)
      return atk.read.value > def.read.value
        ? { outcome: 'critical-hit', reason: '둘 다 대성공 — 공격자 굴림이 더 높음', attackerFumble }
        : { outcome: 'defended', reason: '둘 다 대성공 — 방어자 굴림이 더 높음', attackerFumble };
    if (atk.skill !== def.skill)
      return atk.skill > def.skill
        ? { outcome: 'critical-hit', reason: '둘 다 대성공, 동률 — 공격자 Skill이 더 높음', attackerFumble }
        : { outcome: 'defended', reason: '둘 다 대성공, 동률 — 방어자 Skill이 더 높음', attackerFumble };
    return { outcome: 'reroll', reason: '둘 다 대성공, 굴림·Skill 동률 — 다시 굴림', attackerFumble };
  }
  const o = resolveOpposed(atk, def);
  if (o.winner === 'A') return { outcome: atk.outcome === 'critical' ? 'critical-hit' : 'hit', reason: o.reason.replace(/A/g, '공격자').replace(/B/g, '방어자'), attackerFumble };
  if (o.winner === 'B') return { outcome: 'defended', reason: o.reason.replace(/A/g, '공격자').replace(/B/g, '방어자'), attackerFumble };
  return { outcome: 'reroll', reason: o.reason.replace(/A/g, '공격자').replace(/B/g, '방어자'), attackerFumble };
}

export const DICE_CHAIN = ['D20', 'D12', 'D10', 'D8', 'D6', 'D4'] as const;

/** sides of a table die string like 'D100'; null for lookup tables */
export function tableSides(dice: string): number | null {
  const m = /^D(\d+)$/.exec(dice);
  return m ? Number(m[1]) : null;
}
