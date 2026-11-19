/**
 * Navigation-only local state: Pins, Recent, open Workbench panes, theme.
 * This is NOT game state — nothing about characters, maps or sessions is stored.
 * Every storage access is wrapped so the app works in private mode / blocked storage.
 */
import { useSyncExternalStore } from 'react';

export interface NavState {
  pins: string[];
  recent: string[];
  open: string[];
  active: string | null;
  theme: 'system' | 'light' | 'dark';
}

const KEY = 'kn-ossuary-nav-v1';
const THEME_KEY = 'kn-ossuary-theme';
const RECENT_MAX = 24;
export const OPEN_MAX = 8;

function load(): NavState {
  const base: NavState = { pins: ['attack-check', 'prone', 't-defensive-move-pc', 'p-explore-room'], recent: [], open: [], active: null, theme: 'system' };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(base, JSON.parse(raw));
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') base.theme = t;
  } catch {
    /* storage unavailable */
  }
  return base;
}

let state: NavState = typeof window === 'undefined' ? { pins: [], recent: [], open: [], active: null, theme: 'system' } : load();
const subs = new Set<() => void>();

function set(next: Partial<NavState>) {
  state = { ...state, ...next };
  try {
    const { theme, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
    if (theme === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
  subs.forEach((s) => s());
}

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
  open(id: string) {
    const open = state.open.includes(id) ? state.open : [...state.open, id].slice(-OPEN_MAX);
    set({ open, active: id });
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
    set({ open, active: state.active === id ? (open[open.length - 1] ?? null) : state.active });
  },
  /** returns what was closed so the caller can offer an undo */
  closeAll(): { open: string[]; active: string | null } {
    const prev = { open: state.open, active: state.active };
    set({ open: [], active: null });
    return prev;
  },
  restoreOpen(prev: { open: string[]; active: string | null }) {
    set({ open: [...new Set([...state.open, ...prev.open])].slice(-OPEN_MAX), active: prev.active });
  },
  replaceOpen(next: { open: readonly string[]; active: string | null }) {
    const open = [...new Set(next.open)].slice(0, OPEN_MAX);
    const active = next.active && open.includes(next.active) ? next.active : open.at(-1) ?? null;
    set({ open, active });
  },
  activate(id: string) {
    set({ active: id });
  },
  setTheme(theme: NavState['theme']) {
    set({ theme });
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  },
};
