import { describe, expect, it } from 'vitest';
import { backupAgeLabel, backupIsStale, describeSiteBackup, parseSiteBackup } from '../src/lib/site-backup';

const DAY = 24 * 60 * 60 * 1000;
const file = (data: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ format: 'kernethalas-ossuary-backup', version: 1, exportedAt: 1_700_000_000_000, data, ...extra });

describe('site backup', () => {
  it('accepts only this site keys with string values', () => {
    expect(parseSiteBackup(file({ 'kn-play-room-v1': '{}', 'kn-play-room-v1:camp-2': '{}' }))?.data)
      .toEqual({ 'kn-play-room-v1': '{}', 'kn-play-room-v1:camp-2': '{}' });
    expect(parseSiteBackup(file({ 'other-app': 'x' }))).toBeNull();
    expect(parseSiteBackup(file({ 'kn-play-room-v1': { nested: true } }))).toBeNull();
    expect(parseSiteBackup(file({}, { format: 'something-else' }))).toBeNull();
    expect(parseSiteBackup('not json')).toBeNull();
  });

  it('counts campaigns and checkpoints across campaigns', () => {
    const counts = describeSiteBackup({
      'kn-play-campaigns-v1': JSON.stringify({ campaigns: [{ id: 'default' }, { id: 'b' }], last: 'b' }),
      'kn-play-checkpoints-v1': JSON.stringify([{}, {}]),
      'kn-play-checkpoints-v1:b': JSON.stringify([{}]),
    });
    expect(counts).toMatchObject({ campaigns: 2, checkpoints: 3 });
  });

  it('marks a backup stale after a week', () => {
    const now = 10 * DAY;
    expect(backupIsStale(null, now)).toBe(true);
    expect(backupIsStale(now - 3 * DAY, now)).toBe(false);
    expect(backupIsStale(now - 8 * DAY, now)).toBe(true);
    expect(backupAgeLabel(now - 3 * DAY, now)).toBe('3일 전 전체 백업');
    expect(backupAgeLabel(now, now)).toBe('오늘 전체 백업');
  });
});
