import { paperMapKey, type PaperMapLocation } from './paper-map';

export const MAP_CLUE_LIMIT = 32;
export const MAP_CLUE_TEXT_LIMIT = 400;

export const MAP_CLUE_SOURCES = { description: '환경 묘사', event: '이벤트', note: '직접 기록' } as const;
export const MAP_CLUE_STATUSES = { confirmed: '확인한 사실', hypothesis: '추측' } as const;
export type MapClueSource = keyof typeof MAP_CLUE_SOURCES;
export type MapClueStatus = keyof typeof MAP_CLUE_STATUSES;
export type MapClueCapture = { source: MapClueSource; text: string };
export type PaperMapClue = MapClueCapture & { id: string; status: MapClueStatus; relatedPaperId?: string };

function isPaperMapClue(value: unknown): value is PaperMapClue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const clue = value as Partial<PaperMapClue>;
  const { id, text, source, status, relatedPaperId } = clue;
  return typeof id === 'string' && !!id.trim() && id.length <= 64
    && typeof text === 'string' && !!text.trim() && text.length <= MAP_CLUE_TEXT_LIMIT
    && typeof source === 'string' && Object.hasOwn(MAP_CLUE_SOURCES, source)
    && typeof status === 'string' && Object.hasOwn(MAP_CLUE_STATUSES, status)
    && (relatedPaperId === undefined || typeof relatedPaperId === 'string' && !!paperMapKey(relatedPaperId) && relatedPaperId.length <= 32);
}

export function isPaperMapClues(value: unknown): value is PaperMapClue[] {
  return Array.isArray(value) && value.length <= MAP_CLUE_LIMIT && value.every(isPaperMapClue)
    && new Set(value.map(({ id }) => id)).size === value.length;
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
