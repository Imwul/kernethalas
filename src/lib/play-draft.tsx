import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { campaignStorageKey, PLAY_ROOM_STORAGE_KEY, usePlayCampaignId } from './play-campaigns';
import {
  appendPlayRoll, getSlot, planRollCorrection, playRollRequirements, playRollStage, readPlayRollHistory, safePlaySlot, sameSlot,
  type PlayRollDetails, type PlayRollEntry, type PlaySlots, type SlotValue,
} from './play-roll-history';

type Change = { slot: string; before: SlotValue };
type Room = { slots: PlaySlots; undo: Change[]; undoRollId?: string; history: PlayRollEntry[] };
const EMPTY_ROOM: Room = { slots: {}, undo: [], history: [] };

function readRoom(raw: string | null): Room | null {
  try {
    if (raw) {
      const room = JSON.parse(raw) as Partial<Room> | null;
      if (room?.slots && typeof room.slots === 'object' && !Array.isArray(room.slots)) {
        const undo = Array.isArray(room.undo) ? room.undo.filter((change) =>
          safePlaySlot(change?.slot) && Array.isArray(change.before) && change.before.length <= 1) : [];
        const history = readPlayRollHistory(room.history);
        return { slots: room.slots, undo, history, undoRollId: history.some(({ id }) => id === room.undoRollId) ? room.undoRollId : undefined };
      }
    }
  } catch { /* storage unavailable */ }
  return null;
}

function browserValue(storage: 'localStorage' | 'sessionStorage', key: string) {
  try { return window[storage].getItem(key); }
  catch { return null; }
}

interface DraftContext {
  slots: PlaySlots;
  history: PlayRollEntry[];
  canUndo: boolean;
  generation: number;
  write<T>(generation: number, slot: string, update: SetStateAction<T>, initial: T): void;
  dropScope(generation: number, prefix: string): void;
  replaceRoom(slots: PlaySlots, history?: unknown): void;
  commitRoll(action: () => void, details?: PlayRollDetails, scope?: string): void;
  undoRoll(): void;
  rewindRoll(id: string): boolean;
}

const Draft = createContext<DraftContext | null>(null);
const Scope = createContext('');
const directly = (action: () => void) => action();

export function PlayDraftProvider({ children }: { children: ReactNode }) {
  const storageKey = campaignStorageKey(PLAY_ROOM_STORAGE_KEY, usePlayCampaignId());
  const pendingKey = `${storageKey}:tab-copy`;
  const [initial] = useState(() => {
    const saved = browserValue('localStorage', storageKey);
    const tab = browserValue('sessionStorage', storageKey);
    const tabStatus = browserValue('sessionStorage', pendingKey);
    const status: 'conflict' | 'temporary' | null = tabStatus === 'conflict' || tabStatus === 'temporary' ? tabStatus : null;
    return {
      saved,
      status,
      room: (status && readRoom(tab)) || readRoom(saved) || readRoom(tab) || EMPTY_ROOM,
    };
  });
  const [room, setRoom] = useState(initial.room);
  const [persistence, setPersistence] = useState<'conflict' | 'temporary' | null>(initial.status);
  const [reopen, setReopen] = useState(false);
  const persisted = useRef(initial.saved);
  const conflict = useRef(initial.status === 'conflict');
  const current = useRef(room);
  const rolling = useRef(false);
  const clearedScopes = useRef<string[]>([]);
  const generation = useRef(0);

  const save = useCallback((next: Room) => {
    const raw = JSON.stringify(next);
    let status: 'conflict' | 'temporary' | null = null;
    try {
      const latest = localStorage.getItem(storageKey);
      if (conflict.current || latest !== persisted.current && latest !== raw) {
        conflict.current = true;
        status = 'conflict';
      } else {
        if (latest !== raw) localStorage.setItem(storageKey, raw);
        persisted.current = raw;
      }
    } catch { status = 'temporary'; }
    try {
      sessionStorage.setItem(storageKey, raw);
      if (status) sessionStorage.setItem(pendingKey, status);
      else sessionStorage.removeItem(pendingKey);
    } catch { /* the draft remains available in memory */ }
    setPersistence(status);
  }, [storageKey, pendingKey]);

  useEffect(() => {
    const checkLatest = () => {
      try {
        if (localStorage.getItem(storageKey) === persisted.current) return;
        conflict.current = true;
        setPersistence('conflict');
      } catch { /* the next save handles storage failures */ }
    };
    const receive = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === storageKey || event.key === null)) checkLatest();
    };
    const onVisibility = () => { if (document.visibilityState === 'visible') checkLatest(); };
    window.addEventListener('storage', receive);
    window.addEventListener('focus', checkLatest);
    document.addEventListener('visibilitychange', onVisibility);
    checkLatest();
    return () => {
      window.removeEventListener('storage', receive);
      window.removeEventListener('focus', checkLatest);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [storageKey]);

  const publish = useCallback((next: Room) => {
    current.current = next;
    if (rolling.current) return;
    setRoom(next);
    save(next);
  }, [save]);

  const write = useCallback(<T,>(origin: number, slot: string, update: SetStateAction<T>, initial: T) => {
    if (origin !== generation.current) return;
    const room = current.current;
    const { slots, undo } = room;
    const previous = Object.hasOwn(slots, slot) ? slots[slot] as T : initial;
    const value = typeof update === 'function' ? (update as (previous: T) => T)(previous) : update;
    if (Object.is(previous, value)) return;
    const nextSlots = { ...slots, [slot]: value };
    const invalidated = !rolling.current && undo.some((change) => change.slot === slot);
    publish({ ...room, slots: nextSlots, undo: invalidated ? [] : undo, undoRollId: invalidated ? undefined : room.undoRollId });
  }, [publish]);

  const dropScope = useCallback((origin: number, prefix: string) => {
    if (origin !== generation.current) return;
    const room = current.current;
    const { slots, undo } = room;
    if (rolling.current) clearedScopes.current.push(prefix);
    const next = Object.fromEntries(Object.entries(slots).filter(([key]) => !key.startsWith(prefix)));
    const invalidated = !rolling.current && undo.some(({ slot }) => slot.startsWith(prefix));
    publish({ ...room, slots: next, undo: invalidated ? [] : undo, undoRollId: invalidated ? undefined : room.undoRollId });
  }, [publish]);

  const replaceRoom = useCallback((slots: PlaySlots, history?: unknown) => {
    generation.current += 1;
    publish({ slots, undo: [], history: readPlayRollHistory(history) });
  }, [publish]);

  const commitRoll = useCallback((action: () => void, details?: PlayRollDetails, scope = '') => {
    if (rolling.current) return action();
    const previous = current.current;
    rolling.current = true;
    clearedScopes.current = [];
    try { action(); }
    finally {
      rolling.current = false;
      const after = current.current.slots;
      if (after !== previous.slots || details) {
        const keys = new Set([...Object.keys(previous.slots), ...Object.keys(after)]);
        const changes = Array.from(keys).flatMap((slot) => {
          const before = getSlot(previous.slots, slot);
          const value = getSlot(after, slot);
          return sameSlot(before, value) ? [] : [{ slot, before, after: value }];
        });
        const entry = details && { ...details, id: crypto.randomUUID(), scope, stage: playRollStage(previous.slots.active),
          cleared: [...new Set(clearedScopes.current)], changes };
        publish({ slots: after, undo: entry || changes.length ? changes.map(({ slot, before }) => ({ slot, before })) : previous.undo,
          undoRollId: entry?.id ?? (changes.length ? undefined : previous.undoRollId),
          history: entry ? appendPlayRoll(previous.history, { ...entry, requires: playRollRequirements(entry, previous.slots) }) : previous.history });
      }
      clearedScopes.current = [];
    }
  }, [publish]);

  const undoRoll = useCallback(() => {
    const { slots, undo, history, undoRollId } = current.current;
    if (!undo.length && !undoRollId) return;
    const next = { ...slots };
    for (const { slot, before } of undo) {
      if (before.length) next[slot] = before[0];
      else delete next[slot];
    }
    publish({ slots: next, undo: [], history: history.filter(({ id }) => id !== undoRollId) });
  }, [publish]);

  const rewindRoll = useCallback((id: string) => {
    const { slots, history } = current.current;
    const plan = planRollCorrection(slots, history, id);
    if (!plan || plan.conflicts.length) return false;
    const affected = new Set(plan.affected.map((entry) => entry.id));
    publish({ slots: plan.slots, history: history.filter((entry) => !affected.has(entry.id)), undo: [] });
    return true;
  }, [publish]);

  return <Draft.Provider value={{ slots: room.slots, history: room.history, canUndo: !!room.undo.length || !!room.undoRollId,
    generation: generation.current, write, dropScope, replaceRoom, commitRoll, undoRoll, rewindRoll }}>
    {persistence && <div className="campaign-storage-status">
      <p role="status">{persistence === 'conflict'
        ? '다른 탭에서 이 캠페인을 변경했습니다. 이 탭의 진행은 저장 파일로 내보낼 수 있습니다.'
        : '브라우저에 저장할 수 없어 진행을 이 탭에 보관 중입니다.'}</p>
      {persistence === 'conflict' && (reopen ? <div className="campaign-selector-actions">
        <p>이 탭의 사본을 닫고 브라우저에 저장된 진행을 엽니다.</p>
        <button type="button" className="btn primary" onClick={() => {
          if (!readRoom(browserValue('localStorage', storageKey))) { setReopen(false); return; }
          try {
            sessionStorage.removeItem(pendingKey);
            window.location.reload();
          } catch { setReopen(false); }
        }}>저장된 진행 열기</button>
        <button type="button" className="btn ghost" onClick={() => setReopen(false)}>취소</button>
      </div> : <button type="button" className="btn ghost" onClick={() => setReopen(true)}>최근 저장 확인</button>)}
    </div>}
    {children}
  </Draft.Provider>;
}

/** `root` starts the scope at the top of the draft, for tools shown inside another stage's panes. */
export function PlayDraftScope({ name, children, root = false }: { name: string; children: ReactNode; root?: boolean }) {
  const parent = useContext(Scope);
  return <Scope.Provider value={`${root ? '' : parent}${encodeURIComponent(name)}/`}>{children}</Scope.Provider>;
}

export function PlayReferenceTool({ children }: { children: ReactNode }) {
  return <Draft.Provider value={null}>{children}</Draft.Provider>;
}

export function usePlayDraft() {
  return useContext(Draft);
}

export function usePlayDraftScope() {
  return useContext(Scope);
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
  const commit = useContext(Draft)?.commitRoll;
  const scope = useContext(Scope);
  return useCallback((action: () => void, details?: PlayRollDetails) => (commit ?? directly)(action, details, scope), [commit, scope]);
}

export function usePlayRollField(key: string, label: string, dice: string, completed: boolean, allowZero = false) {
  const scope = useContext(Scope);
  return {
    'data-play-dice': '',
    'data-play-roll-field': `${scope}${key}`,
    'data-play-roll-label': label,
    'data-play-roll-die': dice,
    'data-play-roll-pending': completed ? undefined : '',
    'data-play-roll-zero': allowZero ? '' : undefined,
  };
}

export function useClearPlayDraftScope() {
  const draft = useContext(Draft);
  const drop = draft?.dropScope;
  const generation = draft?.generation ?? 0;
  const parent = useContext(Scope);
  return useCallback((name: string) => drop?.(generation, `${parent}${encodeURIComponent(name)}/`), [drop, generation, parent]);
}
