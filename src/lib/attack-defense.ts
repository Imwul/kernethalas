import { resolveAttack, type AttackResult, type CheckResult } from './dice';

export const ATTACK_DEFENSE_MODES = ['opposed', 'unopposed', 'automatic'] as const;
export type AttackDefenseMode = typeof ATTACK_DEFENSE_MODES[number];
export type PhysicalAttackResult = AttackResult | { outcome: 'miss'; reason: string; attackerFumble: boolean };

export function resolvePhysicalAttack(mode: AttackDefenseMode, attack: CheckResult | null, defense: CheckResult | null): PhysicalAttackResult | null {
  if (mode === 'automatic') return { outcome: 'hit', reason: '무방비 대상 · 공격과 방어 굴림 없이 명중', attackerFumble: false };
  if (!attack) return null;
  if (mode === 'opposed') return defense ? resolveAttack(attack, defense) : null;
  if (attack.outcome === 'critical') return { outcome: 'critical-hit', reason: '능동 방어 불가 · 공격 판정 대성공', attackerFumble: false };
  if (attack.outcome === 'success') return { outcome: 'hit', reason: '능동 방어 불가 · 공격 판정 성공', attackerFumble: false };
  return { outcome: 'miss', reason: '능동 방어 불가 · 공격 판정 실패', attackerFumble: attack.outcome === 'fumble' };
}
