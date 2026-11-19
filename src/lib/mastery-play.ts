import { masteryCatalog } from '../content/entries/masteries';
import type { DamageType } from './damage';

type CatalogAbility = (typeof masteryCatalog)[number]['abilities'][number];
type Check = 'magic' | 'attack' | 'unopposed' | 'body' | 'mind' | 'defense';
type Targets = 'self' | 'one' | 'all' | 'half-level' | 'several';
type Special = 'shell' | 'madness' | 'punishment' | 'blessing' | 'cleanse' | 'torrent';
type RollEffect = { dice: string; label: string; mode: 'damage' | 'pool' | 'recovery' | 'duration' | 'reduction'; type?: DamageType };

interface AbilityRule {
  check?: Check;
  targets?: Targets;
  roll?: RollEffect;
  effect?: string;
  resisted?: string;
  condition?: string;
  exception?: 'overseer' | 'necrotic';
  special?: Special;
  ifConfirmed?: string;
  follow?: string;
}

const damage = (dice: string, type: DamageType): RollEffect => ({ dice, type, label: `${type} 피해`, mode: 'damage' });
const pool = (dice: string, type: DamageType): RollEffect => ({ dice, type, label: '피해 풀 추가 주사위', mode: 'pool' });
const recovery = (dice: string, label: 'Wounds' | 'Sanity'): RollEffect => ({ dice, label, mode: 'recovery' });
const duration = (dice: string): RollEffect => ({ dice, label: '지속 라운드', mode: 'duration' });

// Every effect here uses the matching Mastery entry. Ongoing effects and situational
// modifiers stay in the paper record after the current roll has been resolved.
const ABILITY_RULES: Record<string, AbilityRule> = {
  'Infernal Flame': { roll: damage('D6+D4', 'Infernal') },
  'Soul Harvest': { targets: 'all', roll: damage('2D6', 'Infernal') },
  'Arcane Missiles': { targets: 'half-level', roll: damage('D4', 'Arcane') },
  'Magic Shell': { special: 'shell' },
  'Arcane Bolt': { roll: damage('3D10', 'Arcane') },
  'Feint': { check: 'defense', ifConfirmed: '공격을 Dodge로 방어했습니다.', effect: '다음 공격 보너스 +20' },
  'Uppercut': { roll: damage('2D8', 'Bludgeoning'), effect: '내 다음 방어 −20' },
  'Overwhelm': { check: 'unopposed', roll: pool('D8', 'Bludgeoning') },
  'Kidney Shot': { condition: 'Stunned', effect: 'Stunned (2)' },
  'Brace': { roll: { dice: 'D4', label: '피해 감소', mode: 'reduction' } },
  'Shield Bash': { condition: 'Dazed', effect: 'Dazed 2라운드' },
  'Sword & Board': { follow: '명중했다면 방패 추가 공격을 따로 해결합니다. 방패가 명중할 때 D4 Bludgeoning 피해를 굴립니다.' },
  'Poisoned Blade': { condition: 'Poisoned', effect: 'Poisoned (1)' },
  'Weaken': { roll: duration('D4+1'), effect: '대상이 방어할 때 Combat Skill −20' },
  'Sap': { condition: 'Stunned', effect: 'Stunned 2라운드' },
  'Ruthless Strike': { effect: '명중 시 Critical Strike. 방당 1회.' },
  'Heal Wounds': { roll: recovery('D4', 'Wounds') },
  'Divine Justice': { effect: 'Armor 무효 · 1라운드' },
  'Holy Flames': { roll: damage('3D10', 'Holy') },
  'Fire Bolt': { roll: damage('D6', 'Fire') },
  'Flame Spray': { targets: 'half-level', roll: damage('D4', 'Fire') },
  'Fire Cage': { condition: 'Restrained', effect: 'Restrained', follow: '탈출 판정은 각 라운드의 자유 행동으로 별도 처리합니다.' },
  'Fireball': { targets: 'all', roll: damage('3D6', 'Fire') },
  'Frost Bolt': { roll: damage('D6', 'Cold') },
  'Ice Nova': { targets: 'half-level', roll: damage('D6', 'Cold') },
  'Corpse Explosion': { targets: 'all', roll: damage('2D4', 'Necrotic') },
  'Sap Vitality': { condition: 'Cursed', effect: 'Cursed · 라운드마다 Combat Skill −5, 최대 −20' },
  'Enfeeble': { condition: 'Cursed', effect: 'Cursed · 전투 끝까지 받는 피해 +1' },
  'Curse Mind': { condition: 'Stunned', effect: 'Stunned (2)', resisted: 'Dazed (2)' },
  'Drain Lifeforce': { roll: damage('3D6', 'Necrotic'), exception: 'necrotic' },
  'Putrefy Armor': { follow: '효과를 적용할 부위를 지정합니다. Armor가 0이 되면 옮겨 가기 전 새 저항 판정을 합니다.' },
  'Vine Icon': { check: 'body', targets: 'one', condition: 'Restrained', effect: 'Restrained' },
  'Firebomb Icon': { check: 'magic', targets: 'all', roll: damage('2D10', 'Fire'), follow: '설치한 다음 라운드 시작에 이 굴림을 해결합니다.' },
  'Suppress Mind': { effect: '내 다음 턴까지 Magical 행동 불가' },
  'Heal Mind': { roll: recovery('D4', 'Sanity') },
  'Dominate': { exception: 'overseer', effect: '내 Minion으로 전환' },
  'Astral Punishment': { special: 'punishment' },
  'Aetheric Blessing': { special: 'blessing' },
  'Cleanse Mind': { special: 'cleanse' },
  'Arcane Torrent': { roll: damage('2D10', 'Arcane'), targets: 'several', special: 'torrent' },
  'Countershock': { check: 'defense', targets: 'one', ifConfirmed: '공격을 Parry로 방어했습니다.', roll: damage('D6', 'Force') },
  'Tempest': { targets: 'all', roll: damage('3D4', 'Lightning') },
  'Thunderous Slice': { effect: '선택한 부위 Armor 전부 제거' },
  'Set Trap': { check: 'mind', targets: 'one', roll: damage('3D4', 'Piercing'), follow: '기습 판정 승리 후 첫 행동으로 설치합니다. 적이 공격할 때 함정을 해결합니다.' },
  'Shadow Madness': { special: 'madness', targets: 'one' },
  'Reaper': { roll: recovery('D6', 'Sanity'), ifConfirmed: '이 공격으로 적을 처치했습니다.' },
  'Shadow Clone': { roll: duration('D4+1') },
  'Sure Blow': { check: 'unopposed' },
  'Thousand Strikes': { targets: 'all', condition: 'Dazed', effect: '일반 피해와 Dazed (1)' },
  'Overwhelming Technique': { effect: '전투 끝까지 Combat Skill −20' },
  'Bash': { roll: pool('D4', 'Bludgeoning') },
  'Sweeping Blow': { targets: 'all' },
  'Reckless Attack': { roll: pool('2D6', 'Bludgeoning') },
  'Charge': { targets: 'one', roll: damage('2D6', 'Bludgeoning'), follow: '전투 시작에만 사용합니다.' },
  'Purifying Flames': { roll: damage('2D6', 'Holy') },
  "God's Will": { roll: damage('D4+1', 'Psychic') },
};

export function describeMasteryAbility(ability: CatalogAbility) {
  const rule: AbilityRule = ABILITY_RULES[ability.name] ?? {};
  const magical = ability.use.split(' · ').includes('Magical');
  const weapons = /근접 (?:무기 Skill|공격) 판정|Unarmed Combat & Fist Weapons 판정/.test(ability.use);
  const check = rule.check ?? (magical ? 'magic' : weapons ? 'attack' : null);
  return {
    ...ability, ...rule, magical, check,
    targets: rule.targets ?? (check && check !== 'defense' ? 'one' : 'self'),
    passive: ability.use === '패시브',
    sustained: ability.use.includes('(Sustained)'),
    aether: Number(/\b(\d+) Aether\b/.exec(ability.use)?.[1] ?? 0),
    health: Number(/\b(\d+) Health\b/.exec(ability.use)?.[1] ?? 0),
    exhaustion: Number(/Exhaustion \+(\d+)/.exec(ability.use)?.[1] ?? 0),
    modifier: ability.name === 'Sap' ? -20 : 0,
    weaponSkill: ability.use.includes('Unarmed Combat & Fist Weapons') ? 'Unarmed Combat & Fist Weapons' : '무기 Skill',
  };
}

export type MasteryAbility = ReturnType<typeof describeMasteryAbility>;

export const damagingMasteryAbilities = masteryCatalog.flatMap((mastery) => mastery.abilities.filter((ability) => {
  const { roll, special } = describeMasteryAbility(ability);
  return roll?.mode === 'damage' || special === 'punishment' || special === 'madness'
    || ['Demon Shroud', 'Razorwind Icon', 'Fire Cage', 'Sword & Board'].includes(ability.name);
}).map((ability) => ({ ...ability, mastery: mastery.name })));

export function abilityRoll(ability: MasteryAbility, spent: number | null) {
  if (spent === null) return ability.roll;
  if (ability.special === 'madness') return damage(`${spent}D4`, 'Psychic');
  if (ability.special === 'punishment') return damage(`${spent}D6`, 'Arcane');
  if (ability.special === 'blessing') return recovery(`${Math.floor(spent / 3)}D6`, 'Wounds');
  return ability.roll;
}

export function readMasteryInteger(raw: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number | null {
  const text = raw.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}
