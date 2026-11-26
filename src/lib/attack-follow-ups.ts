export const ATTACK_FOLLOW_UP_KINDS = ['pc-defense', 'enemy-defense', 'pc-fumble', 'enemy-fumble'] as const;
export type AttackFollowUpKind = typeof ATTACK_FOLLOW_UP_KINDS[number];
export const ATTACK_FOLLOW_UP_TABLES: Record<AttackFollowUpKind, string> = {
  'pc-defense': 't-defensive-move-pc',
  'enemy-defense': 't-defensive-move-npc',
  'pc-fumble': 't-fumble-pc',
  'enemy-fumble': 't-fumble-npc',
};

export type AttackFollowUpStatus = 'used' | 'noted' | 'skip';
export type AttackFollowUp = {
  kind: AttackFollowUpKind;
  value: number;
  targetId: string;
  targetName: string;
  status?: AttackFollowUpStatus;
};

type CheckEffect = {
  actor: 'pc' | 'enemy';
  check: 'attack' | 'defense';
} & ({ skill: number } | { advantage: true });

const MODIFIERS: Record<AttackFollowUpKind, Partial<Record<number, CheckEffect>>> = {
  'pc-defense': {
    1: { actor: 'pc', check: 'attack', skill: 10 },
    7: { actor: 'pc', check: 'attack', advantage: true },
    8: { actor: 'enemy', check: 'defense', skill: -20 },
  },
  'enemy-defense': {
    1: { actor: 'enemy', check: 'attack', skill: 10 },
    7: { actor: 'enemy', check: 'attack', advantage: true },
    8: { actor: 'pc', check: 'defense', skill: -20 },
  },
  'pc-fumble': {},
  'enemy-fumble': {
    1: { actor: 'enemy', check: 'attack', skill: -20 },
  },
};

export function attackFollowUpModifier(effect: AttackFollowUp) {
  return MODIFIERS[effect.kind][effect.value];
}

export function isAttackFollowUp(value: unknown): value is AttackFollowUp {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as AttackFollowUp;
  return ATTACK_FOLLOW_UP_KINDS.includes(item.kind)
    && Number.isInteger(item.value) && item.value >= 1 && item.value <= 10
    && typeof item.targetId === 'string' && item.targetId.length > 0 && item.targetId.length <= 128
    && typeof item.targetName === 'string' && item.targetName.length > 0 && item.targetName.length <= 128
    && (item.status === undefined || item.status === 'used' || item.status === 'noted' || item.status === 'skip');
}
