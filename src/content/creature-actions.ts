/**
 * Creature action effects (Core v1.2 pp.136–203), keyed by creature id, in the same order as the
 * action table in creatures.json. Each string states the effect in full Korean sentences — target,
 * check, outcome, duration and timing — in our own words; narration is left to the local overlay.
 * HOLD is the book's rule that the creature ignores a character held by this action and picks
 * another target or waits.
 */
const HOLD = '붙잡혀 있는 동안 이 생물은 그 캐릭터를 공격하지 않는다(다른 대상을 노리거나 기다림).';

export const creatureActionKo: Record<string, string[]> = {
  'cr-abyssal-vexator': [
    '사슬로 대상 하나를 공격한다. 명중하면 D6 Piercing 피해를 주고, 대상은 Athletics를 판정해 실패하면 Prone 상태가 된다.',
    `시야 안의 대상 하나를 사슬로 감는다. 대상은 Dodge를 판정해 실패하면 Restrained 상태가 된다. 붙잡혀 있는 동안 대상은 자기 턴이 시작될 때마다 D4 Necrotic 피해를 받는다. ${HOLD}`,
    '대상 하나는 Endurance를 판정한다. 실패하면 D10 Necrotic 피해를 받고, 받은 피해만큼 최대 Health가 줄어든다. 이 감소는 야영 휴식을 마칠 때까지 유지된다.',
  ],
  'cr-amalgam': [
    '거대한 팔다리로 대상 하나를 후려쳐 D6 Bludgeoning 피해를 준다.',
    '방 안의 모든 생물은 Endurance를 판정해 실패하면 D6 Necrotic 피해를 받는다.',
    `대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. 명중한 대상은 Athletics를 판정해 실패하면 Restrained 상태가 된다. 붙잡혀 있는 동안 대상은 자기 턴이 시작될 때마다 1 Slashing 피해를 받는다. ${HOLD}`,
  ],
  'cr-armor-construct': [
    '거대한 주먹으로 대상 하나를 쳐 D6 Bludgeoning 피해를 준다.',
    '비전 방패를 만들어 자기 최대 Health의 절반만큼 Health를 더 얻는다. 이 Health는 최대치를 넘을 수 있고, 다음 자기 턴이 시작될 때 사라진다.',
    '대상 하나에게 근접 공격을 해 명중하면 D8 Slashing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면 1라운드 동안 Paralyzed 상태가 된다.',
  ],
  'cr-astral-beast': [
    '천상의 기운을 대상 하나에게 쏜다. 대상이 Spellward에 실패하면 D6 Arcane 피해를 받는다.',
    '다음 자기 턴이 시작될 때까지 모든 피해에 Resistant가 된다.',
    '주변의 모든 생물이 Spellward를 판정한다. 실패하면 D8 Arcane 피해를, 성공하면 그 절반을 받는다.',
  ],
  'cr-bladewings': [
    '대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. 대상이 방어구를 입고 있지 않으면 Bleeding (1) 상태가 된다.',
    '그림자 속으로 사라진다. 다음 자기 턴까지 방어 판정에 쓰는 Combat Skill이 +10 된다.',
    '날카로운 비명을 지른다. 비명의 영향을 받은 생물은 Resolve를 판정해 실패하면 다음 공격 굴림에 Disadvantage를 받는다. 그 뒤 이 생물은 영향을 받은 대상 하나에게 자유 행동으로 근접 공격을 할 수 있고, 명중하면 D6 Slashing 피해를 준다.',
  ],
  'cr-bloodstalker': [
    '대상 하나에게 근접 공격을 해 명중하면 D6 Piercing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면 D4 Necrotic 피해를 더 받는다.',
    '다음에 근접 공격으로 어떤 생물의 Health나 Toughness를 0으로 만들면, 반응(Reaction)으로 닿는 거리의 다른 대상에게 근접 공격을 한 번 더 한다. 이 공격 판정에는 Advantage를 받는다.',
    '대상 하나를 물어 D6 Piercing 피해를 준다. 준 피해의 절반만큼 Health가 늘어나며, 이 증가분은 1라운드 뒤 사라진다.',
  ],
  'cr-blightfang-rats': [
    '날카로운 이빨로 물어 D6 Piercing 피해를 준다.',
    '할퀴어 D4 Slashing 피해를 준다.',
    '크게 울어 방 안의 모든 Blightfang Rat을 흥분시킨다. 다음 라운드까지 그들의 Combat Skill이 +10 된다.',
  ],
  'cr-bone-golem': [
    '거대한 팔로 대상 하나를 내리쳐 명중하면 D6 Bludgeoning 피해를 준다. 대상은 Athletics를 판정해 실패하면 Prone 상태가 된다.',
    '뼈 손으로 대상 하나의 생명력을 빨아들인다. 대상이 Spellward에 실패하면 D6 Necrotic 피해를 받고, 이 생물은 준 피해의 절반만큼 Health를 회복한다.',
    '대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. Armor가 있는 부위에 명중했다면 즉시 그 Armor의 Integrity 판정을 한다.',
  ],
  'cr-bone-spiders': [
    '대상 하나를 물어 명중하면 D4 Piercing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면 1라운드 동안 Paralyzed 상태가 된다.',
    '벽과 지형을 타고 빠르게 움직이며 공격해 D6 Slashing 피해를 준다. 명중한 대상은 Dodge를 판정해 실패하면 Prone 상태가 된다.',
    '끈적한 거미줄을 쏜다. 대상 하나는 Dodge를 판정해 실패하면 Restrained 상태가 된다.',
  ],
  'cr-cavebound-leech': [
    '대상 하나에게 근접 공격을 해 명중하면 D6 Bludgeoning 피해를 주고 Restrained 상태로 만든다. Restrained인 동안 대상은 자기 턴이 시작될 때마다 1 Bludgeoning 피해를 받는다. 이렇게 붙잡은 대상에게는 이 행동 대신 Engulfing Devour를 쓴다.',
    '날카로운 이빨로 근접 공격을 해 명중하면 D6 Piercing 피해를 준다. 이 공격은 Armor를 모두 무시한다.',
    'Constricting Grasp로 붙잡은 대상을 삼키려 해 2D8 Acid 피해를 준다. 붙잡은 대상이 없으면 대신 D6 Piercing 피해를 주고, 준 피해의 절반만큼 Health를 회복한다.',
  ],
  'cr-corpse-ants': [
    '강한 턱으로 대상 하나를 물어 명중하면 D6 Piercing 피해를 준다.',
    '부식성 산을 뿌린다. 방 안의 모든 캐릭터가 Dodge를 판정해 실패하면 D6 Acid 피해를 받고, 즉시 Armor Integrity 판정도 한다.',
    '몸이 터지며 유독 가스와 사령 에너지를 내뿜는다. 방 안의 모든 생물이 Endurance를 판정해 실패하면 D8 Necrotic 피해를, 성공하면 그 절반을 받는다. 이 개미는 이 행동 뒤에 죽는다.',
  ],
  'cr-death-sage': [
    '대상 하나에게 사령 화살을 쏜다. 대상이 Spellward에 실패하면 D6 Necrotic 피해를 받고, Endurance도 판정해 실패하면 휴식을 마칠 때까지 최대 Toughness가 1 줄어든다.',
    '대상 하나에게 저주를 건다. 대상은 Endurance를 판정해 실패하면 D4 라운드 동안 모든 무기 Skill과 Dodge 판정에 Disadvantage를 받는다.',
    '대상 하나의 생명력을 빨아들인다. 대상은 Endurance를 판정해 실패하면 D6 Necrotic 피해를 받고, 이 생물은 준 피해의 절반만큼 Health를 회복한다.',
  ],
  'cr-desiccated-cryptguards': [
    '녹슨 검으로 대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. 명중한 대상은 즉시 Armor Integrity 판정을 한다.',
    '같은 대상에게 근접 공격을 두 번 하며, 명중할 때마다 D4+1 Slashing 피해를 준다.',
    '대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. 명중한 대상은 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
  ],
  'cr-dwerax': [
    `발톱 달린 손으로 대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 주고 Restrained 상태로 만든다. 붙잡혀 있는 동안 대상은 자기 턴이 시작될 때마다 1 Slashing 피해를 받는다. ${HOLD}`,
    '대상 하나에게 근접 공격을 해 명중하면 D6 Piercing 피해를 준다. 이 피해는 Armor를 모두 무시한다.',
    '땅을 내리쳐 충격파를 일으킨다. 방 안의 모든 생물이 Acrobatics를 판정해 실패하면 Prone 상태가 되고 D4 Bludgeoning 피해를 받는다.',
  ],
  'cr-fangvine': [
    '닿는 거리의 대상 하나에게 덩굴로 근접 공격을 해 명중하면 D6 Bludgeoning 피해를 주고 Restrained 상태로 만든다.',
    '대상 주변의 땅에서 가시가 솟아 명중하면 D6 Piercing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면 1라운드 동안 Paralyzed 상태가 된다.',
    `땅속으로 뻗은 덩굴이 대상 하나를 덮친다. 대상은 Dodge를 판정해 실패하면 Restrained 상태가 된다. Restrained인 동안 대상은 2 Piercing 피해를 받는다(피해 시점이나 주기는 원문에 명시되지 않음). ${HOLD}`,
  ],
  'cr-flayed-knight': [
    '유령 칼날로 대상 하나에게 근접 공격을 해 명중하면 D4 Slashing 피해를 준다. 이 피해는 Armor를 모두 무시한다.',
    '유령 손으로 대상 하나의 생명력을 빨아들인다. 대상이 Spellward에 실패하면 D6 Necrotic 피해를 받고, 이 생물은 준 피해의 절반만큼 Health를 회복한다.',
    '칼날을 넓게 휘둘러 닿는 거리의 대상 둘에게 각각 근접 공격을 하며, 명중한 대상마다 D6 Slashing 피해를 준다. 둘 중 하나라도 명중해 대상의 Toughness를 0으로 만들면, 준 피해의 절반만큼 Health를 회복한다.',
  ],
  'cr-flesh-eater': [
    '발톱으로 대상 하나를 할퀴어 D6 Slashing 피해를 준다. 대상은 Endurance를 판정해 실패하면 상처가 곪는다. 그 뒤 대상은 자기 턴이 시작될 때마다 1 Necrotic 피해를 더 받으며, Wounds를 조금이라도 회복하거나 전투가 끝나면 이 효과가 끝난다.',
    `대상 하나를 썩은 몸으로 감싸려 한다. 대상은 이 생물의 Body를 상대로 Athletics 대항 판정을 한다. 지면 Restrained 상태가 되고, 풀려날 때까지 자기 턴이 시작될 때마다 Armor를 무시하는 1 Bludgeoning 피해를 받는다. ${HOLD}`,
    '뒷다리로 일어섰다가 대상 하나를 내리찍어 D8 Bludgeoning 피해를 준다.',
  ],
  'cr-fleshmelt-slime': [
    '몸을 뻗어 대상 하나에게 근접 공격을 해 명중하면 D6 Acid 피해를 준다.',
    '격렬하게 터지며 유독 가스와 부식액을 뿌린다. 범위 안의 생물은 Endurance를 판정해 실패하면 2D4 Acid 피해를 받고, 전투가 끝날 때까지 무기 Skill이 −5 된다.',
    '촉수로 대상 하나의 생명력을 빨아들인다. 대상은 Endurance를 판정해 실패하면 2D4 Necrotic 피해를 받고, 휴식을 마칠 때까지 최대 Toughness가 같은 양만큼 줄어든다. 이 생물은 준 피해만큼 Health를 회복한다.',
  ],
  'cr-giant-spider': [
    '대상 하나에게 근접 공격을 해 명중하면 D4 Piercing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면 Poisoned (1) 상태가 된다.',
    '끈적한 거미줄을 쏜다. 대상 하나는 Dodge를 판정해 실패하면 Restrained 상태가 된다.',
    '대상 하나를 노려본다. 대상은 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
  ],
  'cr-hive-larvae': [
    '닿는 거리의 대상 하나에게 근접 공격을 해 명중하면 D4 Piercing 피해를 준다. 명중한 대상은 Endurance를 판정해 실패하면, 마법 치유를 받거나 전투가 끝날 때까지 자기 턴이 시작될 때마다 1 Acid 피해를 받는다. 이 효과는 중첩되지 않는다.',
    '눈부신 빛을 내뿜는다. 방 안의 모든 생물이 Endurance를 판정해 실패하면 다음 자기 턴이 끝날 때까지 Blinded 상태가 된다.',
    '대상 하나의 생명력을 빨아들인다. 대상은 Endurance를 판정해 실패하면 D6 Necrotic 피해를 받고, 휴식을 마칠 때까지 최대 Toughness가 같은 양만큼 줄어든다. 이 생물은 준 피해의 절반까지 Health를 회복한다.',
  ],
  'cr-hive-warrior': [
    '긴 발톱으로 대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다.',
    '독가시를 날린다. 대상 하나는 Dodge를 판정해 실패하면 1 Piercing 피해를 받고, 이어서 Endurance를 판정해 실패하면 Poisoned (2) 상태가 된다.',
    '빠르게 돌진해 대상 하나에게 근접 공격을 한다. 명중하면 D6 Bludgeoning 피해를 주고 Prone 상태로 만든다.',
  ],
  'cr-hollow-shambler': [
    `대상 하나를 삼키려 한다. 대상은 Athletics를 판정해 실패하면 이 생물의 가슴 안에 갇힌다. 갇히는 즉시 2D4 Piercing 피해를 받고, 빠져나올 때까지 자기 턴이 시작될 때마다 1 Necrotic 피해를 받는다. 갇힌 대상은 행동을 써서 Athletics에 성공하거나, 이 생물에게 합쳐서 3 피해를 주면 빠져나온다. ${HOLD}`,
    '어긋난 팔다리로 예측할 수 없게 움직인다. D4 라운드 동안 Combat Skill이 +5 된다.',
    '소름 끼치는 울음을 낸다. 듣는 모든 생물이 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
  ],
  'cr-living-moss': [
    '덩굴을 뻗어 대상 하나를 쳐서 명중하면 D6 Necrotic 피해를 준다.',
    '가시 덩굴이 솟아 대상 하나를 감는다. 대상은 Dodge를 판정해 실패하면 Restrained 상태가 된다. 이미 Restrained 상태라면 대신 D6 Bludgeoning 피해를 받는다.',
    '대상 하나는 Endurance를 판정해 실패하면 남은 Toughness를 무시하고 Health에 직접 2 Necrotic 피해를 받는다.',
  ],
  'cr-necropede': [
    '뼈 몸통으로 대상 하나를 내리쳐 D6 Bludgeoning 피해를 준다.',
    '어두운 기운으로 대상 하나의 생명력을 빨아들인다. 대상은 Endurance를 판정해 실패하면 2D4 Necrotic 피해를 받고, 이 생물은 준 피해의 절반만큼 임시 Health를 얻는다.',
    '꼬리 가시로 방 안의 모든 생물을 휩쓴다. 각자 Dodge를 판정해 실패하면 D6 Piercing 피해를 받고 Prone 상태가 된다. 성공하면 피해의 절반만 받고 Prone 상태가 되지 않는다.',
  ],
  'cr-netherfiend': [
    '흑요석 발톱으로 대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다. 대상은 Spellward도 판정해 실패하면 D4 라운드 동안 Infernal Mark가 새겨진다. 이 표식이 있는 대상에게 이 생물의 공격은 1 Fire 피해를 더 준다. 이 행동이 다시 나오면 지속 시간이 누적된다.',
    '대상 하나에게 기이한 불꽃을 쏜다. 대상이 Spellward에 실패하면 D4 Fire 피해를 받고, Endurance도 판정해 실패하면 Burning 상태가 된다.',
    '타락한 마법 촉수로 대상 하나를 감는다. 대상은 Athletics를 판정해 실패하면 Restrained 상태가 된다.',
  ],
  'cr-plaguebringer': [
    '독 묻은 발톱으로 대상 하나에게 근접 공격을 해 명중하면 D6 Slashing 피해를 준다.',
    '방 전체로 퍼지는 역병 구름을 내뿜는다. 구름 속의 생물은 Endurance를 판정해 실패하면 1 Poison 피해를 받고, D4 라운드 동안 공격 굴림과 Skill 판정에 Disadvantage를 받는다. 이 행동이 다시 나오면 지속 시간이 누적된다.',
    '병든 물질을 토해 대상 하나에게 2 Necrotic 피해를 준다. 이 피해는 Toughness를 건너뛰고 Health를 직접 깎는다.',
  ],
  'cr-pyreborn': [
    '대상 하나에게 불꽃 촉수를 뻗는다. 대상이 Spellward에 실패하면 D6 Fire 피해를 받고, Dodge도 판정해 실패하면 Burning 상태가 된다.',
    '강한 불꽃을 터뜨린다. 모든 생물이 Dodge를 판정해 실패하면 2 Fire 피해를 받고 Burning 상태가 된다.',
    '불의 폭풍을 부른다. 범위 안의 모든 생물이 Dodge를 판정해 실패하면 D4 Fire 피해를 받고 Burning 상태가 된다.',
  ],
  'cr-ratkin-marauders': [
    '날카로운 발톱으로 대상 하나를 할퀴어 명중하면 D6 Slashing 피해를 준다.',
    '흙이나 잔해를 대상의 눈에 던진다. 대상은 Dodge를 판정해 실패하면 다음 자기 턴이 끝날 때까지 Blinded 상태가 된다.',
    '뿔피리를 꺼내 경보를 울리려 한다. Thievery 판정에 성공하면 막을 수 있다. 실패하면 경보가 울려 긴장 주사위 판정을 한다.',
  ],
  'cr-razorjaw': [
    '거대한 턱으로 대상 하나를 물어 명중하면 D6 Piercing 피해를 준다.',
    '발톱으로 대상 하나에게 근접 공격을 해 명중하면 2 Slashing 피해를 준다. 대상은 Dodge도 판정해 실패하면 Bleeding (1) 상태가 된다.',
    '대상 하나에게 덮쳐 쓰러뜨리려 한다. 대상은 Athletics를 판정해 실패하면 Prone 상태가 되고, 이 생물은 곧바로 자유 행동으로 한 번 더 물어 명중하면 D4 Piercing 피해를 준다.',
  ],
  'cr-reanimated-homunculus': [
    '꿰맨 팔다리로 대상 하나에게 근접 공격을 해 명중하면 D4 Bludgeoning 피해를 준다.',
    '주위에 불안정한 사령 오라를 두른다. 오라 안의 생물은 Endurance를 판정해 실패하면 각자 턴이 시작될 때마다 1 Necrotic 피해를 받는다. 오라는 2라운드 동안, 또는 이 생물이 파괴될 때까지 유지되며, 다시 나오면 지속 시간이 누적된다.',
    '그 자리에 멈춰 굳는다. 다음 자기 턴이 시작될 때 폭발해, 방 안의 모든 생물이 Dodge를 판정한다. 실패하면 2D10 Necrotic 피해를, 성공하면 그 절반을 받는다. 이 생물은 폭발로 파괴된다.',
  ],
  'cr-rotwalkers': [
    '썩은 팔을 뻗어 대상 하나를 붙잡으려 한다. 명중하면 D4 Necrotic 피해를 주고, 대상은 Dodge를 판정해 실패하면 Restrained 상태가 된다.',
    '주위에 썩은 오라를 두른다. 오라 안의 생물은 Endurance를 판정해 실패하면 각자 턴이 시작될 때마다 2 Necrotic 피해를 받는다. 오라는 2라운드 동안, 또는 이 생물이 파괴될 때까지 유지되며, 다시 나오면 지속 시간이 누적된다.',
    `대상 하나를 끌어안으려 한다. 대상은 Athletics를 판정해 실패하면 Restrained 상태가 되고, 풀려나거나 이 생물이 파괴될 때까지 자기 턴이 시작될 때마다 1 Necrotic 피해를 받는다. ${HOLD}`,
  ],
  'cr-skeletal-horrors': [
    '무기를 휘둘러 D6 Slashing 피해를 준다.',
    '대상 하나의 생명력에 손을 뻗는다. 대상은 Endurance를 판정한다. 실패하면 D6 Necrotic 피해를 받고 이 생물이 준 피해의 절반만큼 Health를 회복한다. 성공하면 피해의 절반만 받고 이 생물은 회복하지 않는다.',
    '소름 끼치는 울음을 낸다. 모든 생물이 Resolve를 판정해 실패하면 Stunned (1) 상태가 된다.',
    '대상 하나에게 돌진해 근접 공격을 한다. 명중하면 D4 Piercing 피해를 주고, 곧바로 자유 행동으로 Ethereal Grasp를 쓴다.',
  ],
  'cr-stone-warden': [
    '대상 발밑에서 돌가시를 솟게 해 D6 Force 피해를 준다. 대상은 Dodge도 판정해 실패하면 가시에 꿰여 Restrained 상태가 된다.',
    '땅을 세게 굴러 충격파를 보낸다. 방 안의 모든 생물이 Acrobatics를 판정해 실패하면 D6 Bludgeoning 피해를 받고 Prone 상태가 된다.',
    '땅을 뒤틀어 무너뜨린다. 방 안의 모든 생물이 Athletics를 판정해 실패하면 D8 Bludgeoning 피해를 받는다.',
  ],
  'cr-swarmer': [
    '대상 하나에게 근접 공격을 해 명중하면 D4+1 Poison 피해를 준다.',
    '앞쪽 원뿔 범위로 산을 뿜는다. 범위 안의 생물은 Dodge를 판정해 실패하면 D6 Acid 피해를 받고, 야영에서 수리할 때까지 Armor가 1 줄어든다.',
    '떼로 대상 하나를 감싸 2 Piercing 피해를 준다. 대상은 Endurance를 판정해 실패하면 다음 자기 턴까지 Blinded 상태가 된다.',
  ],
  'cr-tomb-crawler': [
    '가시를 휘둘러 명중하면 D6 Piercing 피해를 준다. 대상은 Endurance도 판정해 실패하면 다음 공격 행동에 −10을 받는다.',
    '독니로 대상 하나에게 근접 공격을 해 명중하면 D4 Piercing 피해를 준다. 대상은 Endurance도 판정해 실패하면 1라운드 동안 Paralyzed 상태가 된다.',
    '대상 하나를 할퀴어 2 Slashing 피해를 주고 Bleeding (1) 상태로 만든다.',
  ],
  'cr-umbra-fiend': [
    '흑요석 발톱으로 대상 하나를 할퀴어 명중하면 D6 Slashing 피해를 준다.',
    '그림자 파동을 내보낸다. 방 안의 모든 생물이 2 Necrotic 피해를 받고, Endurance를 판정해 실패하면 1라운드 동안 공격 판정에 Disadvantage를 받는다.',
    '그림자와 하나가 된다. 다음 자기 턴이 시작될 때까지 이 생물을 노리는 공격은 Disadvantage를 받는다.',
  ],
  'cr-unfettered-familiar': [
    '남은 비전 기운을 모아 대상 하나에게 쏜다. 대상이 Spellward에 실패하면 D6 Arcane 피해를 받는다.',
    '대상 하나를 건드린다. 대상은 Endurance를 판정해 실패하면 1 Arcane 피해를 받고 1라운드 동안 Blinded 상태가 된다.',
    '다음에 공격받을 때 반응(Reaction)으로 역류를 일으킬 수 있다. 공격한 생물은 Resolve를 판정해 실패하면 D6 Arcane 피해를 받고, 다음에 쓰는 Magical 능력이 50% 확률로 실패한다.',
  ],
  'cr-vaelorian-magus': [
    '대상 하나에게 사령 화살을 던진다. 대상이 Spellward에 실패하면 D6 Necrotic 피해를 받는다.',
    '섬뜩한 유령을 불러낸다. 모든 캐릭터가 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
    '대상 하나를 저주로 약하게 만든다. 대상은 다음 공격 굴림이나 Skill 판정에 Disadvantage를 받는다.',
  ],
  'cr-vinekin': [
    '가시 덩굴로 대상 하나를 후려쳐 명중하면 D6 Piercing 피해를 준다.',
    '뒤틀린 뿌리를 불러 방 안의 모든 생물을 감는다. 각자 Dodge를 판정해 실패하면 Restrained 상태가 되고, 풀려나거나 이 생물이 파괴될 때까지 자기 턴이 시작될 때마다 1 Slashing 피해를 받는다. 이미 Restrained 상태인 생물은 즉시 2 Slashing 피해를 받는다.',
    '대상 하나에게 돌진해 명중하면 D6 Bludgeoning 피해를 준다. 대상은 Athletics도 판정해 실패하면 Prone 상태가 된다.',
  ],
  'cr-voidweaver': [
    '대상 하나에게 어두운 광선을 쏜다. 대상이 Spellward에 실패하면 D4+1 Arcane 피해를 받는다.',
    '현실을 비틀어 왜곡 영역을 만든다. 2라운드 동안 방 안의 생물은 무기 Skill과 Dodge 판정에 Disadvantage를 받는다. 이 행동이 다시 나오면 지속 시간이 처음부터 다시 시작된다.',
    '공허의 힘을 터뜨린다. 방 안의 모든 생물이 D6 Arcane 피해를 받고, Athletics를 판정해 실패하면 Prone 상태가 된다.',
  ],
  'cr-vorleg': [
    '날카로운 이빨로 대상 하나를 물어 명중하면 D6 Piercing 피해를 준다.',
    '촉수로 대상 하나를 후려쳐 명중하면 D6 Bludgeoning 피해를 준다. 명중한 대상은 Athletics를 판정해 실패하면 촉수에 붙잡혀 Restrained 상태가 된다.',
    '붙잡은 대상을 촉수로 조인다. 대상은 Endurance를 판정해 실패하면 2D10 Bludgeoning 피해를 받는다. 촉수로 붙잡은 대상이 없으면 대신 대상 하나를 즉시 Restrained 상태로 만든다.',
  ],
  'cr-wraithskull': [
    '대상 하나의 생명력을 빨아들여 D6 Necrotic 피해를 준다. 이 생물은 준 피해의 절반만큼 임시 Health를 얻는다.',
    '잠시 영체가 된다. 다음 자기 턴까지 마법이 아닌 피해와 효과에 면역이다.',
    '오싹한 울음을 낸다. 모든 생물이 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
  ],
  'cr-wrath-elemental': [
    'D6을 굴려 원소를 정한다. 1–2는 불의 원뿔(Fire), 3–4는 번개 줄기(Lightning), 5–6은 몰아치는 물살(Force)이다. 방 안의 모든 생물이 그 종류로 D6 피해를 받는다.',
    '악마의 본성을 끌어내 현재 Health의 절반만큼 임시 Health를 얻는다. 이렇게 해서 Health가 원래의 2배를 넘을 수는 없다.',
    '불안정한 에너지를 터뜨린다. 방 안의 모든 생물이 1라운드 동안 Blinded 상태가 되고 Prone 상태가 된다.',
  ],
  // ── Overseers (Ruthlessness: several actions per turn, spread across targets) ──
  'cr-carnage-devourer': [
    '일직선으로 돌진하며 앞을 짓밟는다. 이 생물과 교전 중인 모든 생물이 Dodge를 판정해 실패하면 2D8 Bludgeoning 피해를 받고 Prone 상태가 된다.',
    '거대한 식칼을 크게 휘둘러 방 안의 모든 생물을 공격해 D6 Slashing 피해를 준다. 맞은 대상은 Endurance를 판정해 실패하면 Burning 상태가 된다.',
    '식칼로 땅을 내리쳐 충격파를 일으킨다. 모든 생물이 Acrobatics를 판정해 실패하면 Prone 상태가 되고 D6 Bludgeoning 피해를 받는다.',
    '분노가 끓어오른다. 2라운드 동안 모든 공격 굴림에 Advantage를 받고 피해가 D6 늘어난다. 그동안 Frightened나 Charmed 상태가 되지 않는다.',
    '귀를 찢는 포효를 낸다. 모든 생물이 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
    '불길을 쏟아붓는다. 모든 생물이 Dodge를 판정해 실패하면 D6 Fire 피해를 받고 Burning 상태가 된다.',
  ],
  'cr-dreadlord': [
    'Shadow Reaper를 D4체 불러낸다. 이들은 Dreadlord의 턴 바로 뒤에 각자 생물 하나에게 낫으로 공격하고(Combat Skill 40, D4 Cold 피해) 곧바로 사라진다.',
    'D4 라운드 동안 절망의 오라를 내뿜는다. Dreadlord 근처에서 턴을 시작하는 생물은 Resolve를 판정해 실패하면 Frightened (10) 상태가 된다.',
    '유령 낫을 휘둘러 명중하면 D8 Slashing 피해를 준다. 대상이 PC라면 Endurance를 판정해 실패하면 받은 피해만큼 최대 Toughness가 줄어들고, 이 감소는 휴식을 마칠 때까지 유지된다.',
    '어둠으로 몸을 감싼다. 다음 자기 턴이 시작될 때까지 Holy를 뺀 모든 피해에 Resistant가 된다.',
    '대상 하나를 노려본다. 대상은 Endurance를 판정해 실패하면 Rot에 걸린다(룰북 87쪽).',
    '심연의 투사체를 최대 대상 셋에게 던진다. 각 대상은 Spellward를 판정해 실패하면 D6+2 Necrotic 피해를 받는다.',
  ],
  'cr-glacial-burrower': [
    '원뿔 모양으로 얼어붙은 바람을 내뿜어 모든 캐릭터에게 2D6 Cold 피해를 준다.',
    '얼어붙은 팔다리로 대상 하나를 쳐 D6+2 Bludgeoning 피해를 준다.',
    '땅속으로 사라졌다가 거칠게 솟아오른다. 모든 생물이 Acrobatics를 판정해 실패하면 2D6 Bludgeoning 피해를 받고 Prone 상태가 된다.',
    '얼음 우박을 만들어 최대 대상 셋에게 던진다. Spellward에 실패한 대상은 2D6 Cold 피해를 받고, Athletics를 판정해 실패하면 Prone 상태가 된다.',
    '일직선으로 돌진한다. 모든 생물이 Dodge를 판정해 실패하면 2D6 Bludgeoning 피해를 받고 Prone 상태가 된다.',
    '냉기 오라를 펼친다. 다음 2라운드 동안 오라 안의 적은 자기 턴이 시작될 때마다 1 Cold 피해를 받는다.',
  ],
  'cr-gorehoof': [
    '거대한 식칼을 크게 휘둘러 방 안의 모든 생물을 노린다. 각자 Dodge를 판정해 실패하면 D4 Slashing 피해를 받는다.',
    '일직선으로 돌진한 뒤, 끝에서 대상 하나에게 근접 공격을 해 3D6 Bludgeoning 피해를 준다.',
    '광란에 빠진다. 다음 자기 턴이 시작될 때까지 근접 공격 굴림에 Advantage를 받고 공격 피해가 D6 늘어나지만, 모든 피해에 Vulnerable이 된다.',
    '우렁찬 포효로 상처를 무시한다. Health를 2D4 회복한다.',
    '고통과 부상을 견뎌 낸다. 2라운드 동안 Bludgeoning, Piercing, Slashing 피해에 Resistant가 된다.',
    '위압감을 내뿜는다. 방 안의 모든 캐릭터가 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
  ],
  'cr-infernal-archon': [
    '불꽃을 분출시킨다. 모든 생물이 Dodge를 판정해 실패하면 2D6 Fire 피해를, 성공하면 그 절반을 받는다.',
    '흔들리는 그림자로 몸을 감싼다. 다음 자기 턴이 끝날 때까지 모든 방어 판정에 Advantage를 받는다.',
    'Lesser Demon을 D4체 불러낸다. 이들은 Initiative 순서에서 이 생물 바로 뒤에 행동한다. Lesser Demon은 동시에 최대 4체까지만 있을 수 있다.',
    '녹은 투사체를 대상 하나에게 던진다. 대상은 Dodge를 판정해 실패하면 D4+2 Fire 피해를 받는다.',
    '그림자와 불의 균열을 열어 검은 불꽃을 퍼뜨린다. 모든 캐릭터가 Dodge를 판정해 실패하면 3D4 Fire 피해를 받는다.',
    '불과 그림자의 소용돌이를 만든다. 모든 캐릭터가 Spellward를 판정해 실패하면 2D4 Fire 피해를 받는다.',
  ],
  'cr-lesser-demon': ['발톱으로 대상 하나를 할퀴어 D4 Slashing 피해를 준다.'],
  'cr-infernal-tormentor': [
    '녹은 투사체를 비처럼 쏟아붓는다. 방 안의 모든 생물이 Dodge를 판정해 실패하면 2D4 Infernal 피해를, 성공하면 그 절반을 받는다.',
    '불타는 발톱으로 근접 공격을 해 D8 Infernal 피해를 준다. 대상은 Athletics를 판정해 실패하면 붙잡혀 Restrained 상태가 되고, 붙잡혀 있는 동안 자기 턴이 시작될 때마다 1 Fire 피해를 받는다.',
    '모습을 바꾼다. 2라운드 동안 Fire 피해에 면역이고, Bludgeoning, Piercing, Slashing 피해에 Resistant가 된다.',
    '앞쪽으로 원뿔 모양의 불길을 뿜는다. 방 안의 모든 생물이 Dodge를 판정해 실패하면 3D4 Fire 피해를, 성공하면 그 절반을 받는다.',
    '분노를 담아 한 번 크게 공격한다. 명중하면 2D6 Infernal 피해를 주고 Prone 상태로 만든다.',
    '지옥불을 터뜨려 방 전체를 휩싼다. 모든 생물이 Dodge를 판정해 실패하면 D8 Fire와 D4 Infernal 피해를, 성공하면 그 절반을 받는다.',
  ],
  'cr-pyroclasmic-possessor': [
    '대상 하나에게 빙의하려 한다. 대상은 Resolve를 판정해 실패하면 2라운드 동안 빙의된다. 빙의된 동안 이 생물이 대상의 행동을 조종해 대상의 아군을 공격하게 하며, 아군이 없으면 자기 자신을 공격하게 한다. 대상은 자기 턴이 끝날 때마다 Resolve를 다시 판정해 성공하면 빙의에서 벗어난다.',
    '불길을 분출시킨다. 범위 안의 생물은 Dodge를 판정해 실패하면 D6 Fire 피해를, 성공하면 그 절반을 받는다.',
    '녹은 투사체를 최대 대상 셋에게 던진다. 각 대상은 Dodge를 판정해 실패하면 2D6 Fire 피해를 받는다.',
    '2라운드 동안 불의 오라로 몸을 감싼다. 그동안 이 생물과 교전 중인 생물은 Burning 상태가 된다.',
    '묘지 전체에 울리는 불의 명령을 내린다. 긴장 주사위 판정을 한다.',
    '불타는 영체를 뻗어 대상 하나를 붙잡는다. 대상은 Athletics를 판정해 실패하면 2D4 Fire 피해를 받고 다음 턴이 끝날 때까지 Restrained 상태가 된다(원문은 이 턴이 대상의 것인지 이 생물의 것인지 명시하지 않음).',
  ],
  'cr-veilshifter': [
    '자신과 주변의 환영 분신을 만든다. 다음 자기 턴이 끝날 때까지 이 생물을 노리는 모든 공격은 Disadvantage를 받는다.',
    '주변 현실을 비틀어 환영 지형을 만든다. 범위 안의 모든 생물이 D4 라운드 동안 Sickened (20) 상태가 된다.',
    '환영을 대상 하나에게 쏟아부어 2D6 Arcane 피해를 준다.',
    '환영 분신 둘을 근처에 불러낸다. 분신은 나타나자마자 자신에게 Illusory Mirage를 쓴다. 각 분신은 라운드마다 한 번, 자기 턴에 대상 하나에게 Physical 공격을 해 명중하면 2D4 Psychic 피해를 준다. 분신은 한 번 맞으면 사라지며, 동시에 최대 4체까지만 있을 수 있다.',
    '전장을 환영의 꿈결로 바꾼다. 범위 안의 모든 생물이 Athletics를 판정해 실패하면 Prone 상태가 된다.',
    '대상 하나를 응시해 해로운 환영을 보게 한다. 대상은 4D6 Arcane 피해를 받는다.',
  ],
  'cr-venomcloud-siren': [
    '독가스 구름을 내뿜는다. 방 안의 모든 생물이 Endurance를 판정해 실패하면 2D6 Poison 피해를 받는다.',
    '뱀 같은 몸으로 대상 하나를 쳐 D6 Piercing 피해를 준다. 대상은 Endurance를 판정해 실패하면 Poisoned (1) 상태가 된다.',
    '독 투사체를 최대 대상 셋에게 쏜다. Spellward에 실패한 대상은 각각 2D6 Poison 피해를 받는다.',
    '땅에서 가시 덩굴이 솟는다. 범위 안의 생물은 Athletics를 판정해 실패하면 Restrained 상태가 된다.',
    '섬뜩한 노래를 부른다. 방 안의 모든 생물이 Resolve를 판정해 실패하면 Frightened (20) 상태가 된다.',
    '독 마법으로 자신을 강화한다. 다음에 성공한 공격이 2D6 Poison 피해를 더 준다.',
  ],
  'cr-zephyrous-shadow': [
    '번개 화살을 연달아 쏟아낸다. 방 안의 모든 생물이 Dodge를 판정해 실패하면 2D6 Lightning 피해를, 성공하면 그 절반을 받는다.',
    '그림자에 녹아든다. 다음 자기 턴이 시작될 때까지 이 생물을 노리는 공격은 Disadvantage를 받고, 이 생물은 Arcane을 뺀 모든 피해에 Resistant가 된다.',
    '번개로 몸을 두른다. 다음 2라운드 동안 이 생물을 공격하는 모든 생물이 2 Lightning 피해를 받는다. 중첩되지 않으며, 다시 나오면 지속 시간이 처음부터 다시 시작된다.',
    '방 안의 대상 하나에게 저주를 건다. 다음 2라운드 동안 대상은 Cursed 상태이며, 공격할 때마다 Resolve를 판정해 실패하면 그 공격을 Disadvantage로 한다.',
    '번개를 두르고 돌진해 대상 하나에게 근접 공격을 한다. 명중하면 D6+2 Force 피해를 준다.',
    '바람과 번개를 한데 모아 터뜨린다. 방 안의 모든 생물이 Dodge를 판정해 실패하면 3D4 Force 피해를, 성공하면 그 절반을 받는다.',
  ],
  // ── Mastery Minions ──
  'cr-arcane-companion': [
    'Aether 화살을 대상 하나에게 쏘아 D6+1 Arcane 피해를 준다.',
    '에테르 기운을 모아 대상 하나에게 쏘아 2D4 Arcane 피해를 준다. 대상은 Endurance를 판정해 실패하면 다음 자기 턴이 끝날 때까지 Blinded 상태가 된다.',
  ],
  'cr-fire-elemental': [
    '불꽃을 쏘아 명중하면 D4 Fire 피해를 준다. 대상은 Body 판정을 해 실패하면 Burning 상태가 된다.',
    '방 전체를 덮는 불의 폭풍을 부른다. 범위 안의 모든 생물이 D4 Fire 피해를 받는다.',
  ],
  'cr-skeleton': [
    '무기를 서툴게 휘둘러 D4 Slashing 피해를 준다.',
    '대상 하나의 생명력에 손을 뻗는다. 대상이 Magic Resistance 판정에 실패하면 D4 Necrotic 피해를 받고, Skeleton은 Health를 1 회복한다.',
  ],
  'cr-wight': [
    '죽음의 기운을 담은 팔을 휘둘러 D6 Necrotic 피해를 준다.',
    '대상 하나를 죽음의 포옹으로 감싼다. 대상은 Endurance를 판정해 실패하면 D4+1 Necrotic 피해를 받는다.',
  ],
  'cr-frost-elemental': [
    '얼음 창을 뻗어 D6 Cold 피해를 준다.',
    '눈보라를 불러 모든 대상에게 D4 Cold 피해를 준다. Spellward 판정에 실패한 생물은 Restrained 상태가 된다.',
  ],
};
