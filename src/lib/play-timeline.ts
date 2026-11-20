export const PLAY_TIMELINE_SLOT = 'playTimeline';

type TimelineFact = { label: string; value: string };
type TimelineSheetItem = { id: string; text: string; copied: boolean };

export interface PlayTimelineEntry {
  id: string;
  domainId: number;
  roomNumber: number;
  title: string;
  paperId?: string;
  facts: TimelineFact[];
  journalCopied: boolean;
  sheet: TimelineSheetItem[];
}

interface TimelineInput {
  id: string;
  domainId: number;
  roomNumber: number;
  title: string;
  paperId?: string;
  facts: readonly { label: string; value: string | null | undefined }[];
  sheet: readonly { id: string; text: string }[];
  applied: readonly string[];
  journalCopied?: boolean;
}

export function createPlayTimelineEntry(input: TimelineInput): PlayTimelineEntry | null {
  const facts = input.facts.flatMap(({ label, value }) => value?.trim() ? [{ label, value }] : []);
  const sheet = [...new Map(input.sheet.map(({ id, text }) => {
    const key = `${id}:${text}`;
    return [key, { id: key, text, copied: input.applied.includes(key) }];
  })).values()];
  if (!facts.length && !sheet.length) return null;
  return {
    id: input.id || `${input.domainId}/${input.roomNumber}`,
    domainId: input.domainId,
    roomNumber: input.roomNumber,
    title: input.title.trim() || `장소 ${input.roomNumber}`,
    ...(input.paperId ? { paperId: input.paperId } : {}),
    facts,
    journalCopied: !!input.journalCopied,
    sheet,
  };
}

export function appendPlayTimeline(previous: PlayTimelineEntry[], entry: PlayTimelineEntry | null) {
  return !entry || previous.some(({ id }) => id === entry.id) ? previous : [...previous, entry];
}

export function pendingTimelineCount(entry: PlayTimelineEntry) {
  return Number(entry.facts.length > 0 && !entry.journalCopied) + entry.sheet.filter(({ copied }) => !copied).length;
}

export function formatPendingTimeline(entries: readonly PlayTimelineEntry[]) {
  return entries.flatMap((entry) => {
    if (!pendingTimelineCount(entry)) return [];
    const number = `장소 ${entry.roomNumber}`;
    const lines = [entry.title === number ? number : `${number} · ${entry.title}`];
    if (entry.paperId && entry.title !== entry.paperId) lines[0] += ` · 지도 ${entry.paperId}`;
    if (!entry.journalCopied) lines.push(...entry.facts.map(({ label, value }) => `${label} · ${value}`));
    lines.push(...entry.sheet.filter(({ copied }) => !copied).map(({ text }) => `시트 · ${text}`));
    return [lines.join('\n')];
  }).join('\n\n');
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isTimelineEntry(value: unknown): value is PlayTimelineEntry {
  return record(value) && typeof value.id === 'string' && !!value.id
    && positiveInteger(value.domainId) && positiveInteger(value.roomNumber)
    && typeof value.title === 'string' && !!value.title.trim()
    && (value.paperId === undefined || typeof value.paperId === 'string' && !!value.paperId.trim() && value.paperId.length <= 32)
    && Array.isArray(value.facts) && value.facts.every((fact: unknown) => record(fact)
      && typeof fact.label === 'string' && typeof fact.value === 'string')
    && typeof value.journalCopied === 'boolean'
    && Array.isArray(value.sheet) && value.sheet.every((item: unknown) => record(item)
      && typeof item.id === 'string' && !!item.id && typeof item.text === 'string' && typeof item.copied === 'boolean')
    && new Set(value.sheet.map(({ id }) => id)).size === value.sheet.length
    && (value.facts.length > 0 || value.sheet.length > 0);
}

export function isPlayTimeline(value: unknown): value is PlayTimelineEntry[] {
  return Array.isArray(value) && value.every(isTimelineEntry)
    && new Set(value.map(({ id }) => id)).size === value.length;
}
