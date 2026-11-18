/**
 * Play-time shortcuts to existing Gravebound v1.2 references. Each group of
 * links is an editorial index. The referenced documents carry the source pages.
 */
export const SITUATION_GROUPS = [
  { id: 'combat', label: '전투' },
  { id: 'conditions', label: '상태·특성' },
  { id: 'exploration', label: '탐험' },
] as const;

export interface Situation {
  id: string;
  group: (typeof SITUATION_GROUPS)[number]['id'];
  ko: string;
  en: string;
  description: string;
  aliases: string[];
  refs: string[];
}

export const situations: Situation[] = [
  {
    id: 'both-fail',
    group: 'combat',
    ko: '공격과 방어가 모두 실패했어요',
    en: 'Both attack and defense fail',
    description: '방어자가 1 피해를 입습니다. 피해 감소 예외와 공격자의 대실패 처리도 함께 확인할 수 있습니다.',
    aliases: [
      '공격과 방어가 모두 실패', '공격도 방어도 실패', '공격과 방어가 둘 다 실패', '공격과 방어 둘 다 실패',
      '공격 방어 실패', '양쪽 실패', '둘 다 실패', '공격 방어 판정 비교',
      'both fail', 'both rolls failed', 'both sides fail', 'attacker and defender both fail',
      'attacker and defender fail', 'attack and defense both fail', 'attack and defence both fail',
      'compare attack and defense outcomes', 'fumble and enemy fails',
    ],
    refs: ['q-both-fail', 'attack-check', 'fumble', 'p-attack'],
  },
  {
    id: 'defend',
    group: 'combat',
    ko: '상대의 공격을 방어하려고 해요',
    en: 'Defending against an attack',
    description: '물리 공격은 Dodge 또는 조건을 충족한 Parry로 대응합니다. 마법 공격과 연속 방어에 적용되는 판정도 확인할 수 있습니다.',
    aliases: [
      '상대방의 공격을 방어', '상대 공격 막기', '공격을 방어', '공격을 막', '방어 판정',
      'defend against an attack', 'how do i defend', 'enemy attack defense', 'parry or dodge', 'block an attack',
      'defense roll', 'defence roll',
    ],
    refs: ['attack-check', 'defensive-move', 'defense-reaction-penalty', 'magical-attacks'],
  },
  {
    id: 'multiple-enemies',
    group: 'combat',
    ko: '여러 적을 동시에 상대해요',
    en: 'Fighting several enemies',
    description: '방어를 포함해 같은 라운드의 두 번째 반응부터 −20이 누적됩니다. 공격 대상 배분과 Swift·쌍수 반응도 확인할 수 있습니다.',
    aliases: [
      '여러 적과 동시에 싸우', '여러 적', '적 두 명', '두 명 이상의 적', '두 명 이상과 싸우', '다수전', '다대일', '연속 방어',
      'multiple enemies', 'multiple attackers', 'two enemies', 'outnumbered', 'fighting more than one enemy', 'enemy reaction penalty',
    ],
    refs: ['q-multiple-enemies', 'defense-reaction-penalty', 'attack-check', 'multiple-targets'],
  },
  {
    id: 'damage',
    group: 'combat',
    ko: '피해량과 Armor를 계산해요',
    en: 'Calculating damage and armor',
    description: '피해 풀과 보정, 명중 부위 Armor, 피해 유형별 적용 조건을 확인합니다.',
    aliases: [
      '피해량과 armor를 계산', '피해량 계산', '피해 계산', '방어구 피해 감소', '아머 계산',
      'calculate damage and armor', 'calculate damage', 'damage calculation', 'damage and armour', 'armor reduces damage', 'dmg',
    ],
    refs: ['q-damage-order', 'damage-pool', 'armor', 'damage-types', 'q-armor-zero'],
  },
  {
    id: 'stand',
    group: 'conditions',
    ko: 'Prone 상태에서 일어나려고 해요',
    en: 'Standing up from Prone',
    description: '자기 턴에 자유 행동으로 일어나면 상대가 즉시 방어 동작 표를 굴립니다. 일부 펌블은 일어나는 데 별도의 행동을 요구합니다.',
    aliases: [
      'prone 상태에서 일어나', '넘어진 상태에서 일어나', '넘어짐 해제', '쓰러진 뒤 일어나', '일어서기', '일어나기',
      'stand up', 'get up', 'stand from prone', 'get up from prone', 'prone stand up',
    ],
    refs: ['q-prone-stand', 'prone', 'defensive-move', 't-defensive-move-npc'],
  },
  {
    id: 'frightening',
    group: 'conditions',
    ko: 'Frightening 특성을 가진 적을 만났어요',
    en: 'Encountering a Frightening enemy',
    description: '전투 시작 시 조우 전체에 Resolve를 한 번 굴립니다. 실패하면 해당 특성 중 가장 큰 Sanity 손실을 적용합니다.',
    aliases: [
      'frightening 특성을 가진 적', '공포 유발 적', '공포 특성', '전투 시작 resolve',
      'frightening creature', 'frightening enemy', 'horrifying enemy', 'fear trait', 'resolve against fear',
    ],
    refs: ['frightening-horrifying', 'resistances', 'q-resolve-when', 'sanity'],
  },
  {
    id: 'explore',
    group: 'exploration',
    ko: '새로운 공간을 탐험하려고 해요',
    en: 'Exploring a new room or corridor',
    description: '새 방·통로의 모양, 은신처·출구 판정, 조우와 이벤트 분기를 확인합니다.',
    aliases: [
      '새로운 공간을 탐험', '새 방', '새 방 탐험', '새 방으로 이동', '다음 방으로 들어', '새 통로', '새 통로 탐험', '방 생성',
      'explore new room', 'enter a new room', 'new room', 'new corridor', 'exploration loop',
    ],
    refs: ['p-explore-room', 't-room-shape', 'lair-check', 'domain-exit-check', 't-encounter-check'],
  },
  {
    id: 'overseer',
    group: 'exploration',
    ko: 'Overseer의 영향을 확인해요',
    en: 'Checking Overseer effects',
    description: '영향력이 적용되는 대상, 추가 영향력 굴림, Overseer 처치 후의 처리를 확인합니다.',
    aliases: [
      'overseer와 관련된 효과', 'overseer 효과', '오버시어 영향력', '지배자 영향',
      'boss influence', 'overseer influence', 'overseer effects', 'overseer effect', 'who is affected by overseer influence',
    ],
    refs: ['overseer-influence', 'q-overseer-influence-who', 't-overseer-influence', 'overseers'],
  },
];
