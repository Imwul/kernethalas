import { creatureById } from '../content/entries/creatures';
import { MAX_SET_NAME, readPlayCustomEncounterRows, type EncounterSet } from './custom-encounters';
import { DAMAGE_TYPES } from './damage';
import { DICE_CHAIN } from './dice';
import { isPaperMapDoorReports, isPaperMapTile, PAPER_MAP_SLOT, PAPER_MAP_TAGS, paperMapKey } from './paper-map';
import { campaignStorageKey } from './play-campaigns';
import { isPlayOngoing, PLAY_EFFECT_CHANGES_SLOT, PLAY_EFFECTS_SLOT } from './play-effects';
import { ARMOR_DICE, GEAR_WEIGHTS, isGearLedger, type GearLedger } from './play-inventory';
import { readPlayRollHistory, safePlaySlot, type PlayRollEntry } from './play-roll-history';
import { isPlayPendingRolls, PLAY_PENDING_ROLLS_SLOT } from './play-pending-rolls';
import { isSkillModifierList, isSkillPresetRecord, SKILL_PRESETS_SLOT } from './play-skill';
import { isPlayCharacter, PLAY_CHARACTER_SLOT } from './play-character';
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
  data: PlayCheckpointData;
}

const FORMAT = 'kernethalas-play-checkpoint';
const VERSION = 1;
const STORAGE_KEY = 'kn-play-checkpoints-v1';
export const CHECKPOINT_NAME_MAX = 80;
export const CHECKPOINT_MAX_BYTES = 2 * 1024 * 1024;
const EDGE = ['none', 'advantage', 'disadvantage'];
const OUTCOMES = ['critical', 'success', 'failure', 'fumble'];
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
  id: isPositive, name: isText, overseerRoll: nullable(between(1, 10)), defeated: isBoolean, influence,
  extra: recordOf(influence), darkness: list(shape({ id: isText, roll: isD100 })), encounterSetId: optional(isText),
  retreats: optional(list(shape({ id: isText, place: isText, creatureIds: list(creature), kind: oneOf(ENCOUNTER_KINDS) }))),
  progress: optional(domainProgress),
});
const battle = shape({
  kind: oneOf(ENCOUNTER_KINDS), planKey: optional(isText), retreatId: optional(isText), primaryId: nullable(creature),
  seed: optional(shape({ creatureIds: list(creature), description: isText })), creatureIds: list(creature),
  outcome: nullable(oneOf(['victory', 'ended', 'fled'])),
  defeatedTargets: optional(list(shape({ creatureId: creature, label: isText }))),
});
const tension = shape({ sides: tensionDie, value: between(1, 8), nextDie: tensionDie, darkness: isBoolean });
const lootReport = shape({ journal: isText, sheet: isText, gear: optional(storyEffect) });
const checkDraft = shape({ target: isText, edge: oneOf(EDGE), roll: nullable(isD100), modifiers: optional(isSkillModifierList) });
const encounterRoll = shape({ roll: isText, edge: oneOf(EDGE), growthRecorded: optional(isBoolean) });
const encounterCheck = shape({ skill: isText, roll: isText, edge: oneOf(EDGE), growthRecorded: optional(isBoolean) });
const roundTiming = oneOf(['start', 'end', 'round']);
const mapLocation = shape({ domainId: isPositive, paperId: (value) => isText(value) && value.length <= 32 && !!paperMapKey(value),
  note: textWithLimit(400), area: oneOf(PLACE_TYPES), tags: list(oneOf(PAPER_MAP_TAGS)), tile: optional(isPaperMapTile),
  doors: optional(isPaperMapDoorReports) });
const carryCounts = shape({ normal: isText, heavy: isText, light: isText, coins: isText, gems: isText });
const tradeDirection = oneOf(['buy', 'sell']);
const tradeLine = shape({ direction: tradeDirection, name: isText, quantity: isPositive, price: isCount });
const masteryTarget = shape({ attack: optional(skillResult), defense: optional(skillResult), roll: optional(rollResult),
  armor: optional(isText), reduction: optional(isText), modifier: optional(isText),
  reactions: optional(recordOf(isBoolean)), confirmed: optional(isBoolean) });

const ROOT_FIELDS: Record<string, Validator> = {
  active: oneOf(['explore', 'combat', 'wrapup', 'journal']),
  combat: isText, wrap: isText, placeName: isText, note: isText, roomLedgerId: isText,
  nextTension: oneOf(['', 'D4', 'D6', 'D8']), initialTension: tensionDie, domainId: isPositive, roomNumber: isPositive,
  domains: (value) => Array.isArray(value) && value.length > 0 && value.every(domain)
    && new Set(value.map(({ id }) => id)).size === value.length,
  dismissedDarkness: list(isText), paperApplied: list((value) => isText(value) || shape({ id: isText, text: isText })(value)),
  journalCopiedText: isText, skillCriticalHistory: list(isText),
  pendingSkillGrowth: list((value) => isText(value) && isGrowthSkill(value)),
  battles: recordOf(battle), targetNames: recordOf(list(isText)), battleLines: recordOf(isText),
  masteryReports: recordOf(isText), masterySheet: recordOf(list(paperChange)), battleSheet: recordOf(list(paperChange)),
  [PAPER_MAP_SLOT]: (value) => Array.isArray(value) && value.every(mapLocation)
    && value.every(({ tile, area }) => tile === undefined || isPaperMapTile(tile, area))
    && new Set(value.map(({ domainId, paperId }) => `${domainId}/${paperMapKey(paperId)}`)).size === value.length,
  [PLAY_TIMELINE_SLOT]: isPlayTimeline,
  [PLAY_EFFECTS_SLOT]: isPlayOngoing, [PLAY_EFFECT_CHANGES_SLOT]: list(paperChange),
  [PLAY_PENDING_ROLLS_SLOT]: isPlayPendingRolls, [SKILL_PRESETS_SLOT]: isSkillPresetRecord, [PLAY_CHARACTER_SLOT]: isPlayCharacter,
  confirmedBreather: isText, confirmedCamp: isText,
};

// The most heavily structured child records are read as arrays or objects in the Play views.
// Plain leaf preferences and future fields can be carried through the format as bounded JSON.
const SCOPED_FIELDS: Record<string, Validator> = {
  'entry-tension': nullable(tension),
  'breather-tension-check': nullable(tension),
  'force-tension': recordOf(tension),
  'action-tension': list(shape({ id: isText, result: tension, darkness: nullable(isD100), followUpId: optional(isText) })),
  'finished-doors': list(shape({ text: isText, sheet: list(paperChange) })),
  'place-description': shape({ room: nullable(isD100), corridor: nullable(between(1, 20)) }),
  'place-choice': oneOf(['shape', ...PLACE_TYPES]),
  'room-tile': nullable(shape({ roll: isD100, turns: between(0, 3), entrance: nullable(between(0, 8)),
    marks: recordOf(oneOf(['unexplored', 'checked', 'locked'])) })),
  'shape-roll': nullable(isD100),
  'entry-darkness': nullable(isD100),
  'encounter-roll': nullable(between(1, 20)),
  'event-roll': nullable(isD100),
  'paper-map-key': isText,
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
  'scavenge-check': nullable(shape({ skill: isText, roll: isD100, edge: oneOf(EDGE), modifiers: optional(isSkillModifierList) })),
  'door-map-exit': textWithLimit(53),
  'door-manual-exit': textWithLimit(48),
  'scavenge-quantity': list(nullable(isPositive)),
  'scavenge-selected': isPositive,
  'round-board-open': isBoolean,
  'round-position': shape({ round: isPositive, timing: roundTiming, actor: nullable(isText) }),
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
  'attack-confirmed-pc': nullable(shape({ id: isText, attacker: isText, defender: isText })),
  'attack-confirmed-enemy': nullable(shape({ id: isText, attacker: isText, defender: isText })),
  'attack-defense-mode-pc': oneOf(['opposed', 'unopposed', 'automatic']),
  'attack-defense-mode-enemy': oneOf(['opposed', 'unopposed', 'automatic']),
  'area-open': isBoolean,
  'area-targets': (value) => Array.isArray(value) && value.length <= 12 && value.every(textWithLimit(48)),
  'area-target-revision': isCount,
  'area-damage-mode': oneOf(['individual', 'shared']),
  'area-shared-damage': recordOf(rollResult),
  'roll': (value) => value === null || isPositive(value) || rollResult(value),
  'loot-reports': recordOf(lootReport),
  'gem-values': list(nullable(isPositive)),
  'follow-report': lootReport,
  'attack-inputs': recordOf(shape({ skill: optional(isText), rollv: optional(isText),
    edge: optional(oneOf(EDGE)), growthSkill: optional(isText), growthRecorded: optional(isBoolean), modifiers: optional(isSkillModifierList) })),
  'camp-plan': shape({ quantities: recordOf(isText), hasRation: isBoolean, sleep: isBoolean, bedroll: isBoolean,
    darkness: isBoolean, swapAmulets: isBoolean, other: isText, die: isText, lostToughness: isText, sanityDie: isText }),
  'magic-item': shape({ item: nullable(isPositive), base: nullable(isPositive), detail: nullable(isPositive),
    mastery: nullable(isPositive), attuned: oneOf(['', 'camp', 'reason', 'reason-roll']), rarity: nullable(isPositive),
    properties: list(nullable(shape({ value: isPositive, detail: nullable(isPositive) }))), peculiarity: isText }),
  'bandage': shape({ purpose: oneOf(['heal', 'bleeding', 'poisoned']), check: checkDraft,
    recovery: nullable(isPositive), damage: list(nullable(isPositive)) }),
  'lingering': list(oneOf(['bleeding', 'burning', 'poisoned'])),
  'rot': shape({ check: checkDraft }),
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
  'advancement-records': list(shape({ level: isPositive, summary: isText, changes: list(isText) })),
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
  const { id, name, place, stage, createdAt, data } = value;
  if (!isText(id) || !/^[a-z0-9_-]{1,80}$/i.test(id) || !isText(name) || !name.trim() || name.length > CHECKPOINT_NAME_MAX
    || !isText(place) || !place.trim() || !isText(stage) || !stage.trim() || !isFiniteNumber(createdAt)
    || !Number.isSafeInteger(createdAt) || createdAt < 0 || createdAt > 8.64e15
    || !validSlots(data.slots) || !isGearLedger(data.gear) || !validEncounters(data.encounters)) return null;
  const history = readPlayRollHistory(data.history);
  if (data.history !== undefined && (!Array.isArray(data.history) || history.length !== data.history.length
    || !history.every((entry) => entry.changes.every(({ slot, before, after }) =>
      [...before, ...after].every((item) => validSlot(slot, item)))))) return null;
  return {
    id, name, place, stage, createdAt,
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

export function capturePlayCheckpoint(name: string, place: string, stage: string, data: PlayCheckpointData) {
  const checkpoint: PlayCheckpoint = { id: crypto.randomUUID(), name, place, stage, createdAt: Date.now(), data };
  // Use the same decoder for a captured game and a file, keeping existing draft objects separate.
  return parsePlayCheckpoint(exportPlayCheckpoint(checkpoint));
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
