import { kindOf } from '../content';
import { OPEN_MAX } from './store';

export type BenchLayout = 'columns' | 'tabs';

export interface BenchSet {
  id: string;
  name: string;
  open: string[];
  active: string | null;
  layout: BenchLayout;
}

export const BENCH_SET_NAME_MAX = 80;
const KEY = 'kn-ossuary-workbench-sets-v1';

export const benchSetName = (name: string) => name.normalize('NFC').trim();

export function readBenchSets(): BenchSet[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const items: unknown = JSON.parse(raw);
    if (!Array.isArray(items)) return [];
    const seen = new Set<string>();
    return items.flatMap((value: unknown) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as Partial<BenchSet>;
      if (typeof item.id !== 'string' || seen.has(item.id) || typeof item.name !== 'string'
        || !Array.isArray(item.open) || (item.layout !== 'columns' && item.layout !== 'tabs')) return [];
      const name = benchSetName(item.name);
      const open = [...new Set(item.open.filter((id: unknown): id is string =>
        typeof id === 'string' && kindOf(id) !== null))].slice(0, OPEN_MAX);
      if (!name || name.length > BENCH_SET_NAME_MAX || !open.length) return [];
      seen.add(item.id);
      const active = typeof item.active === 'string' && open.includes(item.active) ? item.active : open.at(-1) ?? null;
      return [{ id: item.id, name, open, active, layout: item.layout }];
    });
  } catch { return null; }
}

export function storeBenchSets(sets: BenchSet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(sets));
    return true;
  } catch {
    return false;
  }
}
