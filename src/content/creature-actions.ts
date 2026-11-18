/**
 * Creature action effects (Core v1.2 pp.136–203), keyed by creature id, in the same order as the
 * action table in creatures.json. Each string summarizes the mechanical effect in Korean, including
 * target scope, checks, duration, and timing where the action specifies them.
 *
 * Shorthand: "근접 공격" = the creature makes an attack check the PC defends against normally.
 * "붙잡힘 동안 …" = the book's rule that the creature ignores a character held by this action and
 * picks another target or waits.
 */
const HOLD = '붙잡혀 있는 동안 이 생물은 그 캐릭터를 공격하지 않는다(다른 대상을 노리거나 기다림).';

export const creatureActionKo: Record<string, string[]> = {
  'cr-abyssal-vexator': [
    '명중 시 D6 Piercing. 이어서 Athletics 실패 시 Prone.',
    `시야 안 대상이 Dodge에 실패하면 Restrained. 붙잡힌 동안 대상 턴 시작마다 D4 Necrotic. ${HOLD}`,
    'Endurance 실패 시 D10 Necrotic, 받은 만큼 최대 Health 감소(캠프 휴식까지).',
  ],
  'cr-amalgam': [
    'D6 Bludgeoning.',
    '방 안 모두 Endurance 실패 시 D6 Necrotic.',
    `근접 공격 D6 Slashing. 명중 후 Athletics에 실패하면 Restrained. 붙잡힌 동안 대상 턴 시작마다 Slashing 1. ${HOLD}`,
  ],
  'cr-armor-construct': [
    'D6 Bludgeoning.',
    '자기 최대 Health의 절반만큼 추가 Health(최대치 초과 가능). 다음 자기 턴 시작에 사라짐.',
    '근접 공격 D8 Slashing. 명중 후 Endurance 실패 시 1라운드 Paralyzed.',
  ],
  'cr-astral-beast': [
    '명중 시 D6 Arcane.',
    '다음 자기 턴 시작까지 모든 피해에 저항(Resistant).',
    '모두 Spellward 판정 — 실패 D8 Arcane, 성공 시 절반.',
  ],
  'cr-bladewings': [
    '근접 공격 D6 Slashing. 방어구를 입지 않은 대상에게 명중하면 Bleeding (1).',
    '다음 자기 턴까지 방어용 Combat Skill +10.',
    '모두 Resolve 실패 시 다음 공격 굴림에 Disadvantage. 비명의 영향을 받은 대상 1명에게 자유 행동으로 근접 공격(D6 Slashing)을 할 수 있다.',
  ],
  'cr-bloodstalker': [
    '근접 공격 D6 Piercing. 명중 후 Endurance 실패 시 D4 Necrotic 추가.',
    '다음에 근접 공격으로 대상의 Health나 Toughness를 0으로 만들면, 닿는 거리의 다른 대상에게 반응으로 Advantage 근접 공격을 할 수 있다.',
    'D6 Piercing. 준 피해의 절반만큼 Health를 얻는다. 1라운드 뒤 이 증가분이 사라진다.',
  ],
  'cr-blightfang-rats': [
    'D6 Piercing.',
    'D4 Slashing.',
    '방 안의 Blightfang Rat 전부 다음 라운드까지 Combat Skill +10.',
  ],
  'cr-bone-golem': [
    '명중 시 D6 Bludgeoning. Athletics 실패 시 Prone.',
    '명중 시 D6 Necrotic, 준 피해 절반만큼 Health 회복.',
    '근접 공격 D6 Slashing. Armor가 있는 부위에 맞으면 즉시 Armor Integrity 판정.',
  ],
  'cr-bone-spiders': [
    '명중 시 D4 Piercing. Endurance 실패 시 1라운드 Paralyzed.',
    'D6 Slashing. 명중 후 Dodge 실패 시 Prone.',
    'Dodge 실패 시 Restrained.',
  ],
  'cr-cavebound-leech': [
    '근접 공격 D6 Bludgeoning. 명중 시 Restrained. 붙잡힌 동안 대상 턴 시작마다 Bludgeoning 1. 붙잡은 대상에게는 대신 Engulfing Devour를 쓴다.',
    '근접 공격 D6 Piercing, Armor 무시.',
    'Constricting Grasp로 붙잡은 대상에게 2D8 Acid. 붙잡은 대상이 없으면 D6 Piercing, 준 피해 절반 회복.',
  ],
  'cr-corpse-ants': [
    '명중 시 D6 Piercing.',
    '방 안 캐릭터 모두 Dodge 실패 시 D6 Acid + 즉시 Armor Integrity 판정.',
    '방 안 모두 Endurance — 실패 D8 Necrotic, 성공 시 절반. 이 개미는 죽는다.',
  ],
  'cr-death-sage': [
    '명중 시 D6 Necrotic. Endurance 실패 시 휴식까지 최대 Toughness −1.',
    'Endurance 실패 시 D4라운드 동안 무기 Skill·Dodge 판정 Disadvantage.',
    'Endurance 실패 시 D6 Necrotic, 준 피해 절반 회복.',
  ],
  'cr-desiccated-cryptguards': [
    '근접 공격 D6 Slashing. 명중 시 즉시 Armor Integrity 판정.',
    '같은 대상에게 근접 공격 2회, 명중마다 D4+1 Slashing.',
    '근접 공격 D6 Slashing. 명중 후 Resolve 실패 시 Frightened (20).',
  ],
  'cr-dwerax': [
    `근접 공격 D6 Slashing. 명중 시 Restrained. 붙잡힌 동안 대상 턴 시작마다 Slashing 1. ${HOLD}`,
    '근접 공격 D6 Piercing, Armor 무시.',
    '방 안 모두 Acrobatics 실패 시 Prone + D4 Bludgeoning.',
  ],
  'cr-fangvine': [
    '닿는 거리의 대상에게 근접 공격 D6 Bludgeoning. 명중 시 Restrained.',
    '명중 시 D6 Piercing. Endurance 실패 시 1라운드 Paralyzed.',
    `Dodge 실패 시 Restrained. 붙잡힌 동안 Piercing 2를 입는다. 피해가 적용되는 시점이나 주기는 원문에 명시되지 않는다. ${HOLD}`,
  ],
  'cr-flayed-knight': [
    '근접 공격 D4 Slashing, Armor 무시.',
    '명중 시 D6 Necrotic, 준 피해 절반 회복.',
    '닿는 거리의 대상 2명에게 각각 근접 공격(D6 Slashing). 두 공격 중 하나가 명중해 대상의 Toughness를 0으로 만들면 준 피해의 절반만큼 Health를 회복한다.',
  ],
  'cr-flesh-eater': [
    'D6 Slashing. Endurance 실패 시 대상 턴 시작마다 Necrotic 1. Wounds를 1 이상 회복하거나 전투가 끝나면 이 효과가 끝난다.',
    `Athletics 대 이 생물의 Body 대항 판정. 지면 Restrained, 풀려날 때까지 대상 턴 시작마다 Armor 무시 Bludgeoning 1. ${HOLD}`,
    'D8 Bludgeoning.',
  ],
  'cr-fleshmelt-slime': [
    '근접 공격 D6 Acid.',
    '주변 모두 Endurance 실패 시 2D4 Acid + 전투 끝까지 무기 Skill −5.',
    'Endurance 실패 시 2D4 Necrotic, 같은 양만큼 휴식까지 최대 Toughness 감소. 준 피해만큼 회복.',
  ],
  'cr-giant-spider': [
    '근접 공격 D4 Piercing. 명중 후 Endurance 실패 시 Poisoned (1).',
    'Dodge 실패 시 Restrained.',
    'Resolve 실패 시 Frightened (20).',
  ],
  'cr-hive-larvae': [
    '근접 공격 D4 Piercing. 명중 후 Endurance 실패 시, 마법 치유를 받거나 전투가 끝날 때까지 턴 시작마다 Acid 1(중첩 안 됨).',
    '방 안 모두 Endurance 실패 시 다음 자기 턴 끝까지 Blinded.',
    'Endurance 실패 시 D6 Necrotic, 같은 양만큼 휴식까지 최대 Toughness 감소. 준 피해 절반까지 회복.',
  ],
  'cr-hive-warrior': [
    '근접 공격 D6 Slashing.',
    'Dodge 실패 시 Piercing 1, 그다음 Endurance 실패 시 Poisoned (2).',
    '근접 공격 D6 Bludgeoning + Prone.',
  ],
  'cr-hollow-shambler': [
    `Athletics 실패 시 몸 안에 갇혀 즉시 2D4 Piercing을 입고, 탈출할 때까지 턴 시작마다 Necrotic 1을 입는다. 갇힌 대상은 행동을 써서 Athletics에 성공하거나 이 생물에게 누적 피해 3을 주면 탈출한다. ${HOLD}`,
    'D4라운드 동안 Combat Skill +5.',
    '모두 Resolve 실패 시 Frightened (20).',
  ],
  'cr-living-moss': [
    '명중 시 D6 Necrotic.',
    'Dodge 실패 시 Restrained. 이미 Restrained면 대신 D6 Bludgeoning.',
    'Endurance 실패 시 Toughness를 무시하고 Health에 직접 Necrotic 2.',
  ],
  'cr-necropede': [
    'D6 Bludgeoning.',
    'Endurance 실패 시 2D4 Necrotic, 준 피해 절반만큼 임시 Health.',
    '방 안 모두 Dodge — 실패 D6 Piercing + Prone, 성공 시 절반 피해만.',
  ],
  'cr-netherfiend': [
    '근접 공격 D6 Slashing. 이어서 Spellward 실패 시 D4라운드 Infernal Mark: 이 생물의 공격이 Fire 1 추가. 다시 나오면 지속 시간 누적.',
    '명중 시 D4 Fire. Endurance 실패 시 Burning.',
    'Athletics 실패 시 Restrained.',
  ],
  'cr-plaguebringer': [
    '근접 공격 D6 Slashing.',
    '방 전체로 퍼지는 구름에 휩싸인 대상은 Endurance 실패 시 Poison 1을 입고 D4라운드 동안 공격·Skill 판정에 Disadvantage. 다시 나오면 지속 시간이 누적된다.',
    'Toughness를 무시하고 Health에 직접 Necrotic 2.',
  ],
  'cr-pyreborn': [
    '명중 시 D6 Fire. Dodge 실패 시 Burning.',
    '모두 Dodge 실패 시 Fire 2 + Burning.',
    '범위 안 모두 Dodge 실패 시 D4 Fire + Burning.',
  ],
  'cr-ratkin-marauders': [
    '명중 시 D6 Slashing.',
    'Dodge 실패 시 다음 자기 턴 끝까지 Blinded.',
    'Thievery에 성공하면 경보를 막을 수 있다. 경보가 울리면 Tension Die를 굴린다.',
  ],
  'cr-razorjaw': [
    '명중 시 D6 Piercing.',
    '근접 공격 Slashing 2. 이어서 Dodge 실패 시 Bleeding (1).',
    'Athletics 실패 시 Prone, 그러면 자유 행동으로 추가 물기(명중 시 D4 Piercing).',
  ],
  'cr-reanimated-homunculus': [
    '근접 공격 D4 Bludgeoning.',
    '오라 안 대상은 Endurance 실패 시 각자 턴 시작마다 Necrotic 1. 오라는 2라운드 또는 이 생물이 파괴될 때까지 유지되며, 다시 나오면 지속 시간이 누적된다.',
    '자리에 멈췄다가 다음 자기 턴 시작에 폭발한다. 방 안 모두 Dodge 실패 시 2D10 Necrotic, 성공 시 절반. 이 생물은 폭발로 파괴된다.',
  ],
  'cr-rotwalkers': [
    '명중 시 D4 Necrotic. 이어서 Dodge 실패 시 Restrained.',
    '오라 안 대상은 Endurance 실패 시 각자 턴 시작마다 Necrotic 2. 오라는 2라운드 또는 이 생물이 파괴될 때까지 유지되며, 다시 나오면 지속 시간이 누적된다.',
    `Athletics 실패 시 Restrained, 벗어나거나 이 생물이 파괴될 때까지 턴 시작마다 Necrotic 1. ${HOLD}`,
  ],
  'cr-skeletal-horrors': [
    'D6 Slashing.',
    'Endurance — 실패 D6 Necrotic + 준 피해 절반 회복, 성공 시 절반 피해만(회복 없음).',
    '모두 Resolve 실패 시 Stunned (1).',
    '근접 공격 D4 Piercing. 명중하면 즉시 자유 행동으로 Ethereal Grasp.',
  ],
  'cr-stone-warden': [
    'D6 Force. Dodge 실패 시 Restrained.',
    '방 안 모두 Acrobatics 실패 시 D6 Bludgeoning + Prone.',
    '방 안 모두 Athletics 실패 시 D8 Bludgeoning.',
  ],
  'cr-swarmer': [
    '근접 공격 D4+1 Poison.',
    '앞쪽 범위 Dodge 실패 시 D6 Acid + Armor −1(캠프에서 수리할 때까지).',
    'Piercing 2. Endurance 실패 시 다음 자기 턴까지 Blinded.',
  ],
  'cr-tomb-crawler': [
    '명중 시 D6 Piercing. Endurance 실패 시 다음 공격 −10.',
    '근접 공격 D4 Piercing. Endurance 실패 시 1라운드 Paralyzed.',
    'Slashing 2 + Bleeding (1).',
  ],
  'cr-umbra-fiend': [
    '명중 시 D6 Slashing.',
    '방 안 모두 Necrotic 2. Endurance 실패 시 1라운드 공격 판정 Disadvantage.',
    '다음 자기 턴 시작까지 이 생물에 대한 공격은 Disadvantage.',
  ],
  'cr-unfettered-familiar': [
    '명중 시 D6 Arcane.',
    'Endurance 실패 시 Arcane 1 + 1라운드 Blinded.',
    '다음에 공격받을 때 반응으로 발동할 수 있다. 공격자가 Resolve에 실패하면 D6 Arcane을 입고, 다음 Magical 능력이 50% 확률로 실패한다.',
  ],
  'cr-vaelorian-magus': [
    '명중 시 D6 Necrotic.',
    '캐릭터 모두 Resolve 실패 시 Frightened (20).',
    '대상의 다음 공격 굴림 또는 Skill 판정 Disadvantage.',
  ],
  'cr-vinekin': [
    '명중 시 D6 Piercing.',
    '방 안 모두 Dodge 실패 시 Restrained, 벗어나거나 파괴될 때까지 턴 시작마다 Slashing 1. 이미 Restrained면 즉시 Slashing 2.',
    '명중 시 D6 Bludgeoning. Athletics 실패 시 Prone.',
  ],
  'cr-voidweaver': [
    '명중 시 D4+1 Arcane.',
    '2라운드 동안 방 안 모두 무기 Skill·Dodge 판정 Disadvantage(다시 나오면 초기화).',
    '방 안 모두 D6 Arcane. Athletics 실패 시 Prone.',
  ],
  'cr-vorleg': [
    '명중 시 D6 Piercing.',
    '명중 시 D6 Bludgeoning. 이어서 Athletics 실패 시 붙잡힘(Restrained).',
    '붙잡힌 대상 Endurance 실패 시 2D10 Bludgeoning. 붙잡은 대상이 없으면 대신 대상을 즉시 Restrained.',
  ],
  'cr-wraithskull': [
    'D6 Necrotic, 준 피해 절반만큼 임시 Health.',
    '다음 자기 턴까지 비마법 피해·효과에 면역.',
    '모두 Resolve 실패 시 Frightened (20).',
  ],
  'cr-wrath-elemental': [
    'D6을 굴려 원소 결정(1–2 Fire, 3–4 Lightning, 5–6 Force). 방 안 모두 그 종류로 D6 피해.',
    '현재 Health 절반만큼 임시 Health. 총합은 Health의 2배를 넘지 못한다.',
    '방 안 모두 Prone이 되며 Blinded는 1라운드 동안 지속된다.',
  ],
  // ── Overseers (Ruthlessness: several actions per turn, spread across targets) ──
  'cr-carnage-devourer': [
    '교전 중인 모두 Dodge 실패 시 2D8 Bludgeoning + Prone.',
    '방 안 모두에게 D6 Slashing 공격. 맞은 대상 Endurance 실패 시 Burning.',
    '모두 Acrobatics 실패 시 Prone + D6 Bludgeoning.',
    '2라운드 동안 공격 Advantage, 피해 +D6, Frightened·Charmed 불가.',
    '모두 Resolve 실패 시 Frightened (20).',
    '모두 Dodge 실패 시 D6 Fire + Burning.',
  ],
  'cr-dreadlord': [
    'Shadow Reaper D4체 소환. Dreadlord 턴 직후 각자 한 번 공격(Combat Skill 40, D4 Cold)하고 사라진다.',
    'D4라운드 동안 근처에서 턴을 시작하는 자는 Resolve 실패 시 Frightened (10).',
    '명중 시 D8 Slashing. PC면 Endurance 실패 시 받은 피해만큼 최대 Toughness 감소(휴식까지).',
    '다음 자기 턴 시작까지 Holy를 제외한 모든 피해에 저항.',
    'Endurance 실패 시 The Rot 감염(87쪽).',
    '최대 3대상 Spellward 실패 시 D6+2 Necrotic.',
  ],
  'cr-glacial-burrower': [
    '캐릭터 모두에게 2D6 Cold.',
    '대상 하나에 D6+2 Bludgeoning.',
    '모두 Acrobatics 실패 시 2D6 Bludgeoning + Prone.',
    '최대 3대상, 맞으면 2D6 Cold. 이어서 Athletics 실패 시 Prone.',
    '모두 Dodge 실패 시 2D6 Bludgeoning + Prone.',
    '2라운드 동안 냉기 오라를 펼친다. 오라 안에 있는 적은 자기 턴 시작마다 Cold 1을 입는다.',
  ],
  'cr-gorehoof': [
    '방 안 모두 Dodge 실패 시 D4 Slashing.',
    '대상 하나에 근접 공격 3D6 Bludgeoning.',
    '다음 자기 턴 시작까지 근접 공격 Advantage, 피해 +D6, 대신 모든 피해에 취약(Vulnerable).',
    'Health 2D4 회복.',
    '2라운드 동안 Bludgeoning·Piercing·Slashing 저항.',
    '방 안 캐릭터 모두 Resolve 실패 시 Frightened (20).',
  ],
  'cr-infernal-archon': [
    '모두 Dodge — 실패 2D6 Fire, 성공 절반.',
    '다음 자기 턴 끝까지 모든 방어 판정 Advantage.',
    'Lesser Demon D4체 소환, Initiative상 바로 뒤에 행동. 동시에 최대 4체.',
    'Dodge 실패 시 D4+2 Fire.',
    '캐릭터 모두 Dodge 실패 시 3D4 Fire.',
    '캐릭터 모두 Spellward 실패 시 2D4 Fire.',
  ],
  'cr-lesser-demon': ['D4 Slashing.'],
  'cr-infernal-tormentor': [
    '방 안 모두 Dodge — 실패 2D4 Infernal, 성공 절반.',
    '근접 공격 D8 Infernal. 이어서 Athletics 실패 시 Restrained, 붙잡힌 동안 턴 시작마다 Fire 1.',
    '2라운드 동안 Fire 면역, Bludgeoning·Piercing·Slashing 저항.',
    '방 안 모두 Dodge — 실패 3D4 Fire, 성공 절반.',
    '명중 시 2D6 Infernal + Prone.',
    '방 안 모두 Dodge — 실패 D8 Fire + D4 Infernal, 성공 절반.',
  ],
  'cr-pyroclasmic-possessor': [
    'Resolve 실패 시 2라운드 동안 행동을 빼앗겨 아군을 공격한다. 아군이 없으면 자신을 공격한다. 대상은 각자 턴 종료에 Resolve를 다시 굴려 성공 시 벗어날 수 있다.',
    '범위 안 모두 Dodge — 실패 D6 Fire, 성공 절반.',
    '최대 3대상 Dodge 실패 시 2D6 Fire.',
    '2라운드 동안 교전 중인 자는 Burning.',
    'Tension Die 판정.',
    'Athletics 실패 시 2D4 Fire를 입고 다음 턴 종료까지 Restrained. 원문은 이 종료 기준이 대상과 시전자 중 누구의 턴인지 명시하지 않는다.',
  ],
  'cr-veilshifter': [
    '다음 자기 턴 끝까지 이 생물을 노리는 공격은 Disadvantage.',
    '범위 안 모두 D4라운드 Sickened (20).',
    '대상 하나에 2D6 Arcane.',
    '근처에 분신 2체를 소환한다. 각 분신은 즉시 자기 자신에게 Illusory Mirage를 쓰고, 자기 턴에 라운드당 한 번 Physical 공격(명중 시 2D4 Psychic)을 한다. 한 번 맞으면 소멸하며 동시에 최대 4체까지 유지된다.',
    '범위 안 모두 Athletics 실패 시 Prone.',
    '대상 하나에 4D6 Arcane.',
  ],
  'cr-venomcloud-siren': [
    '방 안 모두 Endurance 실패 시 2D6 Poison.',
    '대상 하나에 D6 Piercing. Endurance 실패 시 Poisoned (1).',
    '최대 3대상, 맞으면 2D6 Poison.',
    '범위 안 모두 Athletics 실패 시 Restrained.',
    '방 안 모두 Resolve 실패 시 Frightened (20).',
    '다음에 성공한 공격에 2D6 Poison 추가.',
  ],
  'cr-zephyrous-shadow': [
    '방 안 모두 Dodge — 실패 2D6 Lightning, 성공 절반.',
    '다음 자기 턴 시작까지 이 생물을 노리는 공격 Disadvantage, Arcane을 제외한 모든 피해에 저항.',
    '2라운드 동안 이 생물을 공격하는 자는 Lightning 2. 중첩 안 되고 다시 나오면 지속 시간 초기화.',
    '2라운드 동안 대상 Cursed — 공격할 때마다 Resolve 실패 시 Disadvantage.',
    '근접 공격 D6+2 Force.',
    '방 안 모두 Dodge — 실패 3D4 Force, 성공 절반.',
  ],
  // ── Mastery Minions ──
  'cr-arcane-companion': [
    'D6+1 Arcane.',
    '2D4 Arcane. Endurance 실패 시 다음 자기 턴 끝까지 Blinded.',
  ],
  'cr-fire-elemental': [
    '명중 시 D4 Fire. Body 실패 시 Burning.',
    '방 안 모두 D4 Fire.',
  ],
  'cr-skeleton': [
    'D4 Slashing.',
    'Magic Resistance 실패 시 D4 Necrotic, Skeleton Health 1 회복.',
  ],
  'cr-wight': [
    'D6 Necrotic.',
    'Endurance 실패 시 D4+1 Necrotic.',
  ],
  'cr-frost-elemental': [
    'D6 Cold.',
    '모든 대상에 D4 Cold. Spellward 실패 시 Restrained.',
  ],
};
