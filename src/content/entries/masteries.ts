import type { Entry, Relation } from '../schema';
import { core, opt, ed } from '../helpers';

/**
 * The 20 Masteries (Core v1.2 pp.22–61, even pages; odd pages are "Where did you train?" flavor tables
 * and are not summarised). Ability and Feature names are the book's English labels; every Korean
 * sentence is an original summary of the mechanic, not a translation. "L" = character level.
 */

type Tier = [name: string, use: string, text: string];
interface MasteryDef {
  id: string;
  en: string;
  ko: string;
  page: number;
  aliases: string[];
  role: string;
  feature: [name: string, text: string];
  tiers: [Tier, Tier, Tier, Tier, Tier];
  rel?: Relation[];
  notes?: string[];
}

// Ability usage shorthands
const STD = '표준 행동 1';
const STD2 = '표준 행동 2';
const MAG = 'Magical';
const REACT = '반응';
const FREE = '자유 행동';
const PASSIVE = '패시브';
const FIST_CHECK = 'Unarmed Combat & Fist Weapons 판정';
const ae = (n: number | string, sustained = false) => `${n} Aether${sustained ? ' (Sustained)' : ''}`;
const u = (...parts: string[]) => parts.join(' · ');

const MASTERIES: MasteryDef[] = [
  {
    id: 'm-abyssal-reaver',
    en: 'Abyssal Reaver',
    ko: '심연의 약탈자',
    page: 22,
    aliases: ['abyssal reaver', '어비설 리버', '악마', 'infernal', '지옥불', '근접 마법'],
    role: '악마의 힘을 무기와 주문에 실어 싸우는 근접 전사. Infernal 피해와 Sanity 회복.',
    feature: ["Conqueror's Vitality", '전투 조우를 이길 때마다 임시 Toughness +1. 쓰거나 휴식할 때까지 유지되고 최대치를 넘을 수 있다.'],
    tiers: [
      ['Infernal Flame', u(STD, MAG, ae(4)), '대상 하나에 D6+D4 Infernal 피해.'],
      ['Hellish Weapon', u(STD, ae(5, true)), '유지되는 동안 Damage Pool에 D6 Infernal 추가.'],
      ['Demonic Pact', PASSIVE, '최대 Sanity −5. 대신 Frightened·Poisoned 면역.'],
      ['Demon Shroud', u(STD, ae(5)), '전투가 끝날 때까지, 공격해서 나에게 피해를 준 적은 Infernal 피해 1을 받는다.'],
      ['Soul Harvest', u(STD, MAG, ae(6)), '방 안의 모든 적에게 2D6 Infernal 피해. 피해를 입힌 적 1체당 Sanity 2 회복.'],
    ],
    rel: [ed('frightened'), ed('poisoned'), ed('sanity')],
  },
  {
    id: 'm-arcanist',
    en: 'Arcanist',
    ko: '비전술사',
    page: 24,
    aliases: ['arcanist', '아케니스트', '마법사', 'wizard', 'arcane', '비전'],
    role: '순수 비전 마법사. 다중 대상 피해, 보호막, 빛, 소환수.',
    feature: ['Arcane Feedback', '내 능력으로 Arcane 피해를 받은 생물에게는 이후 내 Arcane 피해가 그 생물 한정으로 +1씩 누적된다.'],
    tiers: [
      ['Arcane Missiles', u(STD, MAG, ae(4)), '적 최대 L/2체에게 각각 D4 Arcane 피해.'],
      ['Magic Shell', u(REACT, '비용 특수'), '전신을 보호한다. 이 반응에 지불한 Aether 2당 들어오는 피해 1을 흡수한다.'],
      ['Create Light', u(STD, ae(4, true)), '떠다니는 빛. 유지되는 동안 광원이 필요 없다.'],
      ['Summon Arcane Companion', u(STD2, ae(4, true)), 'Arcane Companion 소환. 파괴될 때까지 유지(능력치 200쪽).'],
      ['Arcane Bolt', u(STD, MAG, ae(7)), '대상 하나에 3D10 Arcane 피해.'],
    ],
    rel: [opt('cr-arcane-companion'), ed('lightsource'), ed('minions')],
  },
  {
    id: 'm-brawler',
    en: 'Brawler',
    ko: '격투가',
    page: 26,
    aliases: ['brawler', '브롤러', 'unarmed', 'fist', 'monk', '맨손', '주먹', '격투'],
    role: '맨손·주먹 무기 전문. 기절·연속 방어에 강하다.',
    feature: ['Stonefists', '맨손 피해가 D6으로 오른다. 주먹 무기를 쓰면 Damage Pool에 D4 Bludgeoning 추가.'],
    tiers: [
      ['Feint', u(REACT, 'Dodge 판정'), 'Physical 행동으로 공격받았을 때 Dodge에 성공하면, 다음 공격 보너스가 +10 대신 +20.'],
      ['Uppercut', u(STD, FIST_CHECK), '명중하면 2D8 Bludgeoning 피해. 이 능력을 사용하면 내 다음 방어 판정은 −20.'],
      ['Overwhelm', u(FREE, FIST_CHECK), '전투당 1회. 대상은 이 공격에 방어할 수 없다. 비대항 Skill 판정에 성공하면 이 공격의 Damage Pool에 D8 Bludgeoning을 추가한다.'],
      ['Kidney Shot', u(STD, FIST_CHECK), '명중하면 대상에게 Stunned (2)를 부여한다.'],
      ['Perfect Blocking Stance', PASSIVE, '연속 반응 페널티가 첫 반응 이후 −20 대신 −10씩.'],
    ],
    rel: [ed('unarmed'), ed('stunned'), ed('defense-reaction-penalty')],
  },
  {
    id: 'm-bulwark',
    en: 'Bulwark',
    ko: '방벽',
    page: 28,
    aliases: ['bulwark', '불워크', 'tank', 'shield', '방패', '탱커', '중갑'],
    role: '방패와 중갑의 수호자. 피해 감소와 높은 Toughness.',
    feature: ['Hard Training', '방어구의 Maneuverability 페널티를 모두 무시. Endurance +10.'],
    tiers: [
      ['Brace', u(REACT, 'Exhaustion +2'), '적의 공격 굴림 전에 선언한다. 들어오는 피해를 D4 줄인다.'],
      ['Shield Bash', u(STD, '근접 공격 판정', '방패 장착'), '명중 시 대상 Dazed 2라운드.'],
      ['Sword & Board', u(STD, '근접 공격 판정', '방패 장착'), '무기 공격이 명중하면 즉시 방패로 추가 공격을 할 수 있다. 추가 행동 비용 없이 공격하며 명중 시 D4 Bludgeoning 피해를 준다.'],
      ['Battle Form', PASSIVE, 'Toughness가 레벨만큼 영구 증가. 이후 레벨업할 때마다 Toughness +2.'],
      ['Bastion', PASSIVE, 'Bludgeoning 면역, Piercing 저항.'],
    ],
    rel: [ed('dazed'), ed('damage-types'), ed('exhaustion')],
    notes: ['Battle Form의 “레벨만큼” 증가는 습득 시점 레벨 기준으로 읽힌다. 책에 추가 설명은 없다.'],
  },
  {
    id: 'm-duskblade',
    en: 'Duskblade',
    ko: '황혼의 칼날',
    page: 30,
    aliases: ['duskblade', '더스크블레이드', 'assassin', 'rogue', '암살자', '도적', '은신'],
    role: '암살자. 독·약화·기절, 확정 치명타, 투명화.',
    feature: ['Sudden Strike', '나를 인지하지 못한 대상에게는 특정 부위를 Disadvantage 없이 조준할 수 있다.'],
    tiers: [
      ['Poisoned Blade', u(STD, MAG, ae(3)), '독 칼날 투척 — 대상 Poisoned (1).'],
      ['Weaken', u(STD, MAG, ae(5)), 'D4+1라운드 동안 대상이 방어할 때 Combat Skill −20.'],
      ['Sap', u(STD, 'Hard(−20) 근접 공격 판정'), '명중 시 대상 Stunned 2라운드.'],
      ['Ruthless Strike', u(STD, '근접 공격 판정'), '명중하면 자동으로 Critical Strike. 방당 1회.'],
      ['Invisibility', u(STD, ae(6)), '적이 나를 직접 지정할 수 없다. 방을 나가거나 공격하면 해제. 투명 중 내 공격을 막는 적은 Combat Skill −40.'],
    ],
    rel: [ed('poisoned'), ed('stunned'), ed('hit-location'), ed('surprise')],
  },
  {
    id: 'm-emissary',
    en: 'Emissary',
    ko: '신의 사자',
    page: 32,
    aliases: ['emissary', '에미서리', 'cleric', 'priest', '성직자', '사제', '치유', 'holy', '신성'],
    role: '신의 대리인. 치유·상태 해제·Holy 피해.',
    feature: ['Spiritual Healing', '새 캠프 활동 “Pray”: Sanity D4 회복, Exhaustion +2, Camp Check 굴림 −1.'],
    tiers: [
      ['Heal Wounds', u(STD, ae(4), 'Exhaustion +2'), '자신의 Wounds를 D4 회복한다.'],
      ['Unbreakable Faith', u(FREE, ae(4)), '자신의 다음 공격 판정에 +40 보정을 적용한다.'],
      ['Remove Condition', u(STD, ae(4)), '자신에게 걸린 상태 이상 중 원하는 하나를 제거한다.'],
      ['Divine Justice', u(FREE, MAG, ae(2)), '1라운드 동안 대상의 Armor 무효.'],
      ['Holy Flames', u(STD, MAG, ae(10)), '대상 하나에 3D10 Holy 피해.'],
    ],
    rel: [ed('camp-activities'), ed('camp-check'), ed('healing'), ed('conditions'), ed('exhaustion'), ed('difficulty', 'Unbreakable Faith의 판정 보정')],
  },
  {
    id: 'm-flamecaster',
    en: 'Flamecaster',
    ko: '화염술사',
    page: 34,
    aliases: ['flamecaster', '플레임캐스터', 'fire', 'pyromancer', '화염', '불'],
    role: '화염 마법사. 단일·광역 Fire 피해와 구속, 화염 정령.',
    feature: ['Fireheart', 'Fire 피해를 받으면 오히려 회복(Restored).'],
    tiers: [
      ['Fire Bolt', u(STD, MAG, ae(4)), '대상 하나에 D6 Fire 피해.'],
      ['Flame Spray', u(STD, MAG, ae(4)), '앞쪽 적 최대 L/2체에 각각 D4 Fire 피해.'],
      ['Fire Cage', u(STD, MAG, ae(6)), '대상에게 Restrained를 부여한다. 갇힌 대상은 매 라운드 자유 행동으로 Magic Resistance 판정을 시도한다. 성공하면 탈출하고, 실패하면 피할 수 없는 Fire 피해 1을 받는다.'],
      ['Summon Fire Elemental', u(STD2, ae(4, true)), 'Fire Elemental 소환. 파괴될 때까지 유지(201쪽).'],
      ['Fireball', u(STD, MAG, ae(10)), '방 안의 모든 적에게 3D6 Fire 피해.'],
    ],
    rel: [ed('restrained'), opt('cr-fire-elemental'), ed('damage-types', 'Restored'), ed('minions')],
  },
  {
    id: 'm-frostweaver',
    en: 'Frostweaver',
    ko: '서리술사',
    page: 36,
    aliases: ['frostweaver', '프로스트위버', 'ice', 'cold', 'frost', '얼음', '냉기', '서리'],
    role: '냉기 마법사. Freezing 부여, 얼음 방패, Armor 무시 얼음 무기.',
    feature: ['Relentless Winter', '내 Frostweaver 주문으로 피해를 입은 대상은 Freezing.'],
    tiers: [
      ['Frost Bolt', u(STD, MAG, ae(4)), '대상 하나에 D6 Cold 피해.'],
      ['Ice Shield', u(REACT, ae(3)), '공격 하나에 대해 Parry +30.'],
      ['Ice Nova', u(STD, MAG, ae(5)), '주변 적 최대 L/2체에 각각 D6 Cold 피해.'],
      ['Summon Frost Elemental', u(STD2, ae(4, true)), 'Frost Elemental 소환. 파괴될 때까지 유지(201쪽).'],
      ['Frost Weapon', u(STD, ae(4, true)), '원하는 형태의 얼음 무기(해당 일반 무기의 특성 그대로). D8+1 Cold, Armor 무시. 부서져도 유지비를 내는 한 재생. 추가 피해 보너스는 Armor를 무시하지 않는다.'],
    ],
    rel: [ed('freezing'), opt('cr-frost-elemental'), ed('minions'), ed('weapon-traits')],
  },
  {
    id: 'm-gravecaller',
    en: 'Gravecaller',
    ko: '무덤술사',
    page: 38,
    aliases: ['gravecaller', '그레이브콜러', 'necromancer', '강령술사', '언데드', 'skeleton', 'wight', 'necrotic'],
    role: '강령술사. 시체로 해골·Wight를 부리고 시체를 터뜨린다.',
    feature: ['Necrotic Vitality', '표준 행동으로 내 언데드 소환수 하나를 희생해 Wounds D4 또는 Sanity 1 회복.'],
    tiers: [
      ['Raise Skeleton', u(STD2, ae(2, true), 'Humanoid 또는 Animal 시체'), '주변 시체에서 Skeleton을 일으킨다. 막 쓰러뜨린 적의 시체도 쓸 수 있다. Skeleton은 파괴될 때까지 남는다(202쪽).'],
      ['Corpse Explosion', u(STD, ae(2), 'Humanoid 또는 Animal 시체'), '주변 시체를 터뜨려 방 안 모든 적에게 2D4 Necrotic 피해를 준다.'],
      ['Bloodskin', u(STD, '2 Health + 4 Aether'), '전투 끝까지 온몸 Armor +1. 전투당 1회.'],
      ['Raise Wight', u(STD2, ae(4, true)), '주변 영혼을 붙잡아 Wight를 소환한다. Wight는 파괴될 때까지 남는다(203쪽).'],
      ['Necrolord', PASSIVE, 'Necrotic 피해로 회복(Restored). 내 언데드 소환수는 Necrotic 피해 +D6, Health +2.'],
    ],
    rel: [opt('cr-skeleton'), opt('cr-wight'), ed('minions'), ed('damage-types', 'Restored')],
  },
  {
    id: 'm-hexmancer',
    en: 'Hexmancer',
    ko: '저주술사',
    page: 40,
    aliases: ['hexmancer', '헥스맨서', 'warlock', 'curse', 'hex', '저주', '흑마법'],
    role: '저주 전문가. Cursed로 약화시키고 생명력을 빼앗는다.',
    feature: ['Unescapable Curse', 'Cursed 상태인 대상을 공격하면 피해 +1.'],
    tiers: [
      ['Sap Vitality', u(STD, MAG, ae(5)), '대상 Cursed. 매 라운드 Combat Skill −5씩, 최대 −20.'],
      ['Enfeeble', u(STD, MAG, ae(3)), '대상 Cursed, 전투 끝까지 모든 피해 +1로 받는다. 대상당 1회.'],
      ['Curse Mind', u(STD, MAG, ae(5)), 'Magic Resistance 실패 시 Stunned (2), 성공해도 Dazed (2).'],
      ['Drain Lifeforce', u(STD, MAG, ae(6)), '대상에게 3D6 Necrotic, 같은 양만큼 내 Wounds 회복. Necrotic으로 회복하는 대상에겐 무효.'],
      ['Putrefy Armor', u(STD, MAG, ae(6)), '고른 부위의 Armor가 매 라운드 1씩 감소해 0까지. 0이 되면 대상이 다시 Magic Resistance 판정, 실패하면 내가 고른 다른 부위로 옮겨 간다.'],
    ],
    rel: [ed('cursed'), ed('stunned'), ed('dazed'), ed('armor')],
  },
  {
    id: 'm-icon-caller',
    en: 'Icon Caller',
    ko: '성상 소환사',
    page: 42,
    aliases: ['icon caller', '아이콘 콜러', 'icon', 'totem', '토템', '성상', '설치'],
    role: '전장에 Icon을 설치해 지속 효과를 내는 술사.',
    feature: ['Summon', '전투 중 표준 행동으로 Icon 하나를 설치한다. 같은 종류는 하나만, 전체는 최대 두 개까지 둔다. 세 번째를 설치하려면 기존 Icon 하나를 파괴한다. 적은 Icon을 직접 공격할 수 없으며 적의 범위 효과 행동은 Icon을 파괴한다.'],
    tiers: [
      ['Restoring Icon', u(STD, ae(6)), '우호적인 생물 모두가 매 라운드 Toughness 1을 회복한다.'],
      ['Vine Icon', u(STD, ae(2)), 'Body 판정에 실패한 대상 하나 Restrained. 대상이 풀려나면 Icon 파괴.'],
      ['Firebomb Icon', u(STD, ae(8)), '다음 라운드 시작에 폭발 — Magic Resistance에 실패한 방 안 모든 적에게 2D10 Fire.'],
      ['Razorwind Icon', u(STD, ae(10)), '매 라운드 방 안 모든 적에게 Slashing 피해 1.'],
      ['Strength Icon', u(STD, ae(10)), '아군 전체 임시 Toughness +5, Damage Pool에 2D4 Bludgeoning 추가.'],
    ],
    rel: [ed('restrained')],
    notes: ['Strength Icon의 Damage Pool 보너스가 Icon이 있는 동안 계속인지 다음 공격 한 번인지 책은 명시하지 않는다.'],
  },
  {
    id: 'm-mindbinder',
    en: 'Mindbinder',
    ko: '정신 결속자',
    page: 44,
    aliases: ['mindbinder', '마인드바인더', 'psion', 'mind', 'enchanter', '정신', '지배', '매혹'],
    role: '정신 조작자. 마법 봉쇄, 전투 회피, 정찰, 적 지배.',
    feature: ['Mind Blur', '나를 공격하는 적은 항상 Combat Skill −10.'],
    tiers: [
      ['Suppress Mind', u(FREE, MAG, ae(3)), '내 다음 턴까지 대상은 Magical 행동 불가.'],
      ['Heal Mind', STD, '자신의 Sanity를 D4 회복한다. 캠프 휴식당 1회.'],
      ['Calm', u(STD, ae(10)), '방 안의 적들이 나를 공격하지 않는다. 즉시 방을 떠나야 하며 그 방을 뒤지거나 전리품을 챙길 수 없다. Overseer에게는 효과가 없다.'],
      ['Astral Projection', PASSIVE, '캠프 휴식당 1회, 이동하지 않고 앞쪽 방을 최대 5개 생성해 전부 파악한다.'],
      ['Dominate', u(STD, MAG, ae(4, true)), '대상이 내 Minion이 된다. Overseer에겐 무효.'],
    ],
    rel: [ed('minions'), ed('room-shape'), ed('overseers'), ed('once-per-rest')],
  },
  {
    id: 'm-ritualist',
    en: 'Ritualist',
    ko: '의식술사',
    page: 46,
    aliases: ['ritualist', '리추얼리스트', 'ritual', 'component', '의식', '재료', '룬'],
    role: 'Ritual Component를 소모해 효과를 키우는 의식 마법사.',
    feature: ['Ritual Components', '새 캠프 활동 “Prepare Components”: Crafting Supplies 1개 → Ritual Component 1개, 한 활동에서 원하는 만큼. Camp Check −4.'],
    tiers: [
      ['Astral Punishment', u(STD, MAG, ae(5)), '소모한 Ritual Component 1개당 D6 Arcane 피해.'],
      ['Aetheric Blessing', u(STD, ae(10)), '소모한 Ritual Component 3개당 자신의 Wounds를 D6 회복한다.'],
      ['Cleanse Mind', u(STD, ae(5)), '소모한 Ritual Component 3개당 자신의 Sanity를 1 회복한다.'],
      ['Sigil of Power', u(STD, 'Ritual Component 5개'), '무기에 영구 D10 Arcane 추가 피해. 무기당 1회.'],
      ['Arcane Torrent', u(STD, MAG, ae(5)), '대상 하나에 2D10 Arcane 피해를 준다. 대상 하나를 추가할 때마다 Ritual Ingredient 4개를 쓰며, 추가 대상도 각각 2D10 Arcane 피해를 받는다.'],
    ],
    rel: [ed('camp-activities'), ed('camp-check')],
    notes: ['46쪽의 Arcane Torrent는 추가 재료를 Ritual Ingredient라고 표기하고 다른 Tier와 Prepare Components는 Ritual Component라고 표기한다. 212쪽 장비표의 명칭은 Ritual Ingredient이며 두 이름의 관계는 따로 설명하지 않는다.'],
  },
  {
    id: 'm-stormbrand',
    en: 'Stormbrand',
    ko: '폭풍의 낙인',
    page: 48,
    aliases: ['stormbrand', '스톰브랜드', 'dual wield', 'lightning', 'storm', '쌍수', '번개', '폭풍'],
    role: '쌍수 무기와 번개 마법을 합친 전사.',
    feature: ['Dual Wielder', '한손 무기 두 개를 들 때의 불이익이 없다.'],
    tiers: [
      ['Infuse Weapon', u(STD, ae(4, true)), '그 무기를 쓰는 동안 Damage Pool에 D4 Lightning 추가.'],
      ['Countershock', u(REACT, ae(4)), 'Parry에 성공하면 상대에게 D6 Force 피해.'],
      ['Tempest', u(STD, MAG, ae(5)), '방 안 모든 적에게 3D4 Lightning.'],
      ['Thunderous Slice', u(STD, '근접 공격 판정', ae(4)), '명중해도 피해는 주지 않는다. 내가 고른 명중 부위의 Armor를 전부 제거한다.'],
      ['Tempestuous Rage', u(STD, ae(4)), '3라운드 동안 라운드마다 표준 행동 +1. 끝나면 1라운드 Dazed.'],
    ],
    rel: [ed('dual-wielding'), ed('defensive-move', 'Parry'), ed('dazed'), ed('armor')],
  },
  {
    id: 'm-tracker',
    en: 'Tracker',
    ko: '추적자',
    page: 50,
    aliases: ['tracker', '트래커', 'ranger', 'survival', '레인저', '생존', '사냥꾼', '함정'],
    role: '생존·은신·함정 전문가. 탐험과 캠프를 안정시킨다.',
    feature: ['Survivor', 'Scavenge와 Perception 판정에 항상 Advantage.'],
    tiers: [
      ['Cave Foraging', PASSIVE, 'Scavenging 판정에 성공할 때마다 Cooking Ingredient 1개 추가.'],
      ['Set Trap', STD, '전투 전 Surprise 판정에서 이겼다면 첫 행동으로 함정을 설치할 수 있다. 적이 공격할 때 그 적이 Mind 판정에 실패하면 함정이 발동해 3D4 Piercing 피해를 준다.'],
      ['Conceal Camp', PASSIVE, 'Camp Check 굴림 +2.'],
      ['Will to Survive', PASSIVE, 'Health가 0 이하로 떨어질 공격이면 1로 남는다. 캠프 휴식당 1회.'],
      ['Avoid Danger', PASSIVE, 'Tension Die가 D8 대신 D10에서 시작.'],
    ],
    rel: [ed('scavenging'), ed('camp-check'), ed('tension-die'), ed('surprise'), ed('advantage')],
    notes: ['Set Trap은 적의 Mind 판정이 성공한 뒤에도 함정이 남는지 따로 설명하지 않는다.'],
  },
  {
    id: 'm-umbra-phantom',
    en: 'Umbra Phantom',
    ko: '그림자 망령',
    page: 52,
    aliases: ['umbra phantom', '엄브라 팬텀', 'shadow', '그림자', '어둠', 'darkvision', '분신'],
    role: '그림자 술사. 어둠 시야, Sanity를 피해로 바꾸기, 전투 이탈, 분신.',
    feature: ['One With Darkness', 'Spellward +10, Sanity +5.'],
    tiers: [
      ['Darksight', u(STD, ae(5, true)), '완전한 어둠도 볼 수 있다. 광원이 필요 없다.'],
      ['Shadow Madness', u(STD, '비용 특수'), '소모한 Sanity 1마다 대상 하나에 D4 Psychic 피해를 준다.'],
      ['Vanish', u(STD, ae(4)), '즉시 전투에서 이탈, 불이익 없이 방을 나갈 수 있다. 휴식당 1회.'],
      ['Reaper', u(STD, '근접 공격 판정'), '이 공격으로 적을 죽이면 Sanity D6 회복.'],
      ['Shadow Clone', u(STD, ae(10)), '나와 같은 능력을 가진 분신을 D4+1라운드 조종. 끝나면 분신의 효과·소환도 사라진다. 분신은 분신을 만들 수 없다.'],
    ],
    rel: [ed('lightsource'), ed('sanity'), ed('combat-actions', 'Flee'), ed('resistances')],
    notes: ['Shadow Clone에는 분신의 별도 행동 순서나 자원 관리 방식이 명시되어 있지 않다.'],
  },
  {
    id: 'm-weapon-master',
    en: 'Weapon Master',
    ko: '무기의 달인',
    page: 54,
    aliases: ['weapon master', '웨폰 마스터', 'fighter', 'warrior', '전사', '무기', '검사'],
    role: '한 무기를 극한까지 다룬 전사. 방어 불가 공격, 다중 공격.',
    feature: ['Dedication', '무기 하나 선택(한 번만): 그 무기 Skill +10, 들 때 Damage Pool에 D4 추가.'],
    tiers: [
      ['Evasive Strike', u(STD, '근접 공격 판정'), '명중하면 내 다음 방어 판정 +10.'],
      ['Sure Blow', u(STD, '비대항 근접 무기 Skill 판정', ae(4)), '무기 Skill 판정에 성공하면 명중한다. 상대는 어떤 방법으로도 이 공격을 방어할 수 없다.'],
      ['Overwhelming Technique', u(FREE, MAG, ae(6)), '전투 끝까지 대상 Combat Skill −20. 같은 상대에게 1회.'],
      ['Thousand Strikes', u(STD, '근접 공격 판정', ae(4)), '교전 중인 모든 적을 공격. 맞은 적은 일반 피해 + Dazed (1).'],
      ['One With Your Weapon', PASSIVE, '무기가 절대 부서지지 않고 그 무기 피해는 전부 Psychic(Armor 무시). 무기 Skill −30을 감수하면 전투 끝까지 임시 Toughness +10.'],
    ],
    rel: [ed('dazed'), ed('fumble', '무기 파손'), ed('damage-types')],
  },
  {
    id: 'm-wraith',
    en: 'Wraith',
    ko: '유령 무희',
    page: 56,
    aliases: ['wraith', '레이스', 'acrobat', 'evasion', '곡예', '회피', '민첩'],
    role: '곡예와 회피의 달인. Acrobatics로 회피하고 아군 공격을 돕는다.',
    feature: ['Hard to Hit', '공격 회피나 함정 회피에 Dodge 대신 Acrobatics를 쓸 수 있다.'],
    tiers: [
      ['Combat Awareness', u(STD, ae(5)), '전투 끝까지 Acrobatics +20.'],
      ['Spatial Awareness', PASSIVE, '함정 회피용 Acrobatics 판정 +20.'],
      ['Create Opening', u(STD, 'Exhaustion +3'), '아군 전원의 다음 공격 판정 +30.'],
      ['Exploit Weakness', STD, '이후 같은 대상에 대한 내 공격은 판정 +10, 피해 +1. 상대당 1회.'],
      ['Fast Strike', u(STD, '근접 공격 판정'), '명중하면 같은 대상에게 즉시 무료 공격 1회 더.'],
    ],
    rel: [ed('skills', 'Acrobatics'), ed('traps'), ed('defensive-move', 'Dodge'), ed('exhaustion')],
  },
  {
    id: 'm-wrathspawn',
    en: 'Wrathspawn',
    ko: '분노의 자손',
    page: 58,
    aliases: ['wrathspawn', '래스스폰', 'barbarian', 'berserker', '광전사', '야만전사', '분노'],
    role: '분노로 싸우는 광전사. 큰 피해와 돌진, 피해를 주며 회복.',
    feature: ['Savage Will', '휴식당 1회, 공격 피해를 Aether 1당 +1로 올린다. 명중 후 선언 가능. 이 추가 피해는 Critical Strike로 2배가 되지 않는다.'],
    tiers: [
      ['Bash', u(STD, '근접 공격 판정'), '이 공격의 Damage Pool에 D4 Bludgeoning 추가.'],
      ['Sweeping Blow', u(STD, '근접 공격 판정', 'Exhaustion +2'), '한 번 휘둘러 모든 적을 공격.'],
      ['Reckless Attack', u(STD, '근접 공격 판정'), '이 공격의 Damage Pool에 2D6 Bludgeoning 추가. 다음 내 턴까지 방어 불가.'],
      ['Charge', u(STD, 'Exhaustion +2'), '전투 시작에만 사용한다. 즉시 Initiative에서 이기고 지정한 대상에게 2D6 Bludgeoning 피해를 준다.'],
      ['Vicious Warrior', PASSIVE, 'Slashing 저항. 피해를 줄 때마다 Wound 1 회복.'],
    ],
    rel: [ed('initiative'), ed('damage-types'), ed('critical-strike'), ed('once-per-rest')],
  },
  {
    id: 'm-zealot',
    en: 'Zealot',
    ko: '광신자',
    page: 60,
    aliases: ['zealot', '질럿', 'paladin', 'crusader', '성기사', '십자군', 'holy', '신성'],
    role: '신성 전사. Holy 무기, 자기 회복, 아군 마법 저항.',
    feature: ['Divine Guidance', 'Resolve 판정에 Advantage를 적용한다. 휴식당 1회 Events 표를 다시 굴릴 수 있다.'],
    tiers: [
      ['Holy Weapon', u(STD, ae(5, true)), '그 무기로 공격할 때 Damage Pool에 D4 Holy 추가.'],
      ['Purifying Flames', u(STD, MAG, ae(6)), '대상 하나에 2D6 Holy 피해.'],
      ['Absolution', PASSIVE, '캠프 휴식당 1회 Health 2, Sanity 2 회복.'],
      ["God's Will", u(STD, MAG, ae(6)), '대상에게 D4+1 Psychic, 같은 양만큼 Sanity 회복.'],
      ['Sanctuary', u(STD, ae(2, true)), '나와 아군 Spellward/Magic Resistance +20.'],
    ],
    rel: [ed('resistances'), ed('events'), ed('once-per-rest')],
  },
];

export const masteryIds = MASTERIES.map((m) => m.id);
export const masteryNames = MASTERIES.map((m) => [m.id, m.en] as const);

export const masteryCatalog = MASTERIES.map((m) => ({
  id: m.id,
  name: m.en,
  feature: { name: m.feature[0], text: m.feature[1] },
  abilities: m.tiers.map(([name, use, text], index) => ({
    id: `${m.id}:${index + 1}`, tier: index + 1, name, use, text,
  })),
}));

export const masteryEntries: Entry[] = MASTERIES.map((m) => {
  const multiAction = m.tiers.some(([, use]) => use.startsWith(STD2));
  return {
    id: m.id,
    kind: 'mastery',
    category: 'character',
    en: m.en,
    // Mastery names have no official Korean form; the English name is the title, the Korean gloss is a search term
    ko: m.en,
    aliases: [
      m.ko,
      ...m.aliases,
      'mastery',
      '마스터리',
      m.feature[0],
      ...m.tiers.map((t) => t[0]),
    ],
    tags: ['Mastery'],
    summary: m.role,
    outcomes: [
      { label: `Feature · ${m.feature[0]}`, text: m.feature[1] },
      ...m.tiers.map(([name, use, text], i) => ({ label: `Tier ${i + 1} · ${name}`, meta: use, text })),
    ],
    details: [
      'Ability Point로 Tier 1부터 순서대로 연다. Feature는 이 Mastery의 Tier 1을 열 때(Amulet이면 처음 착용할 때) 함께 열린다.',
      'Magical 능력에 맞서는 대상은 따로 명시된 예외가 없으면 Magic Resistance로 저항한다. PC의 해당 저항은 Spellward를 사용한다.',
      '공격 판정을 요구하는 능력은 일반 공격 절차를 따른다. 방어 불가가 명시된 공격은 비대항 무기 Skill 판정으로 해결한다.',
      'Sustained 능력이 켜져 있으면 유지 비용만큼 최대 Aether가 줄어든다. 전투 밖에서 켜고 끌 수 있다. L은 현재 레벨이며 수치를 정수로 맞출 때는 올림한다.',
      ...(multiAction ? ['라운드당 표준 행동이 하나뿐이면 표준 행동 2개가 필요한 소환은 두 라운드에 걸친다. 집중 중에는 다른 행동을 할 수 없고 반응에 추가 −10을 적용하며, 다른 능력을 반응으로 사용할 수 없다.'] : []),
      `수련 배경 D6 표는 원본 ${m.page + 1}쪽에 있다.`,
    ],
    notes: m.notes?.map((text) => ({ type: 'ambiguity' as const, text })),
    related: [opt('masteries'), opt('mastery-abilities'), ...(multiAction ? [ed('action-types')] : []), ...(m.rel ?? [])],
    source: [core(m.page, 20, 21, 70, 74, 75, ...(multiAction ? [76] : []))],
    verification: 'verified',
  };
});
