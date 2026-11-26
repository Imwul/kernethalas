import { creatureById } from '../content/entries/creatures';
import { campaignStorageKey } from './play-campaigns';

export interface PlayCustomEncounterRow {
  min: number;
  max: number;
  creatureId: string;
}

export interface EncounterSet {
  id: string;
  name: string;
  rows: PlayCustomEncounterRow[];
}

const FORMAT = 'kernethalas-encounter-tables';
export const PLAY_ENCOUNTER_STORAGE_KEY = 'kn-play-custom-encounters-v2';
const LEGACY_KEY = 'kn-play-custom-encounters-v1';
const DEFAULT_NAME = '사용자 지정 조우표';
export const MAX_SET_NAME = 80;

export function intersects(first: PlayCustomEncounterRow, second: PlayCustomEncounterRow) {
  return first.min <= second.max && second.min <= first.max;
}

export function readPlayCustomEncounterRows(value: unknown): PlayCustomEncounterRow[] {
  if (!Array.isArray(value)) return [];
  const rows: PlayCustomEncounterRow[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object' || !Number.isInteger(row.min) || !Number.isInteger(row.max)
      || row.min < 1 || row.max > 20 || row.min > row.max || !creatureById.has(row.creatureId)
      || rows.some((existing) => intersects(existing, row))) continue;
    rows.push({ min: row.min, max: row.max, creatureId: row.creatureId });
  }
  return rows.sort((first, second) => first.min - second.min);
}

export function readEncounterLibrary(campaignId?: string): EncounterSet[] {
  try {
    const saved = localStorage.getItem(campaignStorageKey(PLAY_ENCOUNTER_STORAGE_KEY, campaignId));
    if (saved) {
      const sets = JSON.parse(saved);
      if (Array.isArray(sets)) {
        const seen = new Set<string>();
        const clean = sets.flatMap((set) => {
          if (typeof set?.id !== 'string' || seen.has(set.id) || typeof set.name !== 'string' || !set.name.trim()) return [];
          seen.add(set.id);
          return [{ id: set.id, name: set.name.trim().slice(0, MAX_SET_NAME), rows: readPlayCustomEncounterRows(set.rows) }];
        });
        if (clean.length) return clean;
      }
    }
    const legacy = localStorage.getItem(campaignStorageKey(LEGACY_KEY, campaignId));
    if (legacy) return [{ id: 'default', name: DEFAULT_NAME, rows: readPlayCustomEncounterRows(JSON.parse(legacy)) }];
  } catch { /* storage unavailable */ }
  return [{ id: 'default', name: DEFAULT_NAME, rows: [] }];
}

export function storeEncounterLibrary(sets: EncounterSet[], campaignId?: string) {
  try { localStorage.setItem(campaignStorageKey(PLAY_ENCOUNTER_STORAGE_KEY, campaignId), JSON.stringify(sets)); }
  catch { /* the library stays available in this tab */ }
}

export function exportEncounterLibrary(sets: EncounterSet[]) {
  return JSON.stringify({ format: FORMAT, version: 1, sets: sets.map(({ name, rows }) => ({ name, rows })) }, null, 2);
}

export function parseEncounterExport(raw: string): Omit<EncounterSet, 'id'>[] | null {
  try {
    const value = JSON.parse(raw);
    if (value?.format !== FORMAT || value.version !== 1 || !Array.isArray(value.sets) || value.sets.length === 0) return null;
    const sets: Omit<EncounterSet, 'id'>[] = [];
    for (const set of value.sets) {
      const name = typeof set?.name === 'string' ? set.name.trim() : '';
      if (!name || name.length > MAX_SET_NAME || !Array.isArray(set.rows)) return null;
      const rows = readPlayCustomEncounterRows(set.rows);
      if (rows.length !== set.rows.length) return null;
      sets.push({ name, rows });
    }
    return sets;
  } catch { return null; }
}
