export type PlaySlots = Record<string, unknown>;
export type SlotValue = [unknown] | [];
export type RollChange = { slot: string; before: SlotValue; after: SlotValue };
export type PlayRollDetails = {
  label: string;
  dice: string;
  value: string;
  source: 'manual' | 'app';
  field?: string;
  breakdown?: string;
};
export type PlayRollEntry = PlayRollDetails & {
  id: string;
  scope: string;
  stage: 'explore' | 'combat' | 'wrapup' | 'journal';
  changes: RollChange[];
  cleared: string[];
  requires?: string[];
};

export const PLAY_HISTORY_LIMIT = 40;
const SHARED_LISTS = new Set(['pendingSkillGrowth', 'skillCriticalHistory']);
const STAGES = new Set(['explore', 'combat', 'wrapup', 'journal']);
const EXPLORE = 'explore/';
const EVENT = `${EXPLORE}event-roll`;
const ENCOUNTER = `${EXPLORE}encounter-roll`;
const TENSION = `${EXPLORE}entry-tension`;
const DARKNESS = `${EXPLORE}entry-darkness`;
const SHAPE = `${EXPLORE}shape-roll`;

export function playRollStage(value: unknown): PlayRollEntry['stage'] {
  return typeof value === 'string' && STAGES.has(value) ? value as PlayRollEntry['stage'] : 'explore';
}

export function safePlaySlot(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && key.length <= 600
    && !key.split('/').some((part) => part === '__proto__' || part === 'constructor' || part === 'prototype');
}

export function getSlot(slots: PlaySlots, key: string): SlotValue {
  return Object.hasOwn(slots, key) ? [slots[key]] : [];
}

export function sameSlot(a: SlotValue, b: SlotValue) {
  return a.length === b.length && (Object.is(a[0], b[0]) || JSON.stringify(a[0]) === JSON.stringify(b[0]));
}

function isRollEntry(value: unknown): value is PlayRollEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as PlayRollEntry;
  return typeof entry.id === 'string' && typeof entry.label === 'string' && typeof entry.scope === 'string'
    && typeof entry.dice === 'string' && typeof entry.value === 'string' && STAGES.has(entry.stage)
    && (entry.field === undefined || typeof entry.field === 'string')
    && (entry.breakdown === undefined || typeof entry.breakdown === 'string' && entry.breakdown.length <= 1800)
    && (entry.source === 'manual' || entry.source === 'app')
    && Array.isArray(entry.cleared) && entry.cleared.every((prefix) => safePlaySlot(prefix) && prefix.endsWith('/'))
    && (entry.requires === undefined || Array.isArray(entry.requires) && entry.requires.every(safePlaySlot))
    && Array.isArray(entry.changes) && entry.changes.every((change) => change && safePlaySlot(change.slot)
      && Array.isArray(change.before) && change.before.length <= 1
      && Array.isArray(change.after) && change.after.length <= 1);
}

export function readPlayRollHistory(value: unknown): PlayRollEntry[] {
  return Array.isArray(value) ? value.filter(isRollEntry).slice(-PLAY_HISTORY_LIMIT) : [];
}

export function appendPlayRoll(history: PlayRollEntry[], entry: PlayRollEntry) {
  // Another submission on the same field is a new roll. Earlier results remain visible.
  return [...history, entry].slice(-PLAY_HISTORY_LIMIT);
}

function auxiliary(slot: string) {
  return SHARED_LISTS.has(slot) || slot.split('/').at(-1)?.startsWith('oracle-history:');
}

function battleParents(id: string) {
  const [battle, source = battle] = id.replace(/%3A/gi, ':').split(':');
  const intro = battle.startsWith('intro-encounter-') ? [`${EXPLORE}intro-encounter-roll`] : [];
  if (source.startsWith('event-')) return [...intro, EVENT];
  const search = source.match(/^scavenge(?:-([23]))?$/);
  if (search) return [...intro, search[1] ? `${EXPLORE}scavenge-attempt-${search[1]}/scavenge-check` : `${EXPLORE}scavenge-check`];
  if (source.startsWith('action-darkness')) return [...intro, `${EXPLORE}action-tension`];
  if (source.startsWith('camp-')) return ['wrap/camp-plan'];
  if (source === 'breather') return ['wrap/breather-darkness-roll'];
  if (source === 'overseer') return [TENSION];
  if (battle === 'place' || intro.length) return [...intro, ENCOUNTER, DARKNESS];
  return [];
}

function parents({ scope, changes }: PlayRollEntry) {
  const slots = changes.map(({ slot }) => slot);
  if (scope.startsWith(EXPLORE)) {
    if (slots.includes(TENSION)) return [SHAPE];
    if (slots.includes(DARKNESS)) return [TENSION];
    if (slots.includes(ENCOUNTER)) return [SHAPE, TENSION, DARKNESS];
    if (slots.includes(EVENT)) return [ENCOUNTER];
    if (slots.includes(`${EXPLORE}place-description`)) return [SHAPE];
    if (scope.startsWith(`${EXPLORE}event-follow/`)) return [EVENT];
    if (scope.startsWith(`${EXPLORE}entry-darkness-follow/`)) return [DARKNESS];
    const search = scope.match(/^explore\/(?:scavenge-attempt-\d+\/)?/)?.[0] ?? EXPLORE;
    const checkSlot = `${search}scavenge-check`;
    const tableSlot = `${search}scavenge-table`;
    const searchParents = search === EXPLORE ? [] : [EVENT];
    if (slots.includes(checkSlot)) return searchParents;
    if (slots.includes(tableSlot)) return [...searchParents, checkSlot];
    if (scope.startsWith(`${search}scavenge-spoils-`) || slots.some((slot) => slot.startsWith(`${search}scavenge-`))) {
      return [...searchParents, checkSlot, tableSlot];
    }
    const timing = slots.includes(`${EXPLORE}action-tension`) ? [TENSION, DARKNESS] : [];
    const lock = scope.split('/').find((part) => part.startsWith('lock-'));
    if (lock) {
      const base = scope.slice(0, scope.indexOf(lock) + lock.length + 1);
      return [`${base}lock-detection`, `${base}lock-trap-roll`, `${base}lock-locked-roll`,
        `${base}lock-disarmed`, ...timing, ...(lock === 'lock-environment' ? [EVENT] : [])];
    }
    return timing;
  }
  if (scope.startsWith('combat/')) {
    const result = battleParents(scope.split('/')[1] ?? '');
    const target = scope.match(/^combat\/[^/]+\/target-[^/]+\//)?.[0];
    if (target) {
      if (scope.startsWith(`${target}action-follow-up-`)) result.push(`${target}creature-action`);
      const areaTarget = scope.slice(target.length).match(/^action-follow-up-\d+\/area-targets-\d+\/\d+\//)?.[0];
      if (areaTarget && /^(?:rolls|extra)-\d+\//.test(scope.slice(target.length + areaTarget.length))) {
        result.push(`${target}${areaTarget}resisted`);
      }
      if (slots.includes(`${target}creature-hit`)) result.push(`${target}attack-confirmed-pc`);
      if (slots.includes(`${target}creature-pc-hit`)) result.push(`${target}attack-confirmed-enemy`);
    }
    return result;
  }
  return [];
}

export function playRollRequirements(entry: PlayRollEntry, slots: PlaySlots) {
  const choice = slots[`${EXPLORE}place-choice`];
  const fromShape = choice !== 'room' && choice !== 'corridor';
  return parents(entry).filter((key) => fromShape || key !== SHAPE);
}

function restoreList(current: SlotValue, before: SlotValue, after: SlotValue): SlotValue | null {
  if (!Array.isArray(current[0]) || (before.length && !Array.isArray(before[0])) || !Array.isArray(after[0])) return null;
  const original: unknown[] = Array.isArray(before[0]) ? before[0] : [];
  const result: unknown[] = after[0];
  if (!result.every((value) => typeof value === 'string') || !original.every((value) => typeof value === 'string')) return null;
  // Roll commands append new journal lines and add unique growth marks.
  if (!original.every((item, i) => item === result[i])) return null;
  const next: unknown[] = [...current[0]];
  for (const item of result.slice(original.length).reverse()) {
    const index = next.lastIndexOf(item);
    if (index < 0) return null;
    next.splice(index, 1);
  }
  return [next];
}

export function planRollCorrection(slots: PlaySlots, history: PlayRollEntry[], id: string) {
  const index = history.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const origin = history[index];
  const affected: PlayRollEntry[] = [];
  const written = new Set<string>();
  const cleared = new Set<string>();
  const touches = (slot: string) => written.has(slot) || [...cleared].some((prefix) => slot.startsWith(prefix));
  for (const entry of history.slice(index)) {
    if (entry !== origin && !(
      entry.changes.some(({ slot }) => !auxiliary(slot) && touches(slot))
      || (entry.requires ?? parents(entry)).some(touches)
    )) continue;
    affected.push(entry);
    for (const { slot } of entry.changes) if (!auxiliary(slot)) written.add(slot);
    for (const prefix of entry.cleared) cleared.add(prefix);
  }

  const next = { ...slots };
  const conflicts = new Set<string>();
  const battles = slots.battles as Record<string, { outcome?: string; primaryId?: string }> | undefined;
  for (const [battleId, battle] of Object.entries(battles ?? {})) {
    if (battleId.startsWith('camp-') && !affected.some(({ field }) => field === 'wrap/camp-check')) continue;
    if ((battle.outcome || battle.primaryId) && battleParents(battleId).some(touches)) {
      conflicts.add(battle.outcome ? '종료한 전투 기록' : '진행 중인 조우');
    }
  }
  for (const entry of [...affected].reverse()) {
    const battleScope = entry.scope.match(/^combat\/([^/]+)\//)?.[1];
    if (battleScope) {
      const battleId = battleScope.replace(/%3A/gi, ':');
      const battle = battles?.[battleId];
      if (battle?.outcome) conflicts.add('종료한 전투 기록');
    }
    for (const { slot, before, after } of entry.changes) {
      const current = getSlot(next, slot);
      const restore = sameSlot(current, after) ? before
        : SHARED_LISTS.has(slot) ? restoreList(current, before, after) : null;
      if (restore) {
        if (restore.length) next[slot] = restore[0];
        else delete next[slot];
      } else if (!auxiliary(slot) || SHARED_LISTS.has(slot)) {
        conflicts.add(entry.label);
      }
    }
  }
  return { origin, affected, conflicts: [...conflicts], slots: next };
}
