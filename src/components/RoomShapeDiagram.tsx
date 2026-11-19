import { roomShapeForRoll } from '../content/tables/exploration';
import '../styles/room-shape.css';

const center = { x: 64, y: 48 };
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

export function RoomShapeDiagram({ roll }: { roll: number }) {
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
  return (
    <svg className="room-shape-diagram" viewBox="0 0 128 96" role="img"
      aria-label={`${roll}번 ${place === 'room' ? '방' : '통로'} 모양 예시 · 출입구 ${exits}개`}>
      <path className="room-shape-outline" d={branches} />
      {place === 'room' && <rect className="room-shape-chamber" {...room} />}
      <path className="room-shape-passage" d={branches} />
      {paths.map(({ from, to }, i) => {
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const x = (to.y - from.y) * 5 / length;
        const y = (from.x - to.x) * 5 / length;
        return <line className="room-shape-exit" key={i} x1={to.x - x} y1={to.y - y} x2={to.x + x} y2={to.y + y} />;
      })}
    </svg>
  );
}
