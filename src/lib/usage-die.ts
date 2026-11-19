import { DICE_CHAIN, tableSides } from './dice';

export type UsageDie = (typeof DICE_CHAIN)[number];

interface UsageDieProfile {
  title: string;
  dice: readonly UsageDie[];
  start: UsageDie | null;
  trigger: string;
  effect: string;
  followUps?: readonly { id: string; label: string }[];
}

// Core pp.72, 74, 83, 98–99. Reason fumbles can raise Lair and Exit past their starting size.
export const USAGE_DIE_PROFILES = {
  'armor-integrity': {
    title: '방어구 내구도 굴림',
    dice: DICE_CHAIN.slice(1),
    start: null,
    trigger: '방어구 파괴',
    effect: '이 방어구는 수리할 수 없으므로 버립니다.',
  },
  'lair-check': {
    title: '은신처 소모 주사위',
    dice: DICE_CHAIN,
    start: 'D10',
    trigger: 'Overseer 은신처 발견',
    effect: '이 방의 조우 판정은 건너뜁니다. 이후 새 방·통로부터 출구 판정을 D8로 시작합니다.',
    followUps: [
      { id: 'overseers', label: 'Overseer 규칙 보기' },
      { id: 'domain-exit-check', label: '도메인 출구 판정 열기' },
    ],
  },
  'domain-exit-check': {
    title: '출구 소모 주사위',
    dice: DICE_CHAIN,
    start: 'D8',
    trigger: '도메인 출구 발견',
    effect: '이 장소에서도 긴장 주사위와 조우 등 일반 판정을 합니다. 출구로 나가거나 현재 도메인에서 탐험을 계속할 수 있습니다.',
  },
} satisfies Record<string, UsageDieProfile>;

export type UsageDieRule = keyof typeof USAGE_DIE_PROFILES;

export function isUsageDieRule(id: string): id is UsageDieRule {
  return Object.hasOwn(USAGE_DIE_PROFILES, id);
}

export function resolveUsageDie(rule: UsageDieRule, die: UsageDie, value: number) {
  const profile: UsageDieProfile = USAGE_DIE_PROFILES[rule];
  const position = profile.dice.indexOf(die);
  if (position < 0 || !Number.isInteger(value) || value < 1 || value > tableSides(die)!) return null;
  if (value > 2) return { kind: 'unchanged', next: die } as const;
  const next = profile.dice[position + 1];
  return next
    ? { kind: 'decreased', next } as const
    : { kind: 'trigger', title: profile.trigger, effect: profile.effect, followUps: profile.followUps } as const;
}
