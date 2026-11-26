/**
 * One-line play-style notes for scanning the Mastery list. Written for this app from the abilities as a whole
 * (an editorial summary, not book text); the full rules stay on each Mastery's tree.
 */
export const MASTERY_BRIEFS: Record<string, { style: string; tags: string[] }> = {
  'm-abyssal-reaver': { style: '악마와 계약한 근접 전사. 무기와 Infernal 주문을 섞고, 적을 쓸어 Sanity를 되찾는다.', tags: ['근접+마법', 'Infernal', '공포·독 면역', 'Sanity 회복'] },
  'm-arcanist': { style: '무난한 만능 마법사. 여러 적 견제, 피해 흡수 보호막, 광원 대체, 소환수까지 고르게 갖췄다.', tags: ['원거리 마법', 'Arcane', '보호막', '소환'] },
  'm-brawler': { style: '맨주먹 격투가. 상대를 기절시키고, 연속 방어 페널티를 줄여 오래 버틴다.', tags: ['근접', '맨손·주먹', '기절', '방어'] },
  'm-bulwark': { style: '방패와 중갑의 탱커. 들어오는 피해를 깎고 Toughness를 쌓아 버틴다.', tags: ['방어', '방패', 'Toughness', '중갑'] },
  'm-duskblade': { style: '암살자. 독과 약화로 깎고, 확정 치명타와 투명화로 한 번에 끝낸다.', tags: ['근접', '독·약화', '치명타', '은신'] },
  'm-emissary': { style: '신의 대리인. 스스로 치유하고 상태를 지우며, 강한 Holy 주문으로 마무리한다.', tags: ['회복', 'Holy', '상태 해제', 'Sanity 회복'] },
  'm-flamecaster': { style: '화염 마법사. 한 명·여럿·방 전체에 Fire 피해를 주고, 가두고, 정령을 부른다.', tags: ['원거리 마법', 'Fire', '광역', '소환'] },
  'm-frostweaver': { style: '냉기 마법사. 맞힌 적을 얼리고, 얼음 방패로 막고, Armor를 무시하는 얼음 무기를 든다.', tags: ['마법+근접', 'Cold', 'Freezing', '소환'] },
  'm-gravecaller': { style: '강령술사. 쓰러뜨린 적의 시체로 언데드를 일으키고, 시체를 터뜨린다.', tags: ['소환', 'Necrotic', '광역', '시체 활용'] },
  'm-hexmancer': { style: '저주술사. Cursed로 적의 전투력과 Armor를 서서히 깎고 생명력을 빨아들인다.', tags: ['약화', 'Cursed', '흡혈', 'Armor 약화'] },
  'm-icon-caller': { style: '전장에 Icon을 세워 매 라운드 회복·속박·광역 피해를 쌓는 설치형 술사.', tags: ['설치', '지속 효과', '광역', '아군 지원'] },
  'm-mindbinder': { style: '정신 조작자. 적의 마법을 막고, 싸움을 피하고, 앞방을 정찰하고, 적을 부하로 삼는다.', tags: ['제어', '전투 회피', '정찰', 'Sanity 회복'] },
  'm-ritualist': { style: '야영에서 만든 Ritual Component를 태워 위력을 키우는 의식 마법사. 준비가 곧 화력이다.', tags: ['재료 소모', 'Arcane', '야영 준비', '무기 강화'] },
  'm-stormbrand': { style: '쌍수 번개 전사. 무기에 번개를 싣고, 반격하고, 한동안 행동을 하나 더 얻는다.', tags: ['근접', '쌍수', 'Lightning', '광역'] },
  'm-tracker': { style: '생존 전문가. 뒤지기·야영·긴장 주사위를 안정시켜 던전 자체를 덜 위험하게 만든다.', tags: ['탐험', '생존', '야영', '패시브 위주'] },
  'm-umbra-phantom': { style: '그림자 술사. 어둠 속에서 보고, Sanity를 피해로 바꾸고, 전투에서 빠지고, 분신을 만든다.', tags: ['Psychic', '탈출', '광원 대체', 'Sanity 사용'] },
  'm-weapon-master': { style: '무기 하나의 달인. 막을 수 없는 일격, 여러 적 동시 공격, 부서지지 않는 무기.', tags: ['근접', '무기 특화', '방어 불가', '광역'] },
  'm-wraith': { style: '곡예 회피의 달인. Acrobatics로 공격과 함정을 피하고, 빈틈을 만들어 연속으로 친다.', tags: ['회피', 'Acrobatics', '연속 공격', '아군 지원'] },
  'm-wrathspawn': { style: '분노의 광전사. 큰 한 방과 돌진, 휘둘러 치기를 쓰고 때릴 때마다 회복한다.', tags: ['근접', '고피해', '돌진', '흡혈'] },
  'm-zealot': { style: '신성 전사. Holy 무기로 싸우며 스스로 회복하고, 아군의 마법 저항을 올린다.', tags: ['근접+마법', 'Holy', 'Resolve', '아군 지원'] },
};
