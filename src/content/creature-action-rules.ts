import type { DamageType } from '../lib/damage';
import type { CreatureAction, CreatureRecord } from './entries/creatures';

type Resistance = 'Acrobatics' | 'Athletics' | 'Body' | 'Dodge' | 'Endurance' | 'Magic Resistance' | 'Resolve' | 'Spellward' | 'Thievery';
export type ActionDamage = readonly [type: DamageType, amount: string | number];
export interface CreatureActionRule {
  resistance?: Resistance;
  damage?: readonly ActionDamage[];
  success?: 'half';
  after?: Resistance;
  target?: string;
  timing?: string;
  healthOnly?: boolean;
  duration?: string;
  setupDuration?: string;
  elemental?: boolean;
  summons?: string;
}

const arcane = (amount: string | number): ActionDamage => ['Arcane', amount];
const bludgeoning = (amount: string | number): ActionDamage => ['Bludgeoning', amount];
const cold = (amount: string | number): ActionDamage => ['Cold', amount];
const fire = (amount: string | number): ActionDamage => ['Fire', amount];
const necrotic = (amount: string | number): ActionDamage => ['Necrotic', amount];
const pierce = (amount: string | number): ActionDamage => ['Piercing', amount];
const d = (...damage: ActionDamage[]): CreatureActionRule => ({ damage });
const check = (resistance: Resistance, ...damage: ActionDamage[]): CreatureActionRule => ({ resistance, damage });
const half = (resistance: Resistance, ...damage: ActionDamage[]): CreatureActionRule => ({ resistance, damage, success: 'half' });
const area = (rule: CreatureActionRule): CreatureActionRule => ({ ...rule, target: '범위 안 대상마다' });
const room = (rule: CreatureActionRule): CreatureActionRule => ({ ...rule, target: '방 안 대상마다' });
const after = (resistance: Resistance, ...damage: ActionDamage[]): CreatureActionRule => ({ damage, after: resistance });
const directHealth = (rule: CreatureActionRule): CreatureActionRule => ({ ...rule, healthOnly: true });

// Resistance and immediate damage only. Keep contingent/sustained details in the action's text.
const RULES: Record<string, Record<number, CreatureActionRule>> = {
  'cr-abyssal-vexator': { 3: { ...check('Dodge'), target: '시야 안 대상', timing: '붙잡힌 대상의 턴 시작마다 지속 피해' }, 5: check('Endurance', necrotic('D10')) },
  'cr-amalgam': { 3: room(check('Endurance', necrotic('D6'))) },
  'cr-astral-beast': { 1: d(arcane('D6')), 5: area(half('Spellward', arcane('D8'))) },
  'cr-bladewings': { 5: area(check('Resolve')) },
  'cr-bone-golem': { 3: d(necrotic('D6')) },
  'cr-bone-spiders': { 5: check('Dodge') },
  'cr-corpse-ants': { 3: room(check('Dodge', ['Acid', 'D6'])), 5: room(half('Endurance', necrotic('D8'))) },
  'cr-death-sage': {
    1: after('Endurance', necrotic('D6')),
    3: { ...check('Endurance'), duration: 'D4' },
    5: check('Endurance', necrotic('D6')),
  },
  'cr-dwerax': { 5: room(check('Acrobatics', bludgeoning('D4'))) },
  'cr-fangvine': { 5: check('Dodge') },
  'cr-flayed-knight': { 3: d(necrotic('D6')) },
  'cr-fleshmelt-slime': { 3: area(check('Endurance', ['Acid', '2D4'])), 5: check('Endurance', necrotic('2D4')) },
  'cr-giant-spider': { 3: check('Dodge'), 5: check('Resolve') },
  'cr-hive-larvae': { 3: room(check('Endurance')), 5: check('Endurance', necrotic('D6')) },
  'cr-hive-warrior': { 3: { ...check('Dodge', pierce(1)), after: 'Endurance' } },
  'cr-hollow-shambler': { 1: check('Athletics', pierce('2D4')), 3: { duration: 'D4', target: '생물 자신' }, 5: area(check('Resolve')) },
  'cr-living-moss': { 3: check('Dodge'), 5: directHealth(check('Endurance', necrotic(2))) },
  'cr-necropede': { 3: check('Endurance', necrotic('2D4')), 5: room(half('Dodge', pierce('D6'))) },
  'cr-netherfiend': { 3: after('Endurance', fire('D4')), 5: check('Athletics') },
  'cr-plaguebringer': { 3: room({ ...check('Endurance', ['Poison', 1]), duration: 'D4' }), 5: directHealth(d(necrotic(2))) },
  'cr-pyreborn': { 1: after('Dodge', fire('D6')), 3: area(check('Dodge', fire(2))), 5: area(check('Dodge', fire('D4'))) },
  'cr-ratkin-marauders': { 3: check('Dodge'), 5: check('Thievery') },
  'cr-razorjaw': { 5: check('Athletics') },
  'cr-reanimated-homunculus': {
    3: { ...area(check('Endurance')), timing: '오라 안 대상의 턴 시작마다 지속 피해' },
    5: { ...room(half('Dodge', necrotic('2D10'))), timing: '이 생물의 다음 턴 시작에 폭발' },
  },
  'cr-rotwalkers': {
    3: { ...area(check('Endurance')), timing: '오라 안 대상의 턴 시작마다 지속 피해' },
    5: { ...check('Athletics'), timing: '붙잡힌 대상의 턴 시작마다 지속 피해' },
  },
  'cr-skeletal-horrors': { 3: half('Endurance', necrotic('D6')), 5: area(check('Resolve')) },
  'cr-stone-warden': {
    1: after('Dodge', ['Force', 'D6']),
    3: room(check('Acrobatics', bludgeoning('D6'))),
    5: room(check('Athletics', bludgeoning('D8'))),
  },
  'cr-swarmer': { 3: area(check('Dodge', ['Acid', 'D6'])), 5: after('Endurance', pierce(2)) },
  'cr-umbra-fiend': { 3: room(after('Endurance', necrotic(2))) },
  'cr-unfettered-familiar': { 1: d(arcane('D6')), 3: check('Endurance', arcane(1)), 5: {
    ...check('Resolve', arcane('D6')), timing: '다음에 공격받을 때 반응으로 사용', target: '공격자',
  } },
  'cr-vaelorian-magus': { 1: d(necrotic('D6')), 3: area(check('Resolve')) },
  'cr-vinekin': { 3: { ...room(check('Dodge')), timing: '붙잡힌 대상의 턴 시작마다 지속 피해' } },
  'cr-voidweaver': { 1: d(arcane('D4+1')), 3: { target: '방 안 대상마다', timing: '2라운드 동안' }, 5: room(after('Athletics', arcane('D6'))) },
  'cr-vorleg': { 5: { ...check('Endurance', bludgeoning('2D10')), target: '이미 붙잡힌 대상' } },
  'cr-wraithskull': { 1: d(necrotic('D6')), 5: area(check('Resolve')) },
  'cr-wrath-elemental': { 1: room({ elemental: true }), 5: { target: '방 안 대상마다' } },
  'cr-carnage-devourer': {
    1: area(check('Dodge', bludgeoning('2D8'))), 3: area(check('Acrobatics', bludgeoning('D6'))),
    5: area(check('Resolve')), 6: area(check('Dodge', fire('D6'))),
  },
  'cr-dreadlord': {
    1: { target: '소환되는 Shadow Reaper', timing: 'Dreadlord 턴 직후 소환수가 공격', summons: 'D4' },
    2: { ...area(check('Resolve')), timing: '오라 근처에서 대상의 턴이 시작될 때', setupDuration: 'D4' },
    5: check('Endurance'), 6: { ...check('Spellward', necrotic('D6+2')), target: '최대 3대상 중 하나' },
  },
  'cr-glacial-burrower': {
    1: room(d(cold('2D6'))), 3: area(check('Acrobatics', bludgeoning('2D6'))),
    4: { ...after('Athletics', cold('2D6')), target: '최대 3대상 중 하나' },
    5: area(check('Dodge', bludgeoning('2D6'))),
  },
  'cr-gorehoof': { 1: room(check('Dodge', ['Slashing', 'D4'])), 6: room(check('Resolve')) },
  'cr-infernal-archon': {
    1: area(half('Dodge', fire('2D6'))), 4: check('Dodge', fire('D4+2')),
    3: { target: '소환되는 Lesser Demon', timing: '시전자 바로 다음에 행동', summons: 'D4' },
    5: room(check('Dodge', fire('3D4'))), 6: area(check('Spellward', fire('2D4'))),
  },
  'cr-infernal-tormentor': {
    1: room(half('Dodge', ['Infernal', '2D4'])), 4: room(half('Dodge', fire('3D4'))),
    6: room(half('Dodge', fire('D8'), ['Infernal', 'D4'])),
  },
  'cr-pyroclasmic-possessor': {
    1: { ...check('Resolve'), timing: '벗어나려면 대상 턴 종료마다 Resolve 판정' },
    2: area(half('Dodge', fire('D6'))),
    3: { ...check('Dodge', fire('2D6')), target: '최대 3대상 중 하나' },
    6: check('Athletics', fire('2D4')),
  },
  'cr-veilshifter': { 2: area({ duration: 'D4' }), 3: d(arcane('2D6')), 5: area(check('Athletics')), 6: d(arcane('4D6')) },
  'cr-venomcloud-siren': {
    1: room(check('Endurance', ['Poison', '2D6'])),
    3: { ...d(['Poison', '2D6']), target: '최대 3대상 중 하나' },
    4: area(check('Athletics')),
    5: room(check('Resolve')),
  },
  'cr-zephyrous-shadow': {
    1: room(half('Dodge', ['Lightning', '2D6'])),
    4: { after: 'Resolve', timing: '저주에 걸린 대상이 공격할 때마다' },
    6: room(half('Dodge', ['Force', '3D4'])),
  },
  'cr-arcane-companion': { 1: d(arcane('D6+1')), 5: after('Endurance', arcane('2D4')) },
  'cr-fire-elemental': { 5: room(d(fire('D4'))) },
  'cr-skeleton': { 5: check('Magic Resistance', necrotic('D4')) },
  'cr-frost-elemental': { 1: d(cold('D6')), 5: area(after('Spellward', cold('D4'))) },
  'cr-wight': { 5: check('Endurance', necrotic('D4+1')) },
};

export function creatureActionRule(creature: Pick<CreatureRecord, 'id' | 'group'>, action: CreatureAction): CreatureActionRule {
  const rule = RULES[creature.id]?.[action.min] ?? {};
  const minion = creature.group === 'minion';
  // Summoning brings a new actor into play without targeting a victim.
  const summon = creature.id === 'cr-dreadlord' && action.min === 1;
  return { ...rule, resistance: rule.resistance ?? (action.tag === 'Magical' && !summon
    ? minion ? 'Magic Resistance' : 'Spellward' : undefined) };
}
