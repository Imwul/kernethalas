import { describe, expect, test } from 'vitest';
import { CHECKPOINT_MAX_BYTES, exportPlayCheckpoint, parsePlayCheckpoint, type PlayCheckpoint } from '../src/lib/play-checkpoints';
import { newDomainProgress } from '../src/lib/domain-progress';
import { newPlayDomain } from '../src/lib/play-domain';

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

  test('rejects foreign versions, oversized files and prototype keys in slot names or data', () => {
    const raw = exportPlayCheckpoint(checkpoint());
    expect(parsePlayCheckpoint(raw.replace('"version": 1', '"version": 2'))).toBeNull();
    expect(parsePlayCheckpoint(' '.repeat(CHECKPOINT_MAX_BYTES) + raw)).toBeNull();
    expect(parsePlayCheckpoint(raw.replace('"explore/shape-roll": 29', '"explore/__proto__/value": 29'))).toBeNull();
    expect(parsePlayCheckpoint(raw.replace('"explore/shape-roll": 29', '"explore/scratch": {"__proto__": {"x": 29}}'))).toBeNull();
  });
});
