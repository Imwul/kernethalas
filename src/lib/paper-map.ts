import { roomShapeForRoll, type EncounterPlace } from '../content/tables/exploration';
import type { RoomExitMark, RoomShapeState } from '../components/RoomShapeDiagram';

export const PAPER_MAP_SLOT = 'paperMap';

export const PAPER_MAP_TAGS = ['잠긴 문', '미개봉 용기', '미탐색 출입구'] as const;
export type PaperMapTag = typeof PAPER_MAP_TAGS[number];
export type PaperMapTile = RoomShapeState & { roll: number };

export interface PaperMapLocation {
  domainId: number;
  paperId: string;
  area: EncounterPlace;
  note: string;
  tags: PaperMapTag[];
  tile?: PaperMapTile;
}

export function paperMapKey(paperId: string) {
  return paperId.trim().toLowerCase();
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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
