import { createContext, useCallback, useContext, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type Slots = Record<string, unknown>;
type Change = { slot: string; before: [unknown] | [] };
type Room = { slots: Slots; undo: Change[] };
const STORAGE_KEY = 'kn-play-room-v1';
const EMPTY_ROOM: Room = { slots: {}, undo: [] };

function readRoom(): Room {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const room = JSON.parse(raw) as Partial<Room> | null;
      if (room?.slots && typeof room.slots === 'object' && !Array.isArray(room.slots)) {
        const undo = Array.isArray(room.undo) ? room.undo.filter((change) =>
          typeof change?.slot === 'string' && Array.isArray(change.before) && change.before.length <= 1) : [];
        return { slots: room.slots, undo };
      }
    }
  } catch { /* storage unavailable */ }
  return EMPTY_ROOM;
}

interface DraftContext {
  slots: Slots;
  canUndo: boolean;
  generation: number;
  write<T>(generation: number, slot: string, update: SetStateAction<T>, initial: T): void;
  dropScope(generation: number, prefix: string): void;
  replaceRoom(slots: Slots): void;
  commitRoll(action: () => void): void;
  undoRoll(): void;
}

const Draft = createContext<DraftContext | null>(null);
const Scope = createContext('');
const directly = (action: () => void) => action();

function slotValue(slots: Slots, slot: string): [unknown] | [] {
  return Object.hasOwn(slots, slot) ? [slots[slot]] : [];
}

function sameValue(a: unknown[], b: unknown[]) {
  return a.length === b.length && (Object.is(a[0], b[0]) || JSON.stringify(a[0]) === JSON.stringify(b[0]));
}

export function PlayDraftProvider({ children }: { children: ReactNode }) {
  const [room, setRoom] = useState(readRoom);
  const current = useRef(room);
  const rolling = useRef(false);
  const generation = useRef(0);

  const publish = useCallback((next: Room) => {
    current.current = next;
    if (rolling.current) return;
    setRoom(next);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
    catch { /* the draft remains available in memory */ }
  }, []);

  const write = useCallback(<T,>(origin: number, slot: string, update: SetStateAction<T>, initial: T) => {
    if (origin !== generation.current) return;
    const { slots, undo } = current.current;
    const previous = Object.hasOwn(slots, slot) ? slots[slot] as T : initial;
    const value = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update;
    if (Object.is(previous, value)) return;
    const nextSlots = { ...slots, [slot]: value };
    publish({ slots: nextSlots, undo: rolling.current || !undo.some((change) => change.slot === slot) ? undo : [] });
  }, [publish]);

  const dropScope = useCallback((origin: number, prefix: string) => {
    if (origin !== generation.current) return;
    const { slots, undo } = current.current;
    const next = Object.fromEntries(Object.entries(slots).filter(([key]) => !key.startsWith(prefix)));
    publish({ slots: next, undo: rolling.current || !undo.some(({ slot }) => slot.startsWith(prefix)) ? undo : [] });
  }, [publish]);

  const replaceRoom = useCallback((slots: Slots) => {
    generation.current += 1;
    publish({ slots, undo: [] });
  }, [publish]);

  const commitRoll = useCallback((action: () => void) => {
    if (rolling.current) return action();
    const previous = current.current;
    rolling.current = true;
    try { action(); }
    finally {
      rolling.current = false;
      const after = current.current.slots;
      if (after !== previous.slots) {
        const keys = new Set([...Object.keys(previous.slots), ...Object.keys(after)]);
        const changes = Array.from(keys).flatMap((slot) => {
          const before = slotValue(previous.slots, slot);
          return sameValue(before, slotValue(after, slot)) ? [] : [{ slot, before }];
        });
        publish({ slots: after, undo: changes.length ? changes : previous.undo });
      }
    }
  }, [publish]);

  const undoRoll = useCallback(() => {
    const { slots, undo } = current.current;
    if (!undo.length) return;
    const next = { ...slots };
    for (const { slot, before } of undo) {
      if (before.length) next[slot] = before[0];
      else delete next[slot];
    }
    publish({ slots: next, undo: [] });
  }, [publish]);

  return <Draft.Provider value={{ slots: room.slots, canUndo: !!room.undo.length, generation: generation.current,
    write, dropScope, replaceRoom, commitRoll, undoRoll }}>{children}</Draft.Provider>;
}

export function PlayDraftScope({ name, children }: { name: string; children: ReactNode }) {
  const parent = useContext(Scope);
  return <Scope.Provider value={`${parent}${encodeURIComponent(name)}/`}>{children}</Scope.Provider>;
}

export function usePlayDraft() {
  return useContext(Draft);
}

export function usePlayDraftState<T>(slot: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const scope = useContext(Scope);
  const draft = useContext(Draft);
  const write = draft?.write;
  const generation = draft?.generation ?? 0;
  const [defaultValue] = useState(() => initial);
  const [local, setLocal] = useState(() => initial);
  const key = `${scope}${slot}`;
  const value = draft ? (Object.hasOwn(draft.slots, key) ? draft.slots[key] as T : defaultValue) : local;
  const setValue = useCallback((update: SetStateAction<T>) => {
    if (write) write(generation, key, update, defaultValue);
    else setLocal(update);
  }, [write, generation, key, defaultValue]);
  return [value, setValue];
}

export function usePlayRoll() {
  return useContext(Draft)?.commitRoll ?? directly;
}

export function useClearPlayDraftScope() {
  const draft = useContext(Draft);
  const drop = draft?.dropScope;
  const generation = draft?.generation ?? 0;
  const parent = useContext(Scope);
  return useCallback((name: string) => drop?.(generation, `${parent}${encodeURIComponent(name)}/`), [drop, generation, parent]);
}
