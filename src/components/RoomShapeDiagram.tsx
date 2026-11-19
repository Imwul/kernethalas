import { roomShapeForRoll } from '../content/tables/exploration';
import '../styles/room-shape.css';

const center = { x: 64, y: 48 };
const outlineWidth = 13;
const passageWidth = 10;
const corridorEnds = [
  { x: 64, y: 83 }, { x: 24, y: 78 }, { x: 13, y: 48 }, { x: 24, y: 18 },
  { x: 64, y: 13 }, { x: 104, y: 18 }, { x: 115, y: 48 }, { x: 104, y: 78 },
];
const roomPorts = [
  { across: 0.35, down: 1, dx: 0, dy: 1 },
  { across: 0, down: 0.72, dx: -1, dy: 0 },
  { across: 0, down: 0.28, dx: -1, dy: 0 },
  { across: 0.35, down: 0, dx: 0, dy: -1 },
  { across: 0.65, down: 0, dx: 0, dy: -1 },
  { across: 1, down: 0.28, dx: 1, dy: 0 },
  { across: 1, down: 0.72, dx: 1, dy: 0 },
  { across: 0.65, down: 1, dx: 0, dy: 1 },
];
const roomProfiles = [
  { width: 68, height: 50, rx: 3 },
  { width: 78, height: 43, rx: 8 },
  { width: 58, height: 54, rx: 11 },
];

export const ROOM_EXIT_MARKS = { unexplored: '미탐색', checked: '조사함', locked: '잠김' } as const;
export type RoomExitMark = keyof typeof ROOM_EXIT_MARKS;

export interface RoomShapeState {
  turns: number;
  entrance: number | null;
  marks: Partial<Record<number, RoomExitMark>>;
}

export function RoomShapeDiagram({ roll, state }: { roll: number; state?: RoomShapeState }) {
  const shape = roomShapeForRoll(roll);
  if (!shape) return null;
  const { place, exits } = shape;
  const profile = roomProfiles[roll % roomProfiles.length];
  const room = { ...profile, x: center.x - profile.width / 2, y: center.y - profile.height / 2 };
  const turn = Math.floor(roll / 3) % 8;
  const paths = Array.from({ length: exits }, (_, i) => {
    const spread = exits === 2 && roll % 2 ? 2 : 8 / exits;
    const position = (Math.floor(i * spread) + turn) % 8;
    if (place === 'corridor') return { from: center, to: corridorEnds[position] };
    const port = roomPorts[position];
    const wall = { x: room.x + port.across * room.width, y: room.y + port.down * room.height };
    return {
      from: { x: wall.x - 4 * port.dx, y: wall.y - 4 * port.dy },
      to: { x: wall.x + 14 * port.dx, y: wall.y + 14 * port.dy },
    };
  });
  const branches = paths.map(({ from, to }) => `M${from.x},${from.y}L${to.x},${to.y}`).join(' ');
  const junction = place === 'corridor' && exits > 1;
  const angle = (state?.turns ?? 0) * 90;
  return (
    <svg className="room-shape-diagram" viewBox={state ? '-8 -24 144 144' : '0 0 128 96'} role="img"
      aria-label={`${roll}번 ${place === 'room' ? '방' : '통로'} 모양 예시 · 출입구 ${exits}개`}>
      <g transform={angle ? `rotate(${angle} ${center.x} ${center.y})` : undefined}>
        {junction && <circle className="room-shape-outline-junction" cx={center.x} cy={center.y} r={outlineWidth / 2} />}
        <path className="room-shape-outline" d={branches} strokeWidth={outlineWidth} />
        {place === 'room' && <rect className="room-shape-chamber" {...room} />}
        {junction && <circle className="room-shape-passage-junction" cx={center.x} cy={center.y} r={passageWidth / 2} />}
        <path className="room-shape-passage" d={branches} strokeWidth={passageWidth} />
        {paths.map(({ from, to }, i) => {
          const length = Math.hypot(to.x - from.x, to.y - from.y);
          const dx = (to.x - from.x) / length;
          const dy = (to.y - from.y) / length;
          const labelX = to.x + dx * 8;
          const labelY = to.y + dy * 8;
          const marker = state?.marks[i];
          const entrance = state?.entrance === i;
          return (
            <g key={i}>
              <line className="room-shape-exit" x1={to.x - dy * 5} y1={to.y + dx * 5}
                x2={to.x + dy * 5} y2={to.y - dx * 5} data-mark={marker} data-entrance={entrance || undefined} />
              {state && <text className="room-shape-number" x={labelX} y={labelY}
                data-mark={marker} data-entrance={entrance || undefined}
                transform={angle ? `rotate(${-angle} ${labelX} ${labelY})` : undefined}>
                {i + 1}
              </text>}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
