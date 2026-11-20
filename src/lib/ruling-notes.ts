import { useSyncExternalStore } from 'react';
import { entryById, tableById, titleOf } from '../content';

const STORAGE_KEY = 'kn-ossuary-ruling-notes-v1';
export const RULING_NOTE_MAX = 600;

type RulingNotes = Readonly<Record<string, string>>;
const EMPTY: RulingNotes = {};
const hasReference = (id: string) => entryById.has(id) || tableById.has(id);
let current: RulingNotes | undefined;
let temporary = false;
const listeners = new Set<() => void>();

function read(): RulingNotes | null {
  let raw: string | null;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch { return null; }
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return EMPTY;
    return Object.fromEntries(Object.entries(value).filter(([id, note]) =>
      hasReference(id) && typeof note === 'string' && !!note.trim() && note.length <= RULING_NOTE_MAX));
  } catch { return EMPTY; }
}

const snapshot = () => current ??= read() ?? EMPTY;

function publish(next: RulingNotes) {
  current = next;
  for (const render of listeners) render();
}

function sync() {
  if (temporary) return;
  const latest = read();
  if (latest) publish(latest);
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) sync();
}

function subscribe(render: () => void) {
  listeners.add(render);
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    sync();
  }
  return () => {
    listeners.delete(render);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

export const useRulingNotes = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);

export function saveRulingNote(id: string, text: string, expected: string | undefined) {
  const value = text.trim();
  if (!hasReference(id) || value.length > RULING_NOTE_MAX) return 'invalid';
  const latest = temporary ? snapshot() : read() ?? snapshot();
  if (latest[id] !== expected) {
    publish(latest);
    return 'conflict';
  }
  const next = { ...latest };
  if (value) next[id] = value;
  else delete next[id];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    temporary = false;
  } catch { temporary = true; }
  publish(next);
  return temporary ? 'temporary' : 'saved';
}

export function searchRulingNotes(notes: RulingNotes, query: string) {
  const fold = (value: string) => value.normalize('NFC').toLowerCase();
  const words = fold(query.trim()).split(/\s+/).filter(Boolean);
  return Object.entries(notes).flatMap(([id, note]) => {
    const title = titleOf(id);
    const searchText = fold([title.ko, title.en, note].join(' '));
    return words.every((word) => searchText.includes(word)) ? [{ id, title: title.ko, note }] : [];
  }).sort((left, right) => left.title.localeCompare(right.title, 'ko'));
}
