import type { OracleTable } from '../content/schema';
import type { EncounterPlace } from '../content/tables/exploration';
import { rollD100, rollDie, tableSides } from './dice';
import { tableRowSource } from './overlay';

export function oracleRowsAvailable(t: OracleTable): boolean {
  return t.rows.length > 0 && t.rows.every((row) =>
    t.mode === 'local-only' ? !!tableRowSource(t.id, row.min)?.trim() : !!row.ko.trim(),
  );
}

export function automaticRollSides(t: OracleTable): number | null {
  const sides = tableSides(t.dice);
  if (sides === null || sides < 2 || t.verification !== 'verified' || !oracleRowsAvailable(t)) return null;
  let expected = 1;
  for (const row of [...t.rows].sort((a, b) => a.min - b.min)) {
    if (row.min !== expected || !Number.isInteger(row.max) || row.max < row.min) return null;
    expected = row.max + 1;
  }
  return expected === sides + 1 ? sides : null;
}

export function readOracleValue(raw: string | null, sides: number | null): number | null {
  if (sides === null || raw === null || !/^\d+$/.test(raw)) return null;
  if (sides === 100 && raw === '00') return 100;
  const value = Number(raw);
  return value >= 1 && value <= sides ? value : null;
}

export function rollTable(t: OracleTable): number | null {
  const sides = automaticRollSides(t);
  if (sides === null) return null;
  return sides === 100 ? rollD100().value : rollDie(sides);
}

export interface OracleViewState {
  result?: number;
  only?: boolean;
  encounterPlace?: EncounterPlace | null;
}

export function oraclePageHref(id: string, { result, only, encounterPlace }: OracleViewState = {}): string {
  const params = new URLSearchParams();
  if (result !== undefined) params.set('r', String(result));
  if (only) params.set('view', 'one');
  if (id === 't-encounter-check' && encounterPlace) params.set('place', encounterPlace);
  return `/oracle/${id}${params.size ? `?${params}` : ''}`;
}

export function quickRollHref(t: OracleTable): string | null {
  const value = rollTable(t);
  return value === null ? null : oraclePageHref(t.id, { result: value, only: true });
}

/** A row's short name for summaries and the journal: its label, or the first sentence of its text. */
export function rowTitle(row: { label?: string; ko: string }) {
  if (row.label) return row.label;
  return (row.ko.split(/(?<=[.!?])\s/)[0] ?? row.ko).replace(/\.$/, '');
}

/** The rest of a row's text after the sentence `rowTitle` used. */
export function rowDetail(row: { label?: string; ko: string }) {
  if (row.label) return row.ko;
  const [, ...rest] = row.ko.split(/(?<=[.!?])\s/);
  return rest.join(' ');
}
