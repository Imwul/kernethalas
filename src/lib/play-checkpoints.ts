import { creatureById } from '../content/entries/creatures';
import { isCombatDamageRecord, isCombatDamageSlot } from './combat-damage-records';
import { isAttackFollowUp } from './attack-follow-ups';
import { MAX_SET_NAME, PLAY_ENCOUNTER_STORAGE_KEY, readPlayCustomEncounterRows, type EncounterSet } from './custom-encounters';
import { DAMAGE_TYPES } from './damage';
import { DICE_CHAIN } from './dice';
import { isPaperMapDoorReport, isPaperMapDoorReports, isPaperMapTile, PAPER_MAP_SLOT, PAPER_MAP_TAGS, paperMapKey } from './paper-map';
import { isClueRollId, isPaperMapClues, MAP_CLUE_ROLL_SLOTS, type PaperMapClue } from './paper-map-clues';
import { campaignStorageKey, openSavedCampaign, PLAY_ROOM_STORAGE_KEY } from './play-campaigns';
import { isPlayOngoing, LINGERING_ENTRY_SLOT, LINGERING_RECORDED_SLOT, PLAY_EFFECT_CHANGES_SLOT, PLAY_EFFECTS_SLOT } from './play-effects';
import { ARMOR_DICE, GEAR_LOCATIONS, GEAR_WEIGHTS, gearKey, isGearLedger, PLAY_GEAR_STORAGE_KEY, showIntegrity, type GearLedger } from './play-inventory';
import { RETREAT_RETURN_SLOT } from './play-domain';
import { isPlayLight, PLAY_LIGHT_SLOT } from './play-light';
import { isPlaySession, PLAY_SESSION_SLOT } from './play-session';
import { PLAY_ROLL_INPUT_LIMIT, readPlayRollHistory, safePlaySlot, type PlayRollEntry } from './play-roll-history';
import { isPlayPendingRolls, PLAY_PENDING_ROLLS_SLOT } from './play-pending-rolls';
import { isSkillModifierList, isSkillPresetRecord, SKILL_PRESETS_SLOT } from './play-skill';
import { isPlayCharacter, MADNESS_TIMING_SLOT, PLAY_CHARACTER_SLOT, SURVIVOR_BASELINE_SLOT } from './play-character';
import { isPlayTimeline, PLAY_TIMELINE_SLOT } from './play-timeline';
import { isGrowthSkill } from './skill-growth';

export interface PlayCheckpointData {
  slots: Record<string, unknown>;
  gear: GearLedger;
  encounters: EncounterSet[];
  history?: PlayRollEntry[];
}

export interface PlayCheckpoint {
  id: string;
  name: string;
  place: string;
  stage: string;
  createdAt: number;
  lightRemaining?: number | null;
  data: PlayCheckpointData;
}

const FORMAT = 'kernethalas-play-checkpoint';
const VERSION = 1;
const STORAGE_KEY = 'kn-play-checkpoints-v1';
export const CHECKPOINT_NAME_MAX = 80;
export const CHECKPOINT_MAX_BYTES = 2 * 1024 * 1024;
const EDGE = ['none', 'advantage', 'disadvantage'];
const OUTCOMES = ['critical', 'success', 'failure', 'fumble'];
const ATTACK_OUTCOMES = ['hit', 'critical-hit', 'miss', 'defended', 'both-failed', 'reroll'];
const PLACE_TYPES = ['room', 'corridor'];
const ENCOUNTER_KINDS = ['encounter', 'overseer'];
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

type Validator = (value: unknown) => boolean;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string';
const textWithLimit = (limit: number): Validator => (value) => isText(value) && value.length <= limit;
const isBoolean = (value: unknown) => typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const between = (min: number, max: number): Validator =>
  (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isPositive = between(1, Number.MAX_SAFE_INTEGER);
const isCount = between(0, Number.MAX_SAFE_INTEGER);
const isD100 = between(1, 100);
const oneOf = (values: readonly unknown[]): Validator => (value) => values.includes(value);
const nullable = (validate: Validator): Validator => (value) => value === null || validate(value);
const optional = (validate: Validator): Validator => (value) => value === undefined || validate(value);
const list = (validate: Validator): Validator => (value) => Array.isArray(value) && value.every(validate);
const recordOf = (validate: Validator): Validator => (value) => isRecord(value) && Object.values(value).every(validate);
const shape = (fields: Record<string, Validator>): Validator => (value) =>
  isRecord(value) && Object.entries(fields).every(([key, validate]) => validate(value[key]));
const integrity = oneOf([...ARMOR_DICE, 'broken']);
const creature = (value: unknown) => isText(value) && creatureById.has(value);
const tensionDie = oneOf([4, 6, 8]);
const outcome = oneOf(OUTCOMES);
const checkInputs = shape({ skill: isText, roll: isText, edge: oneOf(EDGE), difficulty: optional(isText), weapon: optional(isText),
  modifiers: optional(isSkillModifierList) });
const diceFace = shape({ tens: between(0, 9), ones: between(0, 9), value: isD100 });
const skillResult = shape({ raw: diceFace, read: diceFace, skill: isFiniteNumber, outcome, flippedRead: isBoolean });
const confirmedSkill = shape({ inputs: checkInputs, result: skillResult });
const rollResult = shape({ expr: isText, dice: list(isPositive), mod: isFiniteNumber, total: isFiniteNumber });
const summonRoll: Validator = (value) => isRecord(value) && value.expr === 'D4' && value.mod === 0
  && Array.isArray(value.dice) && value.dice.length === 1 && between(1, 4)(value.dice[0]) && value.total === value.dice[0];
const damageType = oneOf(['', ...DAMAGE_TYPES]);
const storyEffect: Validator = (value) => isRecord(value) && (
  value.kind === 'count'
    ? isText(value.name) && isFiniteNumber(value.amount) && optional(oneOf(Object.keys(GEAR_WEIGHTS)))(value.weight)
    : value.kind === 'integrity' && isText(value.itemId) && integrity(value.before) && integrity(value.after)
);
const paperChange = shape({ id: isText, text: isText, gear: optional(storyEffect) });
const discovery = shape({ id: isText, name: isText, source: oneOf(['roll', 'map']) });
const domainProgress = shape({
  mode: oneOf(['standard', 'intro']), corridorLair: isBoolean, entryPlaceId: nullable(isText),
  lairDie: oneOf(DICE_CHAIN), exitDie: oneOf(DICE_CHAIN), lair: nullable(discovery), exit: nullable(discovery),
  lastCheck: nullable(shape({ kind: oneOf(['lair', 'exit']), placeId: isText, die: oneOf(DICE_CHAIN), value: isPositive })),
});
const influence = shape({ roll: nullable(between(1, 10)), damageRoll: nullable(isPositive) });
const domain = shape({
  id: isPositive, name: isText, overseerRoll: nullable(between(1, 10)), overseerRevealedRoll: optional(nullable(between(1, 10))), defeated: isBoolean, influence,
  extra: recordOf(influence), darkness: list(shape({ id: isText, roll: isD100 })), encounterSetId: optional(isText),
  retreats: optional(list(shape({ id: isText, place: isText, creatureIds: list(creature), kind: oneOf(ENCOUNTER_KINDS),
    origin: optional(shape({ area: optional(oneOf(PLACE_TYPES)), paperId: optional(textWithLimit(32)) })) }))),
  progress: optional(domainProgress),
});
const battle = shape({
  kind: oneOf(ENCOUNTER_KINDS), planKey: optional(isText), retreatId: optional(isText), primaryId: nullable(creature),
  seed: optional(shape({ creatureIds: list(creature), description: isText })), creatureIds: list(creature),
  outcome: nullable(oneOf(['victory', 'ended', 'fled'])),
  defeatedTargets: optional(list(shape({ creatureId: creature, label: isText }))),
  victoryXp: optional(isCount),
});
const tension = shape({ sides: tensionDie, value: between(1, 8), nextDie: tensionDie, darkness: isBoolean });
const lootReport = shape({ journal: isText, sheet: isText, gear: optional(storyEffect) });
const checkDraft = shape({ target: isText, edge: optional(oneOf(EDGE)), rolledEdge: optional(oneOf(EDGE)),
  roll: nullable(isD100), modifiers: optional(isSkillModifierList) });
const encounterRoll = shape({ roll: isText, edge: optional(oneOf(EDGE)), growthRecorded: optional(isBoolean) });
const encounterCheck = shape({ skill: isText, roll: isText, edge: optional(oneOf(EDGE)), growthRecorded: optional(isBoolean) });
const roundTiming = oneOf(['start', 'end', 'round']);
const mapLocation = shape({ domainId: isPositive, paperId: (value) => isText(value) && value.length <= 32 && !!paperMapKey(value),
  note: textWithLimit(400), area: oneOf(PLACE_TYPES), tags: list(oneOf(PAPER_MAP_TAGS)), tile: optional(isPaperMapTile),
  doors: optional(isPaperMapDoorReports), clues: optional(isPaperMapClues) });
const carryCounts = shape({ normal: isText, heavy: isText, light: isText, coins: isText, gems: isText });
const tradeDirection = oneOf(['buy', 'sell']);
const tradeLine = shape({ direction: tradeDirection, name: isText, quantity: isPositive, price: isCount });
const masteryTarget = shape({ attack: optional(skillResult), defense: optional(skillResult), roll: optional(rollResult),
  armor: optional(isText), reduction: optional(isText), modifier: optional(isText),
  reactions: optional(recordOf(isBoolean)), confirmed: optional(isBoolean) });
const confirmedAttack = nullable(shape({ id: isText, attacker: isText, defender: isText, breakdown: optional(textWithLimit(1800)),
  result: optional(shape({ outcome: oneOf(ATTACK_OUTCOMES), reason: isText, attackerFumble: isBoolean })) }));
const areaRoles = (value: unknown) => isRecord(value) && Object.entries(value).every(([index, role]) =>
  /^(?:[0-9]|1[01])$/.test(index) && shape({ role: oneOf(['pc', 'companion', 'minion']), revision: isPositive })(role))
  && Object.values(value).filter((choice) => (choice as { role: string }).role === 'pc').length <= 1;

const survivorBaseline = shape({ lineIds: list(isText), xpSpent: isCount, goals: recordOf(isCount) });
const madnessTiming = list(shape({ result: oneOf([4, 7]), previousLines: list(isText) }));
const lingeringConditions = list(oneOf(['bleeding', 'burning', 'poisoned']));
const pendingGrowth = list((value) => isText(value) && isGrowthSkill(value));
const pendingSkill = shape({ skill: optional(textWithLimit(64)), roll: optional(textWithLimit(8)), difficulty: optional(textWithLimit(8)),
  edge: optional(oneOf(EDGE)), weapon: optional(isText), modifiers: optional(isSkillModifierList) });

const ROOT_FIELDS: Record<string, Validator> = {
  active: oneOf(['explore', 'combat', 'wrapup', 'journal']),
  combat: isText, wrap: isText, placeName: isText, note: isText, roomLedgerId: isText,
  nextTension: oneOf(['', 'D4', 'D6', 'D8']), initialTension: tensionDie, domainId: isPositive, roomNumber: isPositive,
  [RETREAT_RETURN_SLOT]: nullable(isText),
  domains: (value) => Array.isArray(value) && value.length > 0 && value.every(domain)
    && new Set(value.map(({ id }) => id)).size === value.length,
  dismissedDarkness: list(isText), paperApplied: list((value) => isText(value) || shape({ id: isText, text: isText })(value)),
  journalCopiedText: isText, skillCriticalHistory: list(isText),
  pendingSkillGrowth: pendingGrowth,
  battles: recordOf(battle), targetNames: recordOf(list(isText)), battleLines: recordOf(isText),
  masteryReports: recordOf(isText), masterySheet: recordOf(list(paperChange)), battleSheet: recordOf(list(paperChange)),
  [PAPER_MAP_SLOT]: (value) => {
    if (!Array.isArray(value) || !value.every(mapLocation)) return false;
    const places = new Set(value.map(({ domainId, paperId }) => `${domainId}/${paperMapKey(paperId)}`));
    return places.size === value.length && value.every(({ tile, area, clues = [], domainId, paperId }) =>
      (tile === undefined || isPaperMapTile(tile, area)) && clues.every(({ relatedPaperId }: PaperMapClue) => !relatedPaperId
        || paperMapKey(relatedPaperId) !== paperMapKey(paperId) && places.has(`${domainId}/${paperMapKey(relatedPaperId)}`)));
  },
  [PLAY_TIMELINE_SLOT]: isPlayTimeline,
  [PLAY_SESSION_SLOT]: isPlaySession,
  [PLAY_EFFECTS_SLOT]: isPlayOngoing, [PLAY_EFFECT_CHANGES_SLOT]: list(paperChange),
  [PLAY_LIGHT_SLOT]: isPlayLight,
  [PLAY_PENDING_ROLLS_SLOT]: isPlayPendingRolls, [SKILL_PRESETS_SLOT]: isSkillPresetRecord, [PLAY_CHARACTER_SLOT]: isPlayCharacter,
  characterWorkspace: nullable(oneOf(['create', 'sheet'])),
  introStart: nullable(shape({ damage: between(1, 6), sanity: between(1, 4) })),
  [SURVIVOR_BASELINE_SLOT]: nullable(survivorBaseline), [MADNESS_TIMING_SLOT]: madnessTiming,
  confirmedBreather: isText, confirmedCamp: isText,
  [LINGERING_ENTRY_SLOT]: lingeringConditions, [LINGERING_RECORDED_SLOT]: nullable(lingeringConditions),
};

// The most heavily structured child records are read as arrays or objects in the Play views.
// Plain leaf preferences and future fields can be carried through the format as bounded JSON.
const SCOPED_FIELDS: Record<string, Validator> = {
  'creature-actions-revealed': isBoolean,
  'creation-applied': nullable(shape({ character: isPlayCharacter, presets: isSkillPresetRecord, gearSource: optional(isText), continuity: optional(shape({
    baseline: nullable(survivorBaseline), madnessTiming, ongoing: isPlayOngoing, entryConditions: lingeringConditions,
    recordedConditions: optional(nullable(lingeringConditions)), pendingGrowth,
  })) })),
  'sheet-log': list(paperChange),
  'entry-tension': nullable(tension),
  'tension-selected': nullable(tensionDie),
  'entry-light-mode': oneOf(['lit', 'dark', 'exempt']),
  'entry-light-resolve': nullable(oneOf(['critical', 'success', 'failure', 'fumble'])),
  'entry-dark-check': nullable(confirmedSkill),
  'breather-tension-check': nullable(tension),
  'force-tension': recordOf(tension),
  'action-tension': list(shape({ id: isText, result: tension, darkness: nullable(isD100), followUpId: optional(isText) })),
  'finished-doors': list(shape({ text: isText, sheet: list(paperChange) })),
  'place-description': shape({ room: nullable(isD100), corridor: nullable(between(1, 20)) }),
  [MAP_CLUE_ROLL_SLOTS.event]: nullable(isClueRollId),
  [MAP_CLUE_ROLL_SLOTS.room]: nullable(isClueRollId),
  [MAP_CLUE_ROLL_SLOTS.corridor]: nullable(isClueRollId),
  'place-choice': oneOf(['shape', ...PLACE_TYPES]),
  'room-tile': nullable(shape({ roll: isD100, turns: between(0, 3), entrance: nullable(between(0, 8)),
    marks: recordOf(oneOf(['unexplored', 'checked', 'locked'])) })),
  'shape-roll': nullable(isD100),
  'entry-darkness': nullable(isD100),
  'encounter-roll': nullable(between(1, 20)),
  'event-roll': nullable(isD100),
  'paper-map-key': isText,
  'paper-map-resume-exit': textWithLimit(48),
  'lineup': shape({
    targets: list(shape({ id: isText, creatureId: creature, source: isText, ordinal: optional(isPositive),
      status: optional(oneOf(['defeated', 'left'])) })),
    activeId: nullable(isText), encounterId: nullable(isText),
  }),
  'table-choice': nullable(shape({ table: oneOf(['t-encounter-a', 't-encounter-b', 't-overseer']), roll: isPositive })),
  'plan': shape({ picks: list(isText), assignments: recordOf(isText) }),
  'skill-roll': nullable(confirmedSkill),
  'flee-dodge': nullable(confirmedSkill),
  'attack': nullable(confirmedSkill),
  'defense': nullable(confirmedSkill),
  'check-attempt': isCount,
  'start-mode': oneOf(['initiative', 'surprise', 'ambushed']),
  'start-mind': nullable(isText),
  'start-followers': isText,
  'start-resolve': encounterCheck,
  'start-stealth': encounterCheck,
  'start-perception': encounterCheck,
  'start-enemy-surprise': encounterRoll,
  'start-enemy-initiative': encounterRoll,
  'scavenge-check': nullable(shape({ skill: isText, roll: isD100, edge: oneOf(EDGE), modifiers: optional(isSkillModifierList), madness: optional(between(0, 1000)) })),
  'scavenge-pending-edge': nullable(oneOf(EDGE)),
  'scavenge-pending-modifiers': nullable(isSkillModifierList),
  'door-map-exit': textWithLimit(53),
  'door-manual-exit': textWithLimit(48),
  'resumed-door': nullable((value) => isPaperMapDoorReport(value) && !!value.deferred),
  'scavenge-quantity': list(nullable(isPositive)),
  'scavenge-selected': isPositive,
  'round-board-open': isBoolean,
  'round-position': shape({ round: isPositive, timing: roundTiming, actor: nullable(isText) }),
  'round-actions': nullable(shape({ round: isPositive, standard: isBoolean, free: isBoolean, reactions: between(0, 99) })),
  'lingering-rounds': list(isPositive),
  'lingering-round-fire': isBoolean,
  'poison-resisted-rounds': list(isPositive),
  'applied-conditions': list(isText),
  'round-actor': isText,
  'round-reminders': list(shape({ id: isText, actor: isText, timing: roundTiming, note: textWithLimit(120), checkedAt: optional(isText),
    effect: oneOf(['bleeding', 'burning', 'poisoned', 'frightened', 'dazed', 'stunned', 'freezing', 'custom']) })),
  'comparison-open': isBoolean,
  'comparison-type': oneOf(DAMAGE_TYPES),
  'comparison-magical': isBoolean,
  'comparison-effects': recordOf(list(isText)),
  'damage-roll': isText,
  'damage-type': damageType,
  'damage-modifier': isText,
  'damage-critical': between(1, 3),
  'damage-armor': nullable(isText),
  'damage-ignore': isText,
  'damage-reduction': isText,
  'damage-reactions': recordOf(isBoolean),
  'damage-confirmed-amount': isText,
  'damage-toughness': isText,
  'creature-level': isText,
  'creature-mode': oneOf(['action', 'hit', 'check', 'damage']),
  'creature-damage-preview': damageType,
  'element': rollResult,
  'setup-duration': rollResult,
  'duration': rollResult,
  'summons': summonRoll,
  'summon-added': nullable(between(-1, 4)),
  'summon-done': list(between(1, 4)),
  'attack-confirmed-pc': confirmedAttack,
  'attack-confirmed-enemy': confirmedAttack,
  'attack-defense-mode-pc': oneOf(['opposed', 'unopposed', 'automatic']),
  'attack-defense-mode-enemy': oneOf(['opposed', 'unopposed', 'automatic']),
  'area-open': isBoolean,
  'area-targets': (value) => Array.isArray(value) && value.length <= 12 && value.every(textWithLimit(48)),
  'area-roles': areaRoles,
  'area-target-revision': isCount,
  'area-damage-mode': oneOf(['individual', 'shared']),
  'area-shared-damage': recordOf(rollResult),
  'roll': (value) => value === null || isPositive(value) || rollResult(value),
  'loot-reports': recordOf(lootReport),
  'gem-values': list(nullable(isPositive)),
  'follow-report': lootReport,
  'attack-inputs': recordOf(shape({ skill: optional(isText), rollv: optional(isText),
    edge: optional(oneOf(EDGE)), growthSkill: optional(isText), growthRecorded: optional(isBoolean), modifiers: optional(isSkillModifierList),
    attackSkillKind: optional(oneOf(['base', 'adjusted'])) })),
  'camp-plan': shape({ quantities: recordOf(isText), hasRation: isBoolean, sleep: isBoolean, bedroll: isBoolean,
    darkness: isBoolean, swapAmulets: isBoolean, other: isText, die: isText, lostToughness: isText, sanityDie: isText,
    treatConditions: optional(lingeringConditions) }),
  'camp-treated': lingeringConditions,
  'camp-lost-toughness': isText,
  'camp-sanity-die': isText,
  'magic-item': shape({ item: nullable(isPositive), base: nullable(isPositive), detail: nullable(isPositive),
    mastery: nullable(isPositive), attuned: oneOf(['', 'camp', 'reason', 'reason-roll']), rarity: nullable(isPositive),
    properties: list(nullable(shape({ value: isPositive, detail: nullable(isPositive) }))), peculiarity: isText }),
  'bandage': shape({ purpose: oneOf(['heal', 'bleeding', 'poisoned']), check: checkDraft,
    recovery: nullable(isPositive), damage: list(nullable(isPositive)) }),
  'lingering': list(oneOf(['bleeding', 'burning', 'poisoned'])),
  'rot': shape({ trigger: oneOf(['exposure', 'breather', 'camp']), stage: optional(between(0, 8)), check: checkDraft,
    exhaustion: nullable(between(1, 4)), health: nullable(between(1, 4)) }),
  'skill-growth': shape({ name: isText, score: isText, roll: nullable(isD100), gain: nullable(between(1, 4)) }),
  'records': list(shape({ kind: oneOf(['treatment', 'rot', 'growth']), summary: isText, changes: list(isText) })),
  'answers': recordOf((value) => isText(value) || isFiniteNumber(value)),
  'rolls': recordOf(rollResult),
  'carrying': shape({ current: carryCounts, loot: carryCounts, backpack: isBoolean, pouches: isCount }),
  'trade': shape({ direction: tradeDirection, choice: isText, quantity: isText, name: isText, manualPrice: isText }),
  'trade-lines': list(tradeLine),
  'trade-confirmed': list(tradeLine),
  'advancement-draft': shape({ level: isText, xp: isText, mastery: isText, tier: isText,
    benefit: oneOf(['', 'Health', 'Toughness', 'Sanity', 'Aether', '피해 풀', '능력 피해', 'Skill', 'Resistance']),
    die: nullable(isPositive), type: isText, skill: isText, skillScore: isText, ability: isText,
    resistances: shape({ Endurance: isText, Resolve: isText, Spellward: isText }), battleForm: isBoolean }),
  'advancement-records': list(shape({ id: optional(isText), level: isPositive, summary: isText, changes: list(isText) })),
  'ability-origin': nullable(oneOf(['sheet', 'paper'])),
  'cast': shape({ level: isText, targets: nullable(list(isText)), manual: isText, spent: isText,
    aether: isText, blocked: isBoolean, resuming: isBoolean, rolls: recordOf(masteryTarget) }),
  'mastery-records': list(shape({ ability: isText, summary: isText, affected: list(isText), sustained: isBoolean,
    changes: list(shape({ text: isText, gear: optional(storyEffect) })) })),
};

const wrapFields: Record<string, Validator> = {
  'armor-checks': recordOf(shape({ name: isText, die: oneOf(ARMOR_DICE), value: isPositive })),
  'overseer-sanity': recordOf(isPositive),
};

function isSafeJson(value: unknown): boolean {
  let remaining = 60_000;
  function read(item: unknown, depth: number): boolean {
    if (--remaining < 0 || depth > 18) return false;
    if (item === null || typeof item === 'boolean' || isFiniteNumber(item)) return true;
    if (typeof item === 'string') return item.length <= 16_384;
    if (Array.isArray(item)) return item.every((entry) => read(entry, depth + 1));
    return isRecord(item) && Object.entries(item).every(([key, entry]) =>
      key.length <= 512 && !BAD_KEYS.has(key) && read(entry, depth + 1));
  }
  return read(value, 0);
}

function validSlot(key: string, data: unknown) {
  if (!safePlaySlot(key)) return false;
  if (isCombatDamageSlot(key)) return nullable(isCombatDamageRecord)(data);
  const scoped = key.includes('/');
  const leaf = key.slice(key.lastIndexOf('/') + 1);
  const fields = scoped ? SCOPED_FIELDS : ROOT_FIELDS;
  if (Object.hasOwn(fields, leaf)) return fields[leaf](data);
  if (key.startsWith('wrapup/')) {
    const suffix = leaf.slice(leaf.lastIndexOf(':') + 1);
    if (Object.hasOwn(wrapFields, suffix)) return wrapFields[suffix](data);
  }
  if (scoped && (leaf.startsWith('check-') || leaf.startsWith('scavenge-resolve-'))) {
    return nullable(confirmedSkill)(data);
  }
  if (scoped && leaf.startsWith('oracle-history:')) return list(isPositive)(data);
  if (leaf.startsWith('skill-pending:')) return pendingSkill(data);
  if (leaf.startsWith('roll-input:')) return nullable(textWithLimit(PLAY_ROLL_INPUT_LIMIT))(data);
  if (leaf.startsWith('tension-selected:')) return nullable(tensionDie)(data);
  if (scoped && leaf.startsWith('spoils-revealed:')) return nullable(isBoolean)(data);
  if (scoped && leaf.startsWith('attack-effect:')) return isAttackFollowUp(data);
  return true;
}

function validSlots(value: unknown): value is PlayCheckpointData['slots'] {
  return isRecord(value) && Object.entries(value).every(([key, data]) => validSlot(key, data));
}

function validEncounters(value: unknown): value is EncounterSet[] {
  if (!Array.isArray(value) || !value.length) return false;
  const ids = new Set<string>();
  return value.every((set: unknown) => {
    if (!isRecord(set) || !isText(set.id) || !set.id || ids.has(set.id) || !isText(set.name)
      || !set.name.trim() || set.name.length > MAX_SET_NAME || !Array.isArray(set.rows)
      || readPlayCustomEncounterRows(set.rows).length !== set.rows.length) return false;
    ids.add(set.id);
    return true;
  });
}

function validateCheckpoint(value: unknown): PlayCheckpoint | null {
  if (!isSafeJson(value) || !isRecord(value) || !isRecord(value.data)) return null;
  const { id, name, place, stage, createdAt, lightRemaining, data } = value;
  if (!isText(id) || !/^[a-z0-9_-]{1,80}$/i.test(id) || !isText(name) || !name.trim() || name.length > CHECKPOINT_NAME_MAX
    || !isText(place) || !place.trim() || !isText(stage) || !stage.trim() || !isFiniteNumber(createdAt)
    || !Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > 8.64e15
    || lightRemaining !== undefined && lightRemaining !== null && (typeof lightRemaining !== 'number' || !isCount(lightRemaining))
    || !validSlots(data.slots) || !isGearLedger(data.gear) || !validEncounters(data.encounters)) return null;
  const history = readPlayRollHistory(data.history);
  if (data.history !== undefined && (!Array.isArray(data.history) || history.length !== data.history.length
    || !history.every((entry) => entry.changes.every(({ slot, before, after }) =>
      [...before, ...after].every((item) => validSlot(slot, item)))))) return null;
  return {
    id, name, place, stage, createdAt, ...(lightRemaining !== undefined ? { lightRemaining } : {}),
    data: { slots: data.slots, gear: data.gear, encounters: data.encounters, history },
  };
}

export function exportPlayCheckpoint(checkpoint: PlayCheckpoint) {
  return JSON.stringify({ format: FORMAT, version: VERSION, checkpoint }, null, 2);
}

export function parsePlayCheckpoint(raw: string): PlayCheckpoint | null {
  if (new TextEncoder().encode(raw).byteLength > CHECKPOINT_MAX_BYTES) return null;
  try {
    const data: unknown = JSON.parse(raw);
    return isRecord(data) && data.format === FORMAT && data.version === VERSION
      ? validateCheckpoint(data.checkpoint) : null;
  } catch { return null; }
}

export function capturePlayCheckpoint(name: string, place: string, stage: string, data: PlayCheckpointData, lightRemaining?: number | null) {
  const checkpoint: PlayCheckpoint = { id: crypto.randomUUID(), name, place, stage, createdAt: Date.now(), data, lightRemaining };
  // Use the same decoder for a captured game and a file, keeping existing draft objects separate.
  return parsePlayCheckpoint(exportPlayCheckpoint(checkpoint));
}

export function forkPlayCheckpoint(checkpoint: PlayCheckpoint, name: string) {
  const saved = validateCheckpoint(checkpoint);
  if (!saved) return { error: '저장 지점의 형식을 확인하세요.' };
  const { slots, history, gear, encounters } = saved.data;
  return openSavedCampaign(name, [
    [PLAY_ROOM_STORAGE_KEY, JSON.stringify({ slots, history, undo: [] })],
    [PLAY_GEAR_STORAGE_KEY, JSON.stringify(gear)],
    [PLAY_ENCOUNTER_STORAGE_KEY, JSON.stringify(encounters)],
  ]);
}

function previewGear(ledger: GearLedger) {
  const groups = new Map<string, { name: string; stacks: Map<string, number> }>();
  for (const { name, count, integrity, location } of ledger.items) {
    const key = gearKey(name);
    const group = groups.get(key) ?? { name, stacks: new Map() };
    const stack = `${GEAR_LOCATIONS[location]}${integrity ? ` · 내구도 ${showIntegrity(integrity)}` : ''}`;
    group.stacks.set(stack, (group.stacks.get(stack) ?? 0) + count);
    groups.set(key, group);
  }
  return new Map([...groups].map(([key, { name, stacks }]) => [key, {
    name, summary: [...stacks].sort(([a], [b]) => a.localeCompare(b, 'ko')).map(([stack, count]) => `${stack} ${count}개`).join(' / '),
  }]));
}

export function compareCheckpointGear(current: GearLedger, saved: GearLedger) {
  const before = previewGear(current);
  const after = previewGear(saved);
  return [...new Set([...before.keys(), ...after.keys()])].flatMap((key) => {
    const old = before.get(key);
    const next = after.get(key);
    return old?.summary === next?.summary && old?.name === next?.name ? [] : [{
      key, name: next?.name ?? old!.name, current: old?.summary ?? '미등록', saved: next?.summary ?? '미등록',
    }];
  });
}

export function readPlayCheckpoints(campaignId?: string): PlayCheckpoint[] | null {
  try {
    const raw = localStorage.getItem(campaignStorageKey(STORAGE_KEY, campaignId));
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return null;
    const seen = new Set<string>();
    return data.flatMap((entry: unknown) => {
      const item = validateCheckpoint(entry);
      if (!item || seen.has(item.id)) return [];
      seen.add(item.id);
      return [item];
    });
  } catch { return null; }
}

export function storePlayCheckpoints(checkpoints: PlayCheckpoint[], campaignId?: string) {
  try {
    localStorage.setItem(campaignStorageKey(STORAGE_KEY, campaignId), JSON.stringify(checkpoints));
    return true;
  } catch { return false; }
}
