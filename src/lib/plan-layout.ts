import type { ProcEdge, ProcNode, Procedure } from '../content/schema';

export const PLAN_NODE_WIDTH = 224;
export const PLAN_NODE_HEIGHT = 78;
const COLUMN_WIDTH = 290;
const ROW_HEIGHT = 160;
const LEFT = 34;
const TOP = 18;
const LABEL_HEIGHT = 24;
const LABEL_PADDING = 7;
const CARD_GUTTER = COLUMN_WIDTH - PLAN_NODE_WIDTH;

type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };
type Segment = [Point, Point];
type Route = ProcEdge & { key: string; d: string; segments: Segment[] };
const point = (x: number, y: number): Point => ({ x, y });

export function planNodeBox(node: ProcNode): Box {
  return {
    x: LEFT + node.col * COLUMN_WIDTH + CARD_GUTTER / 2,
    y: TOP + node.row * ROW_HEIGHT,
    width: PLAN_NODE_WIDTH,
    height: PLAN_NODE_HEIGHT,
  };
}

export function planSize(p: Procedure) {
  return {
    width: LEFT + p.cols * COLUMN_WIDTH + 10,
    height: TOP + Math.max(...p.nodes.map(({ row }) => row)) * ROW_HEIGHT + PLAN_NODE_HEIGHT + 24,
  };
}

function routePoints(a: ProcNode, b: ProcNode, i: number, label: string | undefined) {
  const pa = planNodeBox(a);
  const pb = planNodeBox(b);
  const columns = b.col - a.col;
  if (b.row > a.row) {
    const sx = pa.x + pa.width / 2 + columns * 32;
    const sy = pa.y + pa.height;
    const tx = pb.x + pb.width / 2 - columns * 26;
    const ty = pb.y;
    const rowGap = ROW_HEIGHT - PLAN_NODE_HEIGHT;
    // Send wide branches in opposite directions through different horizontal lanes.
    const mid = sy + rowGap / 2 + (Math.abs(columns) > 1 ? Math.sign(columns) * 10 : 0);
    if (b.row - a.row > 1) {
      const lane = pb.x - CARD_GUTTER / 2;
      return [point(sx, sy), point(sx, mid), point(lane, mid), point(lane, ty - 22), point(tx, ty - 22), point(tx, ty - 6)];
    }
    return sx === tx ? [point(sx, sy), point(tx, ty - 6)]
      : [point(sx, sy), point(sx, mid), point(tx, mid), point(tx, ty - 6)];
  }
  if (b.row === a.row) {
    const right = columns > 0;
    const gap = Math.abs(columns) * COLUMN_WIDTH - pa.width;
    if (label && estimateTextWidth(label) > gap + 32) {
      const sx = pa.x + pa.width * (right ? 0.86 : 0.14);
      const tx = pb.x + pb.width * (right ? 0.14 : 0.86);
      const bottom = pa.y + pa.height;
      const lane = bottom + 22;
      return [point(sx, bottom), point(sx, lane), point(tx, lane), point(tx, bottom + 6)];
    }
    const y = pa.y + pa.height / 2;
    return [point(right ? pa.x + pa.width : pa.x, y), point(right ? pb.x - 6 : pb.x + pb.width + 6, y)];
  }
  const lane = Math.min(pa.x, pb.x) - 22 - i % 3 * 4;
  const sy = pa.y + pa.height / 2;
  const ty = pb.y + pb.height / 2;
  return [point(pa.x, sy), point(lane, sy), point(lane, ty), point(pb.x - 6, ty)];
}

export function planRoutes(p: Procedure): Route[] {
  const nodes = new Map(p.nodes.map((node) => [node.id, node]));
  return p.edges.map((edge, i) => {
    const points = routePoints(nodes.get(edge.from)!, nodes.get(edge.to)!, i, edge.label);
    return {
      ...edge,
      key: `${edge.from}-${edge.to}-${i}`,
      d: points.map(({ x, y }, j) => `${j === 0 ? 'M' : 'L'}${x},${y}`).join(' '),
      segments: points.slice(1).map((next, index) => [points[index], next]),
    };
  });
}

const outset = (box: Box, gap: number): Box => ({
  x: box.x - gap, y: box.y - gap, width: box.width + 2 * gap, height: box.height + 2 * gap,
});
const segmentBox = ([a, b]: Segment): Box => ({
  x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
});
const intersects = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const estimateTextWidth = (label: string) => [...label].reduce((width, char) => width + (/[\u3131-\uD7A3]/.test(char) ? 15 : 9), 0);

// Try the target end first. The long side of a return route is easiest to identify.
function labelCandidates(route: Route, width: number) {
  const segments = [...route.segments].reverse();
  if (segments.some(([a, b]) => b.y < a.y)) {
    segments.sort((a, b) => segmentBox(b).height - segmentBox(a).height);
  }
  const result: Box[] = [];
  for (const gap of [8, 14, 24, 36, 52]) {
    for (const [a, b] of segments) {
      if (a.x === b.x && a.y === b.y) continue;
      for (const ratio of [0.5, 0.3, 0.7, 0.1, 0.9]) {
        const x = a.x + (b.x - a.x) * ratio;
        const y = a.y + (b.y - a.y) * ratio;
        if (a.x === b.x) {
          result.push({ x: x + gap, y: y - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT });
          result.push({ x: x - gap - width, y: y - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT });
        } else {
          result.push({ x: x - width / 2, y: y - gap - LABEL_HEIGHT, width, height: LABEL_HEIGHT });
          result.push({ x: x - width / 2, y: y + gap, width, height: LABEL_HEIGHT });
        }
      }
    }
  }
  return result;
}

export function planLabels(p: Procedure, routes: Route[], textWidths: Record<string, number>) {
  const size = planSize(p);
  const cards = p.nodes.map((node) => outset(planNodeBox(node), 6));
  const lines = routes.flatMap(({ segments }) => segments.map((segment) => outset(segmentBox(segment), 6)));
  const inside = (box: Box) => box.x >= 4 && box.y >= 4
    && box.x + box.width <= size.width - 4 && box.y + box.height <= size.height - 4;
  const labels = routes.flatMap((route) => {
    if (!route.label) return [];
    const pixels = textWidths[route.key] ?? estimateTextWidth(route.label);
    const candidates = labelCandidates(route, Math.ceil(pixels) + LABEL_PADDING * 2)
      .filter((box) => inside(box) && !cards.some((card) => intersects(card, box)));
    const clear = candidates.filter((box) => !lines.some((line) => intersects(line, box)));
    return [{ route, candidates, clear }];
  });
  labels.sort((a, b) => a.clear.length - b.clear.length || a.candidates.length - b.candidates.length);
  const placed = new Map<string, Box>();
  for (const { route, candidates, clear } of labels) {
    const occupied = [...placed.values()].map((box) => outset(box, 4));
    const fits = (candidate: Box) => !occupied.some((box) => intersects(box, candidate));
    const placement = clear.find(fits) ?? candidates.find(fits);
    if (placement) placed.set(route.key, placement);
  }
  return placed;
}
