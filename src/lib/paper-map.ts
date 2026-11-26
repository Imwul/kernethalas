import { roomShapeForRoll, type EncounterPlace } from '../content/tables/exploration';
import type { RoomExitMark, RoomShapeState } from '../components/RoomShapeDiagram';
import { LOCK_THRESHOLDS, type DoorInvestigation } from './lock-trap';
import type { PaperMapClue } from './paper-map-clues';

export const PAPER_MAP_SLOT = 'paperMap';

export const PAPER_MAP_TAGS = ['잠긴 문', '미개봉 용기', '미탐색 출입구'] as const;
export type PaperMapTag = typeof PAPER_MAP_TAGS[number];
export type PaperMapTile = RoomShapeState & { roll: number };

export interface PaperMapDoorReport {
  exit: string;
  text: string;
  opened: boolean;
  deferred?: DoorInvestigation;
}

export interface PaperMapLocation {
  domainId: number;
  paperId: string;
  area: EncounterPlace;
  note: string;
  tags: PaperMapTag[];
  tile?: PaperMapTile;
  doors?: PaperMapDoorReport[];
  clues?: PaperMapClue[];
}

export function paperMapKey(paperId: string) {
  return paperId.trim().toLowerCase();
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function returnPlaceTags(location: PaperMapLocation): PaperMapTag[] {
  const tags = new Set(location.tags);
  for (const { deferred } of location.doors ?? []) {
    if (deferred) tags.add((deferred.lockRoll ?? 0) >= LOCK_THRESHOLDS.door ? '잠긴 문' : '미탐색 출입구');
  }
  return [...tags];
}

const die = (value: unknown, sides: number) => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= sides);
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
const outcome = (value: unknown) => value === null || value === 'success' || value === 'failure';

function isDoorInvestigation(value: unknown): value is DoorInvestigation {
  return record(value) && (value.detection === '' || value.detection === 'success' || value.detection === 'failure')
    && typeof value.touched === 'boolean' && typeof value.trapResolved === 'boolean'
    && die(value.trapRoll, 10) && die(value.lockRoll, 20) && count(value.pickFailures) && count(value.forceFailures)
    && (value.trap === null || record(value.trap) && die(value.trap.kind, 10)
      && typeof value.trap.method === 'string' && ['', 'disarm', 'bypass', 'trigger'].includes(value.trap.method)
      && outcome(value.trap.result) && outcome(value.trap.avoided));
}

export function isPaperMapDoorReport(door: unknown): door is PaperMapDoorReport {
  return record(door) && typeof door.exit === 'string' && !!door.exit.trim() && door.exit.length <= 48
    && typeof door.text === 'string' && !!door.text.trim() && door.text.length <= 600 && typeof door.opened === 'boolean'
    && (door.deferred === undefined || !door.opened && isDoorInvestigation(door.deferred));
}

export function isPaperMapDoorReports(value: unknown): value is PaperMapDoorReport[] {
  return Array.isArray(value) && value.every(isPaperMapDoorReport)
    && new Set(value.map(({ exit }) => paperMapKey(exit))).size === value.length;
}

function isExit(value: unknown, exits: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < exits;
}

function isMark(value: unknown): value is RoomExitMark {
  return value === 'unexplored' || value === 'checked' || value === 'locked';
}

export function isPaperMapTile(value: unknown, area?: EncounterPlace): value is PaperMapTile {
  if (!record(value) || typeof value.roll !== 'number' || !Number.isInteger(value.roll)) return false;
  const shape = roomShapeForRoll(value.roll);
  return !!shape && (!area || shape.place === area) && isExit(value.turns, 4)
    && (value.entrance === null || isExit(value.entrance, shape.exits)) && record(value.marks)
    && Object.entries(value.marks).every(([key, mark]) => String(Number(key)) === key
      && isExit(Number(key), shape.exits) && isMark(mark));
}

export function capturePaperMapTile(roll: number, state: RoomShapeState, area: EncounterPlace): PaperMapTile | undefined {
  const shape = roomShapeForRoll(roll);
  if (!shape || shape.place !== area) return undefined;
  const marks: RoomShapeState['marks'] = {};
  for (let index = 0; index < shape.exits; index++) {
    const mark = state.marks[index];
    if (isMark(mark)) marks[index] = mark;
  }
  return {
    roll,
    turns: isExit(state.turns, 4) ? state.turns : 0,
    entrance: isExit(state.entrance, shape.exits) ? state.entrance : null,
    marks,
  };
}
