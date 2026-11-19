import type { RollResult } from './dice';
import { gearCount, type GearEffect } from './play-inventory';

type Answer = 'success' | 'failure' | string | number;
export type FollowAnswers = Partial<Record<string, Answer>>;
type Condition = (answers: FollowAnswers) => boolean;
type FollowAction =
  | { kind: 'check'; id: string; skill: string }
  | { kind: 'choice'; id: string; label: string; options: [string, string][] }
  | { kind: 'count'; id: string; label: string; initial?: number }
  | { kind: 'roll'; id: string; label: string; dice: string | ((answers: FollowAnswers) => string); text: (roll: RollResult) => string; gear?: (roll: RollResult) => GearEffect }
  | { kind: 'paper'; id: string; text: string | ((answers: FollowAnswers) => string); gear?: GearEffect }
  | { kind: 'table'; id: string; table: string }
  | { kind: 'spoils'; id: string }
  | { kind: 'link'; id: string; dest: string }
  | { kind: 'combat' | 'trader'; id: string; label: string }
  | { kind: 'environment-trap'; id: string };
export type FollowStep = FollowAction & { when?: Condition };

const paper = (id: string, text: Extract<FollowAction, { kind: 'paper' }>['text'], gear?: GearEffect): FollowStep => ({ kind: 'paper', id, text, gear });
const check = (id: string, skill: string): FollowStep => ({ kind: 'check', id, skill });
const choice = (id: string, label: string, options: [string, string][]): FollowStep => ({ kind: 'choice', id, label, options });
const count = (id: string, label: string, initial?: number): FollowStep => ({ kind: 'count', id, label, initial });
const rolled = (id: string, label: string, dice: string, text: (total: number) => string): FollowStep => ({
  kind: 'roll', id, label, dice, text: ({ total }) => text(total),
});
const EQUIPMENT_DELTAS = new Set(['동전', '광원', '물약', 'Torch', 'Crafting Supplies']);
const delta = (id: string, label: string, dice: string, name: string, sign: '+' | '−'): FollowStep => ({
  kind: 'roll', id, label, dice, text: ({ total }) => `${name} ${sign}${total}`,
  gear: EQUIPMENT_DELTAS.has(name) ? ({ total }) => gearCount(name, sign === '+' ? total : -total) : undefined,
});
const damage = (dice: string, type: string): FollowStep => rolled('damage', '받는 피해', dice, (total) => `${type} 피해 ${total}`);
const sanity = (dice = 'D4', sign: '+' | '−' = '−'): FollowStep => delta('sanity', 'Sanity 변화', dice, 'Sanity', sign);
const xp = (value: number): FollowStep => paper('xp', `XP +${value}`);
const table = (id: string): FollowStep => ({ kind: 'table', id, table: id });
const combat = (label = '전투 조우로'): FollowStep => ({ kind: 'combat', id: 'combat', label });
const link = (dest: string): FollowStep => ({ kind: 'link', id: dest, dest });
const spoils = (id = 'spoils'): FollowStep => ({ kind: 'spoils', id });
const darkness = () => table('t-growing-darkness');
const madness = () => table('t-madness');

function when(id: string, value: Answer, steps: FollowStep[]) {
  return steps.map((step): FollowStep => ({ ...step, when: (answers) => answers[id] === value && (!step.when || step.when(answers)) }));
}

function test(skill: string, success: FollowStep[] = [], failure: FollowStep[] = [], id = 'check') {
  return [check(id, skill), ...when(id, 'success', success), ...when(id, 'failure', failure)];
}

function optional(label: string, steps: FollowStep[], decline: FollowStep[] = []) {
  return [choice('take', label, [['yes', '한다'], ['no', '지나간다']]), ...when('take', 'yes', steps), ...when('take', 'no', decline)];
}

function altar(text: string) {
  return optional('제단에 바치기', [paper('cost', 'Health −1'), rolled('duration', '제단 효과 지속', 'D10+2', (total) => `${text} · ${total}곳 동안`)]);
}

const EVENT_STEPS: Record<number, FollowStep[]> = {
  1: [{ kind: 'environment-trap', id: 'environment-trap' }],
  11: [spoils()],
  21: [{ kind: 'trader', id: 'trader', label: '상인 거래로' }],
  31: altar('최대 Toughness +5'),
  32: altar('공격 판정 +10'),
  33: altar('피해 풀 +D4 Fire'),
  34: altar('최대 Aether +5'),
  35: optional('제단에 바치기', [paper('cost', 'Health −1'), sanity('D4', '+')]),
  36: test('Endurance', [], [paper('exhaustion', 'Exhaustion +2')]),
  37: test('Resolve', [], [delta('coins', '동전 손실', 'D100', '동전', '−')]),
  38: [...test('Resolve', [], [paper('sanity', 'Sanity −1')], 'resolve'), ...test('Dodge', [xp(10), spoils()], [damage('2D6', 'Bludgeoning')])],
  39: test('Reason', [xp(10)], [combat('기습 조우로')]),
  40: test('Resolve', [], [paper('sanity', 'Sanity −2')]),
  41: test('Reason', [spoils()], [link('cr-necropede'), combat('Necropede 조우로')]),
  42: test('Athletics', [spoils()]),
  43: test('Perception', [paper('weapon', '부적을 달면 이 방의 무기 피해 풀 +D4 Fire')]),
  44: test('Reason', [xp(10)], [damage('2D4', 'Acid')]),
  45: [...test('Perception', [spoils()], [], 'perception'), ...test('Dodge', [], [paper('condition', 'Bleeding (1)')])],
  46: optional('부상자 돕기', [paper('bandage', 'Bandage −1', gearCount('Bandage', -1)), ...test('Medicine', [xp(20)], [paper('failed', 'Sanity −1')])], [paper('ignored', 'Sanity −1')]),
  47: optional('문양 해독하기', test('Reason', [xp(20)], [sanity()])),
  48: optional('웅덩이에 손 넣기', test('Acrobatics', [spoils()], [darkness()])),
  49: optional('구멍에 팔 넣기', test('Athletics', [spoils()], [damage('2D6', 'Slashing')])),
  50: test('Resolve', [xp(20)], [choice('response', '실패 효과', [['darkness', '짙어지는 어둠'], ['madness', 'Madness']]),
    ...when('response', 'darkness', [darkness()]), ...when('response', 'madness', [madness()])]),
  51: [choice('response', '영묘에서 할 일', [['pray', '기도한다'], ['defile', '모독한다']]),
    ...when('response', 'pray', [sanity('D4', '+')]), ...when('response', 'defile', [paper('defile', 'Sanity −1'), spoils()])],
  52: test('Resolve', [xp(10)], [damage('3D4', 'Slashing')]),
  53: optional('시신 내려 주기', [paper('exhaustion', 'Exhaustion +2'), sanity('D4', '+')], [darkness()]),
  54: test('Reason', [xp(10)], [paper('sanity', 'Sanity −1')]),
  56: test('Resolve', [], [sanity('D6')]),
  57: test('Endurance', [paper('damage-pool', '다음 근접 공격 피해 풀 +D8 Cold')]),
  58: [choice('response', '석상에서 할 일', [['judge', '심판받는다'], ['break', '부순다']]),
    ...when('response', 'judge', test('Resolve', [spoils('first'), spoils('second')])),
    ...when('response', 'break', [paper('cleared', '활성 어둠 효과 하나 해제')])],
  59: [delta('exhaustion', 'Exhaustion 감소', 'D4', 'Exhaustion', '−')],
  60: test('Dodge', [], [paper('sanity', 'Sanity −1')]),
  61: test('Reason', [paper('overseer', '이 도메인 Overseer 첫 라운드 Stunned')]),
  62: test('Reason', [paper('skill', 'Bladed Weapons +1')]),
  63: test('Resolve', [xp(10)], [paper('sanity', 'Sanity −1'), paper('exhaustion', 'Exhaustion +1')]),
  64: test('Perception', [delta('torch', '횃불 수량', 'D4', 'Torch', '+'), delta('supplies', '제작 재료 수량', 'D10', 'Crafting Supplies', '+')]),
  65: optional('제단 더럽히기', test('Athletics', [paper('cleared', '활성 어둠 효과 하나 해제')], [combat()])),
  66: test('Stealth', [xp(20)], [paper('item', '벨트 또는 손에 든 아이템 한 개 버리기')]),
  68: test('Resolve', [sanity('D4', '+')], [paper('failed', 'Sanity −1')]),
  69: test('Resolve', [xp(10)], [delta('coins', '동전 도난', 'D100', '동전', '−')]),
  70: test('Resolve', [xp(20)], [paper('possessed', '빙의 · 새 방마다 Sanity −1 · 마법 아이템 파괴로 해제')]),
  71: test('Acrobatics', [], [damage('2D6', 'Force')]),
  72: test('Perception', [spoils()]),
  73: test('Stealth', [sanity('D4', '+')], [paper('exhaustion', 'Exhaustion +2'), darkness()]),
  74: test('Perception', [delta('potions', '물약 수량', 'D4', '물약', '+'), link('t-potions')], [paper('potion', '물약 +1', gearCount('물약', 1)), link('t-potions')]),
  75: test('Perception', [spoils()], [combat()]),
  76: test('Reason', [delta('coins', '동전 획득', '2D100', '동전', '+')]),
  77: test('Perception', [spoils()], [paper('sanity', 'Sanity −1')]),
  78: optional('감옥 문 열기', test('Athletics', [spoils()])),
  79: test('Medicine', [paper('herbs', '회복 약초 +1 · 먹을 때 Wounds 2D6 회복')]),
  80: optional('진흙 건너기', test('Athletics', [], [paper('exhaustion', '이번 시도 Exhaustion +1')])),
  81: test('Reason', [paper('ward', '다음 짙어지는 어둠 무시 1회')], [damage('2D6', 'Arcane')]),
  82: [...test('Dodge', [], [damage('2D4', 'Slashing')], 'dodge'), ...test('Endurance', [], [paper('rot', '부패병 감염'), link('the-rot')])],
  83: [sanity('D6', '+')],
  84: test('선택한 무기 Skill', [xp(10)], [damage('D12', 'Bludgeoning')]),
  85: optional('분수에서 마시기', [damage('2D6', 'Infernal'), sanity('D6', '+')]),
  86: [choice('response', '두 문의 선택', [['left', '왼쪽 문'], ['right', '오른쪽 샘에서 마시기']]),
    ...when('response', 'left', [paper('lair', '은신처 주사위 한 단계 감소')]),
    ...when('response', 'right', [darkness(), delta('toughness', 'Toughness 회복', 'D10', 'Toughness', '+')])],
  87: test('Athletics', [delta('coins', '동전 획득', '3D20', '동전', '+')], [paper('sanity', 'Sanity −1')]),
  88: test('Perception', [], [combat('기습 조우로')]),
  89: optional('검은 열매 먹기', [rolled('berry', '열매 효과', 'D6', (total) => total <= 3 ? 'Exhaustion −5' : 'Poison 피해 굴림'),
    { ...damage('2D4', 'Poison'), when: (answers) => Number(answers.berry) >= 4 }]),
  90: test('Acrobatics', [spoils()], [damage('D10', 'Bludgeoning')]),
  91: optional('비전 장치 살피기', test('Reason', [xp(10)], [paper('blast', '다음 짙어지는 어둠 대신 5D4 Bludgeoning 폭발')]),
    [paper('ignored', '다음 짙어지는 어둠 대신 5D4 Bludgeoning 폭발')]),
  92: test('Reason', [paper('ward', '다음 짙어지는 어둠 무시 1회')]),
  93: test('Reason', [paper('map', '다음 방 3곳 미리 생성'), link('t-room-shape')]),
  94: optional('구체 만지기', [delta('aether', '임시 Aether', 'D10', '임시 Aether', '+'), paper('initiative', '다음 전투 Initiative 패배')]),
  95: optional('사슬 당기기', test('Athletics', [xp(20)], [paper('enemy', '다음 조우 적 Combat Skill +20')])),
  96: test('Reason', [paper('initiative', '다음 전투 Initiative +20')]),
  97: optional('거래 받기', [delta('sanity', '최대 Sanity 감소', 'D4', '최대 Sanity', '−'), delta('toughness', '최대 Toughness 증가', 'D4', '최대 Toughness', '+')]),
  98: test('Acrobatics', [], [paper('condition', 'Bleeding (1)')]),
  99: [delta('exhaustion', 'Exhaustion 증가', 'D6', 'Exhaustion', '+')],
  100: test('Resolve', [xp(100)], [madness()]),
};

function counted(id: string, label: string, sides: number, text: (roll: RollResult) => string): FollowStep {
  return { kind: 'roll', id, label, dice: (answers) => `${answers.count}D${sides}`,
    when: (answers) => Number(answers.count) > 0, text };
}

export function followUpSteps(kind: 'event' | 'darkness', row: number, darknessEffectCount?: number): FollowStep[] | undefined {
  if (kind === 'event') return EVENT_STEPS[row];
  switch (row) {
    case 3: return test('Resolve', [], [count('count', '활성 어둠 효과 수', darknessEffectCount), paper('sanity', (answers) => Number(answers.count) > 0 ? `Sanity −${answers.count}` : '')]);
    case 5: return optional('아직 회복하지 못한 피해가 있나요?', [damage('D6', 'Psychic')]);
    case 7: return optional('Sanity가 최대보다 낮나요?', [paper('sanity', 'Sanity −1')]);
    case 9: return [delta('aether', '최대 Aether 감소', 'D4', '최대 Aether', '−')];
    case 11: return [delta('toughness', '최대 Toughness 감소', 'D6', '최대 Toughness', '−')];
    case 21: return [paper('spellward', 'Spellward −5')];
    case 25: return [rolled('belt', '벨트 판정', 'D4', (total) => `벨트 ${total}번 칸에 물건이 있으면 파괴`)];
    case 27: return test('Resolve', [], [sanity()]);
    case 31: return [count('count', '동료·Minion 수'), ...when('count', 0, [damage('D8', 'Psychic')]),
      counted('minions', '동료·Minion마다 한 번', 6, ({ dice }) => {
        const lost = dice.flatMap((value, index) => value === 1 ? [`${index + 1}번`] : []);
        return lost.length ? `동료·Minion ${lost.join(', ')} 소멸` : '동료·Minion 모두 생존';
      })];
    case 33: return [count('count', '해제한 어둠 효과 수', darknessEffectCount),
      paper('health', (answers) => Number(answers.count) > 0 ? `Health −${answers.count}` : ''),
      paper('sanity', (answers) => Number(answers.count) > 0 ? `Sanity −${answers.count}` : '')];
    case 53: return test('Endurance', [], [damage('3D4', 'Poison')]);
    case 57: return [paper('skill', '선택한 Skill −10')];
    case 63: return test('선택한 무기 Skill', [xp(10)], [damage('D10', 'Slashing')]);
    case 67: return [delta('light', '광원 감소', 'D4', '광원', '−')];
    case 71: return test('Resolve', [xp(20)], [sanity()]);
    case 75: return [count('count', '현재 Madness 수'), counted('damage', '받는 피해', 6, ({ total }) => `Psychic 피해 ${total}`)];
    case 79: return test('Dodge', [], [damage('3D6', 'Bludgeoning')]);
    default: return undefined;
  }
}
