import { expect, test } from 'vitest';
import { applyGearEffect, availableQuickUses, gearCount, undoGearEntry, useOneGearItem, type GearItem, type GearLedger } from '../src/lib/play-inventory';

test('quick gear debits once per confirmed transaction and links only the unpaid part of a paper use', () => {
  const light: GearItem = { id: 'light', name: '광원', count: 6, location: 'pack', weight: 'free' };
  const fresh: GearLedger = { items: [light], entries: [] };
  const result = useOneGearItem(fresh, light, 'room-1', 'use-1');
  if ('error' in result) throw Error(result.error);
  const used = result.ledger;
  expect(used.items[0].count).toBe(5);
  expect(useOneGearItem(used, light, 'room-1', 'use-1')).toHaveProperty('error');
  expect(useOneGearItem(used, used.items[0], 'room-1', 'use-1')).toHaveProperty('error');
  expect(availableQuickUses(used, 'room-2', light.id, 2)).toEqual([]);

  const ids = availableQuickUses(used, 'room-1', light.id, 2);
  const effect = gearCount('광원', -2);
  const linked = applyGearEffect(used, effect, '광원 −2', 'room-1/room-light', light.id, { roomId: 'room-1', ids });
  if ('error' in linked) throw Error(linked.error);
  expect(linked.ledger.items[0].count).toBe(4);
  expect(availableQuickUses(linked.ledger, 'room-1', light.id, 2)).toEqual([]);
  expect(applyGearEffect(linked.ledger, effect, '광원 −2', 'room-1/other-light', light.id, { roomId: 'room-1', ids })).toHaveProperty('error');
  expect(undoGearEntry(linked.ledger, used.entries[0].id)).toHaveProperty('error');
  expect(undoGearEntry(linked.ledger)).toEqual({ ledger: used });
});
