/**
 * Navigation-only local state: Pins, Recent, open Workbench panes, theme.
 * This is NOT game state — nothing about characters, maps or sessions is stored.
 * Every storage access is wrapped so the app works in private mode / blocked storage.
 */
import { useSyncExternalStore } from 'react';
import type { OracleViewState } from './oracle';
import type { BenchLayout } from './workbench-sets';

export interface NavState {
  pins: string[];
  recent: string[];
  open: string[];
  active: string | null;
  benchLayout: BenchLayout;
  benchTables: Readonly<Record<string, OracleViewState>>;
  theme: 'system' | 'light' | 'dark';
}

const KEY = 'kn-ossuary-nav-v1';
const THEME_KEY = 'kn-ossuary-theme';
const RECENT_MAX = 24;
export const OPEN_MAX = 8;
export const BENCH_FULL_MESSAGE = `작업대가 ${OPEN_MAX}칸 찼습니다. 펼친 항목을 하나 닫아 주세요.`;

const initialState: NavState = { pins: [], recent: [], open: [], active: null, benchLayout: 'columns', benchTables: {}, theme: 'system' };

function load(): NavState {
  const base: NavState = { ...initialState, pins: ['attack-check', 'prone', 't-defensive-move-pc', 'p-explore-room'] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') base.theme = t;
  } catch {
    /* storage unavailable */
  }
  return { ...base, benchLayout: base.benchLayout === 'tabs' ? 'tabs' : 'columns', benchTables: {} };
}

let state: NavState = typeof window === 'undefined' ? initialState : load();
const subs = new Set<() => void>();

function set(next: Partial<NavState>, persist = true) {
  state = { ...state, ...next };
  if (persist) try {
    const { theme, benchTables, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  subs.forEach((s) => s());
}

const readingsFor = (open: readonly string[]) => Object.fromEntries(
  Object.entries(state.benchTables).filter(([id]) => open.includes(id)),
);

export function useNav(): NavState {
  return useSyncExternalStore(
    (cb) => (subs.add(cb), () => subs.delete(cb)),
    () => state,
    () => state,
  );
}

export const nav = {
  get: () => state,
  togglePin(id: string) {
    set({ pins: state.pins.includes(id) ? state.pins.filter((p) => p !== id) : [id, ...state.pins] });
  },
  movePin(id: string, dir: -1 | 1) {
    const i = state.pins.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.pins.length) return;
    const pins = [...state.pins];
    [pins[i], pins[j]] = [pins[j], pins[i]];
    set({ pins });
  },
  visit(id: string) {
    set({ recent: [id, ...state.recent.filter((r) => r !== id)].slice(0, RECENT_MAX) });
  },
  /** returns what was cleared so the caller can offer an undo */
  clearRecent(): string[] {
    const prev = state.recent;
    set({ recent: [] });
    return prev;
  },
  restoreRecent(prev: string[]) {
    set({ recent: [...new Set([...state.recent, ...prev])].slice(0, RECENT_MAX) });
  },
  open(id: string, reading?: OracleViewState) {
    if (state.open.includes(id)) {
      set({ active: id });
      return true;
    }
    if (state.open.length >= OPEN_MAX) return false;
    set({ open: [...state.open, id], active: id,
      ...(reading ? { benchTables: { ...state.benchTables, [id]: reading } } : {}) });
    return true;
  },
  openPreset(ids: readonly string[]) {
    const additions = [...new Set(ids)].filter((id) => !state.open.includes(id));
    const missingSlots = Math.max(0, state.open.length + additions.length - OPEN_MAX);
    if (missingSlots > 0) return { added: 0, missingSlots };
    if (additions.length > 0) {
      set({ open: [...state.open, ...additions], active: state.active ?? additions[0] });
    }
    return { added: additions.length, missingSlots: 0 };
  },
  close(id: string) {
    const open = state.open.filter((o) => o !== id);
    const neighbor = open[Math.min(state.open.indexOf(id), open.length - 1)] ?? null;
    set({ open, active: state.active === id ? neighbor : state.active, benchTables: readingsFor(open) });
  },
  /** returns what was closed so the caller can offer an undo */
  closeAll(): Pick<NavState, 'open' | 'active' | 'benchTables'> {
    const prev = { open: state.open, active: state.active, benchTables: state.benchTables };
    set({ open: [], active: null, benchTables: {} });
    return prev;
  },
  restoreOpen(prev: Pick<NavState, 'open' | 'active' | 'benchTables'>) {
    const open = [...new Set([...state.open, ...prev.open])];
    if (open.length > OPEN_MAX) return false;
    set({ open, active: prev.active ?? state.active, benchTables: { ...prev.benchTables, ...state.benchTables } });
    return true;
  },
  replaceOpen(next: { open: readonly string[]; active: string | null; layout: BenchLayout }) {
    const open = [...new Set(next.open)].slice(0, OPEN_MAX);
    const active = next.active && open.includes(next.active) ? next.active : open.at(-1) ?? null;
    set({ open, active, benchTables: readingsFor(open), benchLayout: next.layout });
  },
  activate(id: string) {
    set({ active: id });
  },
  setBenchLayout(benchLayout: BenchLayout) {
    set({ benchLayout });
  },
  setBenchTable(id: string, change: OracleViewState) {
    set({ benchTables: { ...state.benchTables, [id]: { ...state.benchTables[id], ...change } } }, false);
  },
  setTheme(theme: NavState['theme']) {
    set({ theme });
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  },
};
