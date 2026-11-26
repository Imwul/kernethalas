import { describe, expect, test } from 'vitest';
import { CHECKPOINT_MAX_BYTES, exportPlayCheckpoint, parsePlayCheckpoint, type PlayCheckpoint } from '../src/lib/play-checkpoints';
import { newDomainProgress } from '../src/lib/domain-progress';
import { newPlayDomain } from '../src/lib/play-domain';
import { EMPTY_DOOR_INVESTIGATION } from '../src/lib/lock-trap';
import { archiveMapClueSources, clueRollProvenance, mapClueSourceChanged } from '../src/lib/paper-map-clues';
import type { PaperMapLocation } from '../src/lib/paper-map';

function checkpoint(): PlayCheckpoint {
  return {
    id: 'check-1', name: '묘실 입구', place: 'B-07', stage: '탐험', createdAt: 1763600000000,
    data: {
      slots: {
        active: 'explore', domains: [{ ...newPlayDomain(1), progress: newDomainProgress() }],
        initialTension: 6, domainId: 1, roomNumber: 7, pendingSkillGrowth: ['Perception'],
        paperMap: [{ domainId: 1, paperId: 'B-07', area: 'room', note: '북쪽 문', tags: ['잠긴 문'] }],
        'explore/shape-roll': 29,
        'combat/place/round-position': { round: 2, timing: 'round', actor: null },
        'combat/place/round-reminders': [{ id: 'reminder-1', actor: 'pc', timing: 'round', note: '2', effect: 'bleeding' }],
      },
      gear: { items: [{ id: 'lamp', name: '광원', count: 3, location: 'pack', weight: 'free' }], entries: [] },
      encounters: [{ id: 'table-1', name: '지하실', rows: [{ min: 1, max: 4, creatureId: 'cr-necropede' }] }],
      history: [{
        id: 'roll-1', scope: 'explore/', stage: 'explore', label: '방·통로 모양', dice: 'D100', value: '29', source: 'manual',
        changes: [{ slot: 'explore/shape-roll', before: [], after: [29] }], cleared: [],
      }],
    },
  };
}

describe('play checkpoint files', () => {
  test('round-trips the current roll, map index, growth marks, gear and encounter IDs', () => {
    const saved = checkpoint();
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
  });

  test('retains linked map clues with older locations and rejects malformed or unresolved links', () => {
    const saved = checkpoint();
    const clue = { id: 'clue-1', text: '두 방에 같은 문장이 새겨져 있다.', source: 'description', status: 'hypothesis', relatedPaperId: 'C-02' };
    const first = { domainId: 1, paperId: 'B-07', area: 'room', note: '', tags: [], clues: [clue] };
    const second = { domainId: 1, paperId: 'C-02', area: 'corridor', note: '석관 옆', tags: [] };
    saved.data.slots.paperMap = [first, second];
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);

    for (const invalid of [
      [{ ...clue, relatedPaperId: 'b-07' }],
      [{ ...clue, relatedPaperId: 'C-03' }],
      [{ ...clue, status: 'unknown' }],
      [{ ...clue, text: '단'.repeat(401) }],
      [clue, clue],
    ]) {
      saved.data.slots.paperMap = [{ ...first, clues: invalid }, second];
      expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
    }
  });

  test('retains exact clue provenance and freezes changed sources when leaving a visit', () => {
    const saved = checkpoint();
    Object.assign(saved.data.slots, { roomLedgerId: 'visit-one', 'explore/event-roll': 55, 'explore/map-clue-event': 'original' });
    const { slots } = saved.data;
    const clue = { id: 'clue-1', text: '이벤트 메모', source: 'event', status: 'confirmed', provenance: clueRollProvenance(slots, 'event') } as const;
    const places: PaperMapLocation[] = [{ domainId: 1, paperId: 'B-07', area: 'room', note: '', tags: [], clues: [clue] }];
    slots.paperMap = places;
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
    expect(mapClueSourceChanged(clue, slots)).toBe(false);

    slots['explore/map-clue-event'] = 'same-value-replacement';
    expect(mapClueSourceChanged(clue, slots)).toBe(true);
    const archived = archiveMapClueSources(places, slots);
    const recorded = archived[0].clues?.[0];
    expect(recorded?.text).toBe(clue.text);
    expect(recorded?.provenance?.changed).toBe(true);
    const detached = { roomLedgerId: 'visit-two', 'explore/event-roll': 55, 'explore/map-clue-event': 'original' };
    expect(recorded && mapClueSourceChanged(recorded, detached)).toBe(true);
    expect(mapClueSourceChanged(clue, detached)).toBe(false);

    slots.paperMap = archived;
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
    slots['explore/map-clue-event'] = { malformed: true };
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
  });

  test('round-trips paper records and a bounded summon roll', () => {
    const saved = checkpoint();
    const summonSlot = 'combat/place/target-a/action-1/summons';
    saved.data.slots[summonSlot] = { expr: 'D4', dice: [2], mod: 0, total: 2 };
    saved.data.slots.paperApplied = [{ id: 'scavenge-item', text: 'Crafting Supplies +1' }, 'legacy:광원 −1'];
    saved.data.slots.playTimeline = [{ id: 'room-6', domainId: 1, roomNumber: 6, title: 'C-06',
      facts: [{ label: '장소', value: '통로' }], journalCopied: false, sheet: [] }];
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
    saved.data.slots[summonSlot] = { expr: 'D4', dice: [2], mod: 0, total: 1000000 };
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
  });

  test('retains room organizers, skill references and ongoing effects in campaign checkpoints', () => {
    const saved = checkpoint();
    Object.assign(saved.data.slots, {
      ongoingEffects: { conditions: ['bleeding'], abilities: [{ id: 'manual:amulet', name: 'Amulet', used: 'camp', reserved: 4 }] },
      skillPresets: { Scavenge: 55, Perception: 61 },
      pendingRolls: [{ id: 'pending-1', roomId: 'room-7', place: 'B-07', stage: 'wrapup', field: 'wrap/journal:Toughness',
        label: 'Toughness', dice: 'D4', target: 'PC', wrapBattleId: 'place' }],
      paperMap: [{ domainId: 1, paperId: 'B-07', area: 'room', note: '', tags: [],
        doors: [{ exit: '2번 출입구', text: '함정 없음 · 문 개방', opened: true }] }],
      'combat/place/target-one/attack-defense-mode-pc': 'unopposed',
      'combat/place/target-one/attack-inputs': { 'pc-attack': { skill: '61', modifiers: [{ reason: '상태·어둠', amount: '−10' }] } },
    });
    saved.data.history![0].breakdown = '기본 55 · 상태·어둠 −10 = 45';
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
    saved.data.slots.ongoingEffects = { conditions: ['bleeding', 'bleeding'], abilities: [] };
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
  });

  test('rejects invalid metadata, gear, dice and historical changes', () => {
    const saved = checkpoint();
    const visit = (update: (value: PlayCheckpoint) => void) => {
      const value = structuredClone(saved);
      update(value);
      return parsePlayCheckpoint(exportPlayCheckpoint(value));
    };
    expect(visit((value) => { value.createdAt = Infinity; })).toBeNull();
    expect(visit((value) => { value.data.gear.items[0].count = -1; })).toBeNull();
    expect(visit((value) => { value.data.slots['explore/shape-roll'] = '29'; })).toBeNull();
    expect(visit((value) => { value.data.history![0].changes[0].before = ['not a roll']; })).toBeNull();
    expect(visit((value) => { value.data.encounters[0].rows.push({ min: 3, max: 5, creatureId: 'cr-necropede' }); })).toBeNull();
    expect(visit((value) => {
      value.data.slots.paperMap = ['B-07', 'b-07'].map((paperId) => ({ domainId: 1, paperId, area: 'room', note: '', tags: [] }));
    })).toBeNull();
    expect(visit((value) => { value.data.slots['combat/place/round-reminders'] = false; })).toBeNull();
  });

  test('round-trips resumable door investigations alongside older map notes', () => {
    const saved = checkpoint();
    const deferred = { ...EMPTY_DOOR_INVESTIGATION, detection: 'success', trapRoll: 6, lockRoll: 16, pickFailures: 1, forceFailures: 2 };
    const door = { exit: '북쪽 철문', text: '함정 없음 · 문 잠김', opened: false, deferred };
    saved.data.slots.paperMap = [{ domainId: 1, paperId: 'B-07', area: 'room', note: '', tags: [],
      doors: [{ exit: '남쪽 문', text: '문 개방', opened: true }, door] }];
    saved.data.slots['explore/paper-map-resume-exit'] = door.exit;
    saved.data.slots['explore/resumed-door'] = door;
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);

    saved.data.slots['explore/resumed-door'] = { ...door, deferred: { ...deferred, trapRoll: 11 } };
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
  });

  test('retains mapped retreat origins alongside legacy retreats without origins', () => {
    const saved = checkpoint();
    saved.data.slots.domains = [{ ...newPlayDomain(1), retreats: [
      { id: 'legacy', place: '예전 방', creatureIds: ['cr-necropede'], kind: 'encounter' },
      { id: 'mapped', place: 'B-07', creatureIds: ['cr-necropede'], kind: 'encounter', origin: { paperId: 'B-07', area: 'corridor' } },
    ] }];
    saved.data.slots.retreatReturnId = 'mapped';
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toEqual(saved);
    saved.data.slots.retreatReturnId = 1;
    expect(parsePlayCheckpoint(exportPlayCheckpoint(saved))).toBeNull();
  });

  test('rejects foreign versions, oversized files and prototype keys in slot names or data', () => {
    const raw = exportPlayCheckpoint(checkpoint());
    expect(parsePlayCheckpoint(raw.replace('"version": 1', '"version": 2'))).toBeNull();
    expect(parsePlayCheckpoint(' '.repeat(CHECKPOINT_MAX_BYTES) + raw)).toBeNull();
    expect(parsePlayCheckpoint(raw.replace('"explore/shape-roll": 29', '"explore/__proto__/value": 29'))).toBeNull();
    expect(parsePlayCheckpoint(raw.replace('"explore/shape-roll": 29', '"explore/scratch": {"__proto__": {"x": 29}}'))).toBeNull();
  });
});
