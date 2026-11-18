export interface CoreTableIndexItem {
  title: string;
  pages: number[];
  refs: string[];
  note?: string;
}

function item(title: string, pages: number[], ...refs: string[]): CoreTableIndexItem {
  return { title, pages, refs };
}

/** The printed Gravebound v1.2 table index (p.247). Pages here are the index's pointers. */
export const coreTableIndex: readonly CoreTableIndexItem[] = [
  item('Armor — Greaves', [211], 't-armor-limbs'),
  item('Armor — Torso', [211], 't-armor-torso'),
  item('Armor — Vambraces', [211], 't-armor-limbs'),
  item('Combat Encounters', [133], 't-encounter-general', 't-encounter-a', 't-encounter-b'),
  item('Common Gear', [212], 't-common-gear'),
  item('Container Loot', [220], 't-container-loot', 'container-relics'),
  item('Corridor Description', [100], 't-corridor-description'),
  item('Critical Successes & Failures', [71], 't-noncombat-crits'),
  item('Damage Type', [225], 't-damage-type'),
  item('Difficulty Modifier', [69], 'difficulty'),
  item('Enemy Type', [225], 't-enemy-type'),
  item('Events', [108], 't-events'),
  item('Exhaustion Effect', [90], 't-exhaustion'),
  item('Fragments', [214], 't-fragments'),
  item('Gems & Jewelry', [215], 't-gems'),
  item('Growing Darkness', [120], 't-growing-darkness'),
  item('Helmets', [210], 't-helmets'),
  item('Hit Locations', [80, 81], 't-hit-humanoid', 't-hit-quadruped', 't-hit-arachnid', 't-hit-insectoid', 't-hit-winged', 't-hit-serpentoid'),
  item('Is There a Door?', [99], 't-door'),
  item('Item Rarity', [224], 't-item-rarity'),
  item('Lore Books', [216], 't-lore-books'),
  item('Madness', [91], 't-madness'),
  item('Magic Item', [224], 't-item'),
  item('Magic Item Peculiarity', [232], 't-peculiarity'),
  item('Magic Properties — Armor', [226], 't-props-armor'),
  item('Magic Properties — Belt', [227], 't-props-belt'),
  item('Magic Properties — Boots', [228], 't-props-boots'),
  item('Magic Properties — Gloves', [229], 't-props-gloves'),
  item('Magic Properties — Rings', [230], 't-props-ring'),
  item('Magic Properties — Weapons', [231], 't-props-weapon'),
  item('Mundane Items', [213], 't-mundane'),
  item('NPC & Enemy Defensive Moves', [78], 't-defensive-move-npc'),
  item('NPC & Enemy Fumbles', [85], 't-fumble-npc'),
  item('Overseer', [179], 't-overseer'),
  item('Overseer Influence', [100], 't-overseer-influence'),
  item('Personal Goals', [64], 't-personal-goals'),
  item('Player Defensive Move', [78], 't-defensive-move-pc'),
  item('Player Fumbles', [84], 't-fumble-pc'),
  item('Potions', [221], 't-potions'),
  item('Potion Aging', [126], 't-potion-aging'),
  item('Precious Items', [213], 't-precious'),
  item('Random Armor', [223], 't-random-armor'),
  item('Random Difficulty', [69], 't-difficulty'),
  item('Random Mastery', [222], 't-random-mastery'),
  { ...item('Random Shield', [205], 't-random-shield'), note: '205쪽은 화폐 설명이고, 무작위 방패 굴림표는 223쪽에 있습니다.' },
  item('Random Torso Armor', [223], 't-random-torso'),
  item('Random Weapon', [222], 't-random-weapon'),
  item('Relics', [234], 't-relics'),
  item('Resources', [222], 't-resources'),
  item('Room & Corridor Shape', [97], 't-room-shape'),
  item('Room Description', [102], 't-room-description'),
  item('Scavenging', [116], 't-scavenging'),
  item('Shields', [223], 't-random-shield', 't-shields'),
  item('Spoils', [213], 't-spoils'),
  item('Traps', [119], 't-traps'),
  item('Valuable Items', [213], 't-valuable'),
  item('Vambraces, Greaves & Helmets', [223], 't-random-limbs'),
  item('Weapons', [208], 't-weapons'),
  item('Which Crime Were You Accused Of?', [16], 't-crime'),
];
