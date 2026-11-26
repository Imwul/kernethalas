import { paperMapKey, type PaperMapLocation } from './paper-map';
import type { PlaySlots } from './play-roll-history';

export const MAP_CLUE_LIMIT = 32;
export const MAP_CLUE_TEXT_LIMIT = 400;

export const MAP_CLUE_SOURCES = { description: '환경 묘사', event: '이벤트', note: '직접 기록' } as const;
export const MAP_CLUE_STATUSES = { confirmed: '확인한 사실', hypothesis: '추측' } as const;
export const MAP_CLUE_ROLL_SLOTS = { event: 'map-clue-event', room: 'map-clue-room', corridor: 'map-clue-corridor' } as const;
const CLUE_ROLLS = ['event', 'room', 'corridor'] as const;
type ClueRoll = (typeof CLUE_ROLLS)[number];
export type MapClueSource = keyof typeof MAP_CLUE_SOURCES;
export type MapClueStatus = keyof typeof MAP_CLUE_STATUSES;
type MapClueProvenance = { roomId: string; rollId: string; changed?: true };
export type MapClueCapture = { source: MapClueSource; text: string; provenance?: MapClueProvenance };
export type PaperMapClue = MapClueCapture & { id: string; status: MapClueStatus; relatedPaperId?: string };

export function isClueRollId(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= 64;
}

function isClueProvenance(value: unknown): value is MapClueProvenance {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { roomId, rollId, changed } = value as Partial<MapClueProvenance>;
  return typeof roomId === 'string' && !!roomId.trim() && roomId.length <= 128
    && isClueRollId(rollId) && (changed === undefined || changed === true);
}

function isPaperMapClue(value: unknown): value is PaperMapClue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const clue = value as Partial<PaperMapClue>;
  const { id, text, source, status, relatedPaperId, provenance } = clue;
  return typeof id === 'string' && !!id.trim() && id.length <= 64
    && typeof text === 'string' && !!text.trim() && text.length <= MAP_CLUE_TEXT_LIMIT
    && typeof source === 'string' && Object.hasOwn(MAP_CLUE_SOURCES, source)
    && typeof status === 'string' && Object.hasOwn(MAP_CLUE_STATUSES, status)
    && (provenance === undefined || source !== 'note' && isClueProvenance(provenance))
    && (relatedPaperId === undefined || typeof relatedPaperId === 'string' && !!paperMapKey(relatedPaperId) && relatedPaperId.length <= 32);
}

export function isPaperMapClues(value: unknown): value is PaperMapClue[] {
  return Array.isArray(value) && value.length <= MAP_CLUE_LIMIT && value.every(isPaperMapClue)
    && new Set(value.map(({ id }) => id)).size === value.length;
}

function activeClueRollId(slots: PlaySlots, field: ClueRoll) {
  const value = field === 'event' ? slots['explore/event-roll']
    : (slots['explore/place-description'] as Partial<Record<'room' | 'corridor', unknown>> | undefined)?.[field];
  if (!Number.isSafeInteger(value)) return null;
  const rollId = slots[`explore/${MAP_CLUE_ROLL_SLOTS[field]}`];
  // A result already stored by a previous version can also be pinned. A newly accepted roll always gets its own ID.
  return isClueRollId(rollId) ? rollId : `legacy:${field}:${value}`;
}

export function clueRollProvenance(slots: PlaySlots | undefined, field: ClueRoll): MapClueProvenance | undefined {
  const roomId = slots?.roomLedgerId;
  if (!slots || typeof roomId !== 'string' || !roomId.trim() || roomId.length > 128) return;
  const rollId = activeClueRollId(slots, field);
  if (rollId) return { roomId, rollId };
}

export function mapClueSourceChanged({ provenance }: MapClueCapture, slots: PlaySlots | undefined) {
  if (!provenance) return false;
  if (provenance.changed) return true;
  return provenance.roomId === slots?.roomLedgerId
    && !CLUE_ROLLS.some((field) => activeClueRollId(slots, field) === provenance.rollId);
}

/** Finalize the active visit's source flags before the room draft is replaced. */
export function archiveMapClueSources(locations: PaperMapLocation[], slots: PlaySlots, discard = false) {
  const roomId = slots.roomLedgerId;
  if (typeof roomId !== 'string') return locations;
  return locations.map((location) => {
    if (!location.clues?.some((clue) => clue.provenance?.roomId === roomId
      && (discard || mapClueSourceChanged(clue, slots)))) return location;
    return { ...location, clues: location.clues.map((clue) => {
      const { provenance } = clue;
      return provenance?.roomId === roomId && (discard || mapClueSourceChanged(clue, slots))
        ? { ...clue, provenance: { ...provenance, changed: true as const } } : clue;
    }) };
  });
}

export function cluesAtLocation(location: PaperMapLocation, locations: readonly PaperMapLocation[]) {
  const key = paperMapKey(location.paperId);
  const local = [...(location.clues ?? [])].reverse().map((clue) => ({ clue, origin: location, incoming: false }));
  const incoming = locations.flatMap((origin) => origin.domainId === location.domainId && paperMapKey(origin.paperId) !== key
    ? (origin.clues ?? []).filter(({ relatedPaperId }) => relatedPaperId && paperMapKey(relatedPaperId) === key)
      .map((clue) => ({ clue, origin, incoming: true })) : []);
  return [...local, ...incoming];
}

export function mapClueCounts(locations: readonly PaperMapLocation[]) {
  const counts = new Map<string, number>();
  for (const { paperId, clues = [] } of locations) {
    const key = paperMapKey(paperId);
    counts.set(key, (counts.get(key) ?? 0) + clues.length);
    for (const { relatedPaperId } of clues) {
      const related = relatedPaperId ? paperMapKey(relatedPaperId) : '';
      if (related && related !== key) counts.set(related, (counts.get(related) ?? 0) + 1);
    }
  }
  return counts;
}
