import { safePlaySlot, type PlayRollEntry } from './play-roll-history';

export const PLAY_SESSION_SLOT = 'playSession';
export const SESSION_INTENT_LIMIT = 180;

export type SessionPoint = { stage: PlayRollEntry['stage']; field?: string; label?: string };
export type SessionPause = {
  roomId: string;
  place: string;
  at: number;
  intent: string;
  facts: string[];
  point: SessionPoint;
};
export type PlaySession = { pause: SessionPause | null; nextIntent?: string };
export const EMPTY_SESSION: PlaySession = { pause: null };

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max;

function isPause(value: unknown): value is SessionPause {
  return isRecord(value) && text(value.roomId, 128) && !!value.roomId && text(value.place, 100)
    && typeof value.at === 'number' && Number.isSafeInteger(value.at) && value.at >= 0 && value.at <= 8.64e15
    && text(value.intent, SESSION_INTENT_LIMIT) && Array.isArray(value.facts) && value.facts.length <= 2
    && value.facts.every((line) => text(line, 148)) && isRecord(value.point)
    && ['explore', 'combat', 'wrapup', 'journal'].some((stage) => stage === (value.point as SessionPoint).stage)
    && (value.point.field === undefined || safePlaySlot(value.point.field))
    && (value.point.label === undefined || text(value.point.label, 90));
}

export function isPlaySession(value: unknown): value is PlaySession {
  return isRecord(value) && (value.pause === null || isPause(value.pause))
    && (value.nextIntent === undefined || text(value.nextIntent, SESSION_INTENT_LIMIT) && !!value.nextIntent.trim());
}

export function carrySessionIntent({ pause, nextIntent }: PlaySession): PlaySession {
  const intent = pause?.intent.trim() || nextIntent;
  return intent ? { pause: null, nextIntent: intent } : EMPTY_SESSION;
}

export function shortSessionText(value: string, max: number) {
  const line = value.trim().replace(/\s+/g, ' ');
  if (line.length <= max) return line;
  const head = line.slice(0, max - 1).replace(/[\uD800-\uDBFF]$/, '');
  return `${head}…`;
}
