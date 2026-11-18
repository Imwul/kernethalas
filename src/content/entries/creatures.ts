import type { Entry } from '../schema';
import { core, rr, req, cond, opt, ed } from '../helpers';
import creatureData from '../generated/creatures.json';
import { creatureActionKo } from '../creature-actions';
import { combatTables } from '../tables/combat';

// Hit tables are shown in Korean only, so stat blocks name anatomy and weak spots the same way.
const hitTables = combatTables.filter((t) => t.id.startsWith('t-hit-'));
const ANATOMY_KO = new Map(hitTables.map((t) => [t.en.split(' — ')[1], t.ko.split(' — ')[1]]));
const PART_KO = new Map(hitTables.flatMap((t) => t.rows.map((r) => [r.label ?? '', r.ko] as const)));

export interface CreatureAction {
  min: number;
  max: number;
  name: string;
  tag: 'Physical' | 'Magical' | null;
}
export interface CreatureRecord {
  id: string;
  name: string;
  page: number;
  statPage: number;
  group: 'creature' | 'overseer' | 'overseer-summon' | 'minion';
  types: string[];
  number: string;
  mind: string;
  endurance: string;
  body: string;
  health: string;
  hitLocation: string | null;
  weakSpot: string | null;
  armor: string;
  combatSkill: string;
  magicResistance: string;
  spoils: string | null;
  traits: string[];
  levelAdaptation: string | null;
  actionDice: string | null;
  actions: CreatureAction[];
}

export const creatures = creatureData as CreatureRecord[];

const TYPE_KO: Record<string, string> = {
  Animal: '동물',
  Astral: '아스트랄',
  Construct: '구조체',
  Demon: '악마',
  Elemental: '원소',
  Humanoid: '인간형',
  Plant: '식물',
  Undead: '언데드',
};

const HIT_TABLE: Record<string, string> = {
  Humanoid: 't-hit-humanoid',
  Quadruped: 't-hit-quadruped',
  Arachnid: 't-hit-arachnid',
  Insectoid: 't-hit-insectoid',
  'Winged Biped': 't-hit-winged',
  Serpentoid: 't-hit-serpentoid',
};

const TRAIT_IDS: [RegExp, string][] = [
  [/Frightening|Horrifying/, 'frightening-horrifying'],
  [/Ruthlessness/, 'ruthlessness'],
  [/Penetrating|Pack|Savage|Swift|Venomous|Alert/, 'creature-traits'],
];

function creatureEntry(c: CreatureRecord): Entry {
  const group = c.group === 'creature' ? '일반 생물' : c.group === 'minion' ? 'Mastery Minion' : 'Overseer';
  const traitRel = c.traits.flatMap((t) => TRAIT_IDS.filter(([re]) => re.test(t)).map(([, id]) => id));
  const hitTable = c.hitLocation ? HIT_TABLE[c.hitLocation] : undefined;
  const effects = creatureActionKo[c.id] ?? [];
  const sourcePages = [...new Set([c.page, c.statPage, ...(c.id === 'cr-infernal-archon' ? [189] : [])])];
  // one action per line, tab-separated: range, name, tag, Korean effect summary (parsed by EntryBody)
  const actions = c.actions
    .map((a, i) => [a.min === a.max ? `${a.min}` : `${a.min}–${a.max}`, a.name, a.tag ?? '', effects[i] ?? ''].join('\t'))
    .join('\n');
  return {
    id: c.id,
    kind: 'creature',
    category: c.group === 'creature' ? 'creatures' : c.group === 'minion' ? 'character' : 'overseers',
    en: c.name,
    ko: c.name,
    aliases: [c.name, ...c.types, ...c.types.map((t) => TYPE_KO[t] ?? t), group, ...c.traits],
    tags: [group, ...c.types],
    summary: `${c.types.map((t) => `${t}(${TYPE_KO[t] ?? t})`).join(' · ')} — ${group}. 수치는 레벨 적응 적용 전 기본값.`,
    stats: {
      Number: c.number,
      Mind: c.mind,
      Endurance: c.endurance,
      Body: c.body,
      Health: c.health,
      'Hit Location': c.hitLocation
        ? `${ANATOMY_KO.get(c.hitLocation) ?? c.hitLocation}${c.weakSpot ? ` · 약점 ${PART_KO.get(c.weakSpot) ?? c.weakSpot}` : ''}`
        : '몸통만 · 약점 없음',
      Armor: c.armor,
      'Combat Skill': c.combatSkill,
      'Magic Resistance': c.magicResistance,
      ...(c.spoils ? { Spoils: c.spoils } : {}),
      Traits: c.traits.length ? c.traits.join(', ') : '—',
      'Level Adaptation': c.levelAdaptation ?? '—',
      ...(actions ? { [`Actions (${c.actionDice ?? 'D6'})`]: actions } : {}),
    },
    tables: hitTable ? [hitTable] : undefined,
    related: [
      req('creature-stat-block'),
      req('encounter-difficulty'),
      opt('creature-types'),
      ...(c.actions.some((action) => action.tag === 'Magical') ? [opt('magical-attacks')] : []),
      ...[...new Set(traitRel)].map((id) => cond(id)),
      ...(c.group !== 'creature' && c.group !== 'minion' ? [opt('overseers')] : []),
      ...(c.group === 'minion' ? [opt('minions')] : []),
    ],
    source: [core(...sourcePages)],
    verification: 'partial',
    notes: [
      {
        type: 'clarification',
        text: '행동마다 판정, 피해, 적용 범위와 지속 시간을 요약했다. 묘사는 표시된 원본 쪽수에서 확인할 수 있다.',
      },
    ],
  };
}

export const creatureEntries: Entry[] = [
  {
    id: 'encounter-setup',
    kind: 'rule',
    category: 'creatures',
    en: 'Combat Encounter Setup',
    ko: '전투 조우 준비',
    aliases: ['combat encounter setup', 'prepare combat encounter', 'prepare monster', 'combat encounter tables', '조우 준비', '적 결정', '전투 조우 절차', '몬스터 준비'],
    summary: '일반 전투 조우가 발생하면 조우 표로 적을 정하고, Number와 레벨 적응을 확인한 뒤 전투를 시작한다.',
    resolution: [
      'D6 일반 표에서 1–3은 A, 4–6은 B를 고른다. 고른 D20 표로 생물 종류를 찾는다.',
      '생물 블록의 Number를 확인한다. 무리면 수치를 개체별로 살피고, 협동 플레이에서는 일반 적 수를 플레이어 수만큼 곱한다.',
      '해당 블록의 Level Adaptation을 누적 적용하고, 유형의 면역·취약·회복과 특성을 확인한다.',
      '여럿이 싸우면 대상을 배정하고, 전투 시작 효과와 기습·선제권을 확인한다.',
    ],
    exceptions: ['조우를 발생시킨 규칙이 생물을 직접 지정하면 그 생물을 사용한다. Overseer는 별도 표와 규칙을 따른다.'],
    tables: ['t-encounter-general', 't-encounter-a', 't-encounter-b'],
    related: [req('encounter-difficulty'), req('creature-stat-block'), opt('creature-types'), opt('creature-traits'), ed('encounter-check'), ed('initiative'), ed('multiple-targets'), ed('co-op'), ed('overseers')],
    source: [core(76, 93, 129, 130, 131, 132, 133, 134, 135, 179), rr(7, 15, 22, 23)],
    verification: 'verified',
  },
  {
    id: 'creature-types',
    kind: 'rule',
    category: 'creatures',
    en: 'Opponent Type',
    ko: '생물 유형',
    aliases: ['type', 'creature type', 'animal', 'astral', 'construct', 'demon', 'elemental', 'humanoid', 'plant', 'undead', '동물', '아스트랄', '구조체', '악마', '원소', '인간형', '식물', '언데드', '면역', 'immune'],
    summary: '8가지 유형. 유형마다 고유한 취약·회복·상태 면역이 있다. 두 유형을 함께 가진 생물도 있다.',
    outcomes: [
      { label: 'Animal', text: '공통 특성 없음(개별 종은 있을 수 있음).' },
      { label: 'Astral', text: '면역: Bleeding, Poisoned, Sickened, Frightened.' },
      { label: 'Construct', text: '면역: Charmed, Poisoned, Bleeding, Sickened, Frightened, Sleeping.' },
      { label: 'Demon', text: 'Infernal로 회복, Holy에 취약, Poisoned 면역.' },
      { label: 'Elemental', text: '자기 원소 피해로 회복. 면역: Bleeding, Sickened, Poisoned.' },
      { label: 'Humanoid', text: '공통 특성 없음.' },
      { label: 'Plant', text: 'Fire에 취약. 면역: Frightened, Blinded.' },
      { label: 'Undead', text: 'Holy에 취약, Necrotic으로 회복. 면역: Bleeding, Sickened, Poisoned, Frightened.' },
    ],
    tables: ['t-enemy-type'],
    related: [req('vulnerability'), opt('conditions')],
    source: [core(129, 130, 131), rr(22)],
    verification: 'verified',
  },
  {
    id: 'creature-stat-block',
    kind: 'rule',
    category: 'creatures',
    en: 'Creature Stat Block',
    ko: '생물 능력치 블록',
    aliases: ['stat block', 'body', 'mind', 'combat skill', 'magic resistance', 'number', 'spoils', '능력치', '스탯', '전투 기술', '마법 저항', '개체 수'],
    summary: 'Body·Mind·Combat Skill·Endurance·Health·Hit Location·Level Adaptation·Magic Resistance·Number·Spoils·Trait·Type.',
    outcomes: [
      { label: 'Body', text: '힘·민첩 대항 판정에 사용.' },
      { label: 'Mind', text: '정신력·지각. 주로 Initiative·기습 대항에 사용.' },
      { label: 'Combat Skill', text: '공격과 방어 모두에 사용.' },
      { label: 'Endurance', text: '체질 공격(독 등) 저항.' },
      { label: 'Health', text: '죽거나 파괴되기 전까지 버틸 수 있는 피해량.' },
      { label: 'Hit Location', text: '사용할 명중 부위 표와 약점.' },
      { label: 'Level Adaptation', text: '현재 레벨에 맞춰 기본 능력치에 더할 변경 사항. 해당하는 조정을 모두 적용한다.' },
      { label: 'Magic Resistance', text: 'PC의 Magical 능력에 대한 저항 판정.' },
      { label: 'Number', text: '무리로 나오면 개체마다 Health·공격을 따로 추적.' },
      { label: 'Spoils', text: '처치 후 굴릴 전리품 표, 또는 직접 지정된 보상.' },
      { label: 'Trait', text: '경계, 추가 행동 등 해당 생물에만 적용되는 특수 규칙.' },
      { label: 'Type', text: '생물 분류. 유형은 공통 상태 면역이나 피해 유형의 취약·회복 효과를 정할 수 있다.' },
    ],
    notes: [
      { type: 'discrepancy', text: 'Rules Reference는 이 항목의 쪽수를 118·119로 적었지만 코어북 v1.2에서는 131–133쪽.', source: rr(22, 23) },
    ],
    related: [opt('creature-traits'), opt('encounter-difficulty'), opt('creature-types'), ed('encounter-setup'), ed('magical-attacks')],
    source: [core(131, 132), rr(22, 23)],
    verification: 'verified',
  },
  {
    id: 'creature-traits',
    kind: 'trait',
    category: 'creatures',
    en: 'Creature Traits',
    ko: '생물 특성',
    aliases: ['traits', 'alert', 'pack', 'penetrating', 'ruthlessness', 'savage', 'swift', 'venomous', '경계', '무리', '관통', '무자비', '야만', '신속', '맹독'],
    summary: 'Alert, Frightening, Horrifying, Pack, Penetrating (X), Ruthlessness (X), Savage, Swift, Venomous.',
    outcomes: [
      { label: 'Alert', text: '어떤 방법으로도 기습할 수 없다(항상 기습하는 능력·장비보다 우선).' },
      { label: 'Frightening / Horrifying', text: '전투 시작 Resolve, 실패 시 Sanity 2 / 4 손실. 무리여도 1회.' },
      { label: 'Pack', text: '자신을 제외한 같은 종류의 Pack 생물 중 같은 방에 살아 있는 개체마다 Combat Skill +5.' },
      { label: 'Penetrating (X)', text: '공격이 Armor X를 무시.' },
      { label: 'Ruthlessness (X)', text: '라운드당 추가 턴 X. 행동 상실 상태는 중첩당 턴 1개를 잃게 한다.' },
      { label: 'Savage', text: 'Parry 불가, Dodge로만 회피.' },
      { label: 'Swift', text: '반응에 대한 모든 페널티를 무시.' },
      { label: 'Venomous', text: '이 생물에게 피해를 입으면(명중 시에만) Endurance 실패 시 Poisoned (1).' },
    ],
    related: [opt('frightening-horrifying'), opt('surprise'), opt('attack-check'), opt('poisoned'), opt('stunned'), ed('ruthlessness')],
    source: [core(132, 133), rr(23, 24)],
    verification: 'verified',
  },
  {
    id: 'ruthlessness',
    kind: 'trait',
    category: 'creatures',
    en: 'Ruthlessness (X)',
    ko: '무자비 · 추가 행동',
    aliases: ['ruthlessness', 'extra turns', 'overseer turns', '무자비', '추가 턴', '추가 행동', '기절 상쇄'],
    summary: 'Ruthlessness (X)가 있으면 기본 1회에 X회를 더해 행동한다. 기절이나 마비처럼 행동을 잃게 하는 상태가 걸리면 중첩당 1회를 잃는다.',
    details: [
      '예를 들어 Ruthlessness (2)인 생물은 보통 3회 행동한다. Stunned (2)가 걸리면 2회를 잃고 1회만 행동하며, 기절 효과도 모두 소모된다.',
      'Overseer는 공격할 대상이 여럿이면 한 대상에 집중하기보다 나눠 공격하려 한다.',
    ],
    related: [req('creature-traits'), opt('stunned'), opt('paralyzed'), opt('overseers'), ed('co-op')],
    source: [core(132, 133, 179), rr(23, 24)],
    verification: 'verified',
  },
  {
    id: 'encounter-difficulty',
    kind: 'rule',
    category: 'creatures',
    en: 'Combat Encounter Difficulty (Level Adaptation)',
    ko: '조우 난이도 · 레벨 적응',
    aliases: ['level adaptation', 'scaling', 'encounter difficulty', '레벨 적응', '난이도 조정', '스케일링', 'per level'],
    summary: '조우를 준비할 때 생물 블록의 Level Adaptation을 현재 레벨에 맞게 적용한다. 조정은 누적(레벨 11이면 5·10 조정 모두).',
    details: ['예를 들어 기본 Health 8에 레벨당 +4인 생물은 레벨 3 PC와의 조우에서 Health 20이다.', 'Health나 Combat Skill 외에 피해 주사위나 특성이 늘어나는 생물도 있으므로 해당 블록의 조정 항목 전체를 확인한다.'],
    related: [req('creature-stat-block'), opt('game-terms', '⅃')],
    source: [core(131), rr(22)],
    verification: 'verified',
  },
  {
    id: 'overseers',
    kind: 'rule',
    category: 'overseers',
    en: 'Overseers',
    ko: 'Overseer',
    aliases: ['overseer', 'boss', 'lair', '오버시어', '보스', '지배자', 'ruthlessness', '도메인 지배자'],
    summary: '각 도메인을 지배하는 강력한 존재. Ruthlessness로 한 턴에 여러 번 공격하며, 대상이 여럿이면 공격을 분산한다. 처치하면 도메인 영향력이 사라진다.',
    details: [
      '처치 보상: XP +200, Sanity +D4, Valuable·Precious 표 각 1회(블록 기준).',
      '협동: Health 2배, PC당 추가 활성화 1회.',
      'Overseer Overthrown Personal Goal: Amulet 획득.',
    ],
    tables: ['t-overseer', 't-overseer-influence'],
    related: [req('overseer-influence'), opt('lair-check'), opt('creature-traits', 'Ruthlessness'), opt('co-op')],
    source: [core(179), rr(16)],
    verification: 'verified',
  },
  ...creatures.map(creatureEntry),
];
