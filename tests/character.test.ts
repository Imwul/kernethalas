import { describe, expect, test } from 'vitest';
import {
  CREATION_SKILLS, EMPTY_CREATION, PERSONAL_GOALS, RECOMMENDED_GOAL, STARTING_WEAPONS, allotmentComplete, allotmentErrors, autoCreate,
  creationRecord, fillAllotment, goalTarget, skillScores, startingArmor, startingGear, startingGearToLedger, stepStatus,
} from '../src/lib/character-creation';
import { exhaustionBand, exhaustionChange, goalCounts, roomProgress, sanityChange, xpGain } from '../src/lib/character-progress';
import { abilityPoints, currentProgress, foldRoomProgress, isPlayCharacter, madnessEffects } from '../src/lib/play-character';
import { conditionsInText } from '../src/lib/play-effects';
import { masteryCatalog } from '../src/content/entries/masteries';
import { MASTERY_BRIEFS } from '../src/content/mastery-briefs';
import { masteryMix } from '../src/components/MasteryTree';

describe('character creation', () => {
  test('skill allotment follows p.19', () => {
    expect(skillScores({}).Perception).toBe(20);
    expect(skillScores({}).Medicine).toBe(0);
    expect(allotmentErrors({ Dodge: 60 })).toContain('+60은 무기 Skill에만 줄 수 있습니다.');
    expect(allotmentErrors({ 'Bladed Weapons': 60, 'Shafted Weapons': 60 })).toContain('+60은 1번만 줄 수 있습니다.');
    for (let run = 0; run < 50; run += 1) {
      const allot = fillAllotment({ Medicine: 30 });
      expect(allotmentComplete(allot)).toBe(true);
      expect(allot.Medicine).toBe(30);
      expect(Object.keys(allot)).toHaveLength(10);
    }
  });

  test('full auto fills every step and keeps what was chosen', () => {
    for (let run = 0; run < 50; run += 1) {
      const draft = autoCreate({ ...EMPTY_CREATION, masteries: ['m-arcanist'], resistance: 'Resolve' });
      const status = stepStatus(draft);
      expect(status.summary).toBe(true);
      expect(draft.masteries[0]).toBe('m-arcanist');
      expect(new Set(draft.masteries).size).toBe(2);
      expect(draft.resistance).toBe('Resolve');
      expect(draft.goals).toContain(RECOMMENDED_GOAL);
      const health = draft.attributes.Health!.total;
      expect(health).toBeGreaterThanOrEqual(11);
      expect(health).toBeLessThanOrEqual(16);
      const toughness = draft.attributes.Toughness!.total;
      expect(toughness).toBeGreaterThanOrEqual(23);
      expect(toughness).toBeLessThanOrEqual(38);
      const weapon = STARTING_WEAPONS.find(({ name }) => name === draft.weapon)!;
      expect(draft.allot[weapon.skill]).toBe(60);
      const { character, skills } = creationRecord(draft);
      expect(isPlayCharacter(character)).toBe(true);
      expect(character.weapon).toBe(weapon.skill);
      expect(skills.Resolve).toBe(40);
      expect(skills.Endurance).toBe(20);
      expect(Object.keys(skills)).toEqual(expect.arrayContaining([...CREATION_SKILLS]));
    }
  });

  test('starting armor and gear come from the Random Armor tables', () => {
    expect(startingArmor(1, 65)).toMatchObject({ name: 'Mail', integrity: 'D8' });
    expect(startingArmor(9, 90)).toMatchObject({ name: 'Wall Shield', heavy: true });
    expect(startingArmor(7, 10)).toMatchObject({ name: 'Light Helmet', integrity: 'D6' });
    expect(startingArmor(2, 95)).toMatchObject({ magic: true });
    const draft = { ...EMPTY_CREATION, weapon: 'Great Sword', armorPiece: 3, armorGrade: 50,
      supplies: { cooking: { expr: 'D10', dice: [4], mod: 0, total: 4 }, crafting: { expr: 'D10+5', dice: [2], mod: 5, total: 7 },
        coins: { expr: 'D20', dice: [11], mod: 0, total: 11 } } };
    const gear = startingGear(draft);
    expect(gear.map(({ name, count }) => `${name} ${count}`)).toEqual([
      'Great Sword 1', 'Medium Vambraces 1', 'Torch 1', 'Cooking Ingredients 4', 'Crafting Supplies 7', '동전 11']);
    expect(gear[0].weight).toBe('heavy');
    const result = startingGearToLedger({ items: [{ id: 't', name: 'Torch', count: 2, location: 'pack', weight: 'light' }], entries: [] }, gear, 'x');
    expect('ledger' in result && result.ledger.items.find(({ name }) => name === 'Torch')?.count).toBe(3);
    expect('ledger' in result && result.ledger.items.find(({ name }) => name === 'Medium Vambraces')?.integrity).toBe('D8');
  });

  test('personal goal targets', () => {
    expect(goalTarget('Acid 피해 200')).toBe(200);
    expect(goalTarget('누적 5,000₵ 획득')).toBe(5000);
    expect(goalTarget('Overseer 처치')).toBe(1);
    expect(PERSONAL_GOALS.length).toBeGreaterThan(30);
  });
});

describe('character progress', () => {
  test('reads resolved XP and Exhaustion changes only', () => {
    expect(xpGain('XP +50 (승리)')).toBe(50);
    expect(xpGain('Lore Book (발견 XP +10).')).toBe(10);
    expect(xpGain('XP 1,050 → 0')).toBe(0);
    expect(exhaustionChange('깊은 수색 · Exhaustion +2')).toBe(2);
    expect(exhaustionChange('Exhaustion −10 (야영 회복)')).toBe(-10);
    expect(exhaustionChange('Exhaustion +D4')).toBe(0);
    const room = roomProgress([{ id: 'a', text: 'XP +10' }, { id: 'b', text: 'Exhaustion +2 (화상 끄기)' }, { id: 'c', text: 'Exhaustion −1 (Ration)' }], 0);
    expect(room).toMatchObject({ xp: 10, exhaustion: 1 });
  });

  test('current values add this place and fold when moving on', () => {
    const room = roomProgress([{ id: 'a', text: 'XP +70' }, { id: 'b', text: 'Exhaustion +3' }], 1050);
    const character = { level: 2, xp: 980, exhaustion: 12 };
    expect(currentProgress(character, room)).toMatchObject({ xp: 0, exhaustion: 15 });
    expect(foldRoomProgress(character, room)).toMatchObject({ xp: 0, exhaustion: 15 });
    expect(exhaustionBand(15).short).toBe('Wounds 회복 절반');
    expect(exhaustionBand(21).short).toBe('사망');
  });

  test('ability points count base and Amulet tiers', () => {
    expect(abilityPoints({ level: 3, masteries: [{ id: 'm-arcanist', tier: 2 }, { id: 'm-brawler', tier: 1 }], amulet: { id: 'm-wraith', tier: 1 } }))
      .toEqual({ used: 4, total: 4, left: 0 });
    expect(isPlayCharacter({ masteries: [{ id: 'm-arcanist', tier: 1 }], amulet: { id: 'm-arcanist', tier: 0 } })).toBe(false);
    expect(isPlayCharacter({ amulet: { id: 'm-wraith', tier: 0 }, goals: [{ name: 'Scholar', progress: 3 }], completedGoals: ['Trap Buster'] })).toBe(true);
  });
});

describe('sanity, madness, goals and conditions', () => {
  test('Sanity changes ignore maximum changes and grow with Madness 4', () => {
    expect(sanityChange('Sanity −2 (Horrifying · Resolve 실패)')).toBe(-2);
    expect(sanityChange('최대 Sanity −5')).toBe(0);
    expect(sanityChange('Sanity 최대치 +3')).toBe(0);
    expect(sanityChange('Sanity +D4')).toBe(0);
    expect(sanityChange('Sanity −2', 1)).toBe(-3);
    const room = roomProgress([{ id: 'a', text: 'Sanity −2' }, { id: 'b', text: 'XP +50 (승리)' }], 0, { xpLoss: 10, extraSanityLoss: 1 });
    expect(room).toMatchObject({ sanity: -3, xp: 40 });
    expect(currentProgress({ sanity: 2, sanityMax: 12 }, room).sanity).toBe(0);
    expect(currentProgress({ sanity: 11, sanityMax: 12 }, roomProgress([{ id: 'a', text: 'Sanity +4' }])).sanity).toBe(12);
  });

  test('Madness results stack', () => {
    expect(madnessEffects([2, 6, 6, 7, 4])).toMatchObject({ rollPenalty: 1, resolve: 20, xpLoss: 10, extraSanityLoss: 1, dead: false });
    expect(madnessEffects([1]).dead).toBe(true);
  });

  test('goal counts come from defeated creature types, Lore Books and darkness', () => {
    const counts = goalCounts({
      defeated: [{ types: ['Undead', 'Humanoid'], overseer: false }, { types: ['Animal'], overseer: false }, { types: ['Demon'], overseer: true }],
      sheet: [{ id: 'a', text: 'Lore Book (발견 XP +10).' }], darkness: 2,
    });
    expect(counts).toMatchObject({ Annihilator: 3, Wraithstalker: 1, Marauder: 1, 'Beast Hunter': 1, 'Demon Bane': 1,
      'Overseer Overthrown': 1, 'Decapitate the Leadership': 1, 'Vaelorian Erudite': 1, 'Thrill Seeker': 2 });
    const character = { goals: [{ name: 'Wraithstalker', progress: 10 }] };
    const room = roomProgress([], 0, { goals: counts });
    expect(currentProgress(character, room).goals[0].progress).toBe(11);
    expect(foldRoomProgress(character, room).goals?.[0].progress).toBe(11);
  });

  test('conditions named in creature action text', () => {
    expect(conditionsInText('명중한 대상은 Endurance를 판정해 실패하면 Poisoned (1) 상태가 된다.')).toEqual([{ id: 'poisoned', level: 1 }]);
    expect(conditionsInText('Bleeding (2)와 Burning')).toEqual([{ id: 'bleeding', level: 2 }, { id: 'burning', level: 1 }]);
  });

  test('every Mastery has a brief and five abilities in its mix', () => {
    for (const mastery of masteryCatalog) {
      expect(MASTERY_BRIEFS[mastery.id]?.tags.length).toBeGreaterThan(1);
      const mix = masteryMix(mastery);
      expect(mix.aether + mix.weapon + mix.passive + mix.other).toBe(5);
    }
    expect(masteryMix(masteryCatalog.find(({ id }) => id === 'm-tracker')!).passive).toBe(4);
  });
});
