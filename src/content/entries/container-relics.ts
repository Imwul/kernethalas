import { core, ed } from '../helpers';
import type { Entry, TableRow } from '../schema';

const id = 'container-relics';
const outcomes = [
  { label: 'Blank Diary', text: 'Heavy 장비. 소지한 동안 세 번째 Personal Goal을 함께 진행할 수 있다.' },
  { label: 'Borestian Stone', text: 'Amulet. 소지하고 있으면 Medicine 판정 없이 물약을 즉시 감정한다.' },
  { label: 'Heart Fragment of Amal-Tul', text: '소모품. 먹으면 즉시 XP 200을 얻고 Sanity D6을 잃는다.' },
  { label: 'Mace of Obliteration', text: 'Mace. 사용 조건은 Athletics 60과 Bludgeoning Weapons 60. 명중 시 Armor를 무시하고 Slashing 피해 4를 준다.' },
  { label: 'Ring of Mental Peace', text: '반지. 다른 캐릭터를 만져 Sanity D6을 회복시킨다. 캠프 휴식당 1회이며 자신에게는 사용할 수 없다.' },
  { label: 'Vial of Potency — Aether', text: '소모품. Aether가 영구적으로 D4 증가한다.' },
  { label: 'Vial of Potency — Endurance', text: '소모품. Endurance가 영구적으로 5 증가한다.' },
  { label: 'Vial of Potency — Health', text: '소모품. Health가 영구적으로 D4 증가한다.' },
  { label: 'Vial of Potency — Spellward', text: '소모품. Spellward가 영구적으로 5 증가한다.' },
  { label: 'Vial of Potency — Sanity', text: '소모품. Sanity가 영구적으로 D4 증가한다.' },
];

export const containerRelicResults: TableRow[] = outcomes.map(({ label, text }, offset) => {
  const roll = 11 + offset;
  return { min: roll, max: roll, label, ko: text, next: [{ id }] };
});

export const containerRelicEntries: Entry[] = [
  {
    id,
    kind: 'item',
    category: 'loot',
    en: 'Container Relics',
    ko: '용기 유물',
    aliases: ['container relics', '용기 유물', '상자 유물', 'blank diary', 'borestian stone', 'heart fragment of amal-tul', 'mace of obliteration', 'ring of mental peace', 'vial of potency'],
    summary: '용기 전리품 D20의 11–20에서 얻는 유물 10종. 유물은 획득한 직후부터 사용할 수 있다.',
    when: '깊은 수색에서 발견한 용기를 열고 용기 전리품 표를 굴렸을 때.',
    outcomes,
    tables: ['t-container-loot'],
    related: [ed('relics'), ed('deep-search'), ed('personal-goals', 'Blank Diary'), ed('potions', 'Borestian Stone'), ed('once-per-rest', 'Ring of Mental Peace')],
    source: [core(220, 234, 240, 241)],
    verification: 'verified',
  },
];
