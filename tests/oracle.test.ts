import { describe, expect, it } from 'vitest';
import { tableById } from '../src/content';
import { automaticRollSides, quickRollHref, readOracleValue } from '../src/lib/oracle';

const door = tableById.get('t-door')!;

describe('manual table values', () => {
  it('accepts physical percentile dice notation and valid bounded integers', () => {
    expect(readOracleValue('00', 100)).toBe(100);
    expect(readOracleValue('07', 100)).toBe(7);
    expect(readOracleValue('10', 10)).toBe(10);
  });

  it('rejects out-of-range, noninteger, and lookup-table values', () => {
    for (const value of ['0', '00', '11', '2.5', '1e1', '-5', '']) {
      expect(readOracleValue(value, 10)).toBeNull();
    }
    expect(readOracleValue('5', null)).toBeNull();
  });
});

describe('explicit quick rolls', () => {
  it('opens a verified table with a valid result in result view', () => {
    expect(automaticRollSides(door)).toBe(10);
    const url = new URL(quickRollHref(door)!, 'https://example.test');
    expect(url.pathname).toBe('/oracle/t-door');
    expect(url.searchParams.get('view')).toBe('one');
    expect(readOracleValue(url.searchParams.get('r'), 10)).not.toBeNull();
  });

  it('blocks roll actions when verification, range coverage, or row text is missing', () => {
    expect(quickRollHref({ ...door, verification: 'partial' })).toBeNull();
    expect(quickRollHref({ ...door, rows: door.rows.slice(0, 1) })).toBeNull();
    expect(quickRollHref({ ...door, id: 'missing-local-table', mode: 'local-only' })).toBeNull();
    expect(quickRollHref({ ...door, dice: '—' })).toBeNull();
  });
});
