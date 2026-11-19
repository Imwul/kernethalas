import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ProcNode, Procedure } from '../content/schema';
import { planLabels, planNodeBox, planRoutes, planSize } from '../lib/plan-layout';

export const KIND_KO: Record<ProcNode['kind'], string> = {
  start: '시작점',
  step: '단계',
  check: '판정',
  branch: '분기',
  outcome: '결과',
  table: '표',
  loop: '반복',
  note: '주석',
};

/** rough width estimate at the 18px title size: Hangul ≈ 18px, Latin ≈ 9.4px */
const charW = (ch: string) => (/[\u3131-\uD7A3]/.test(ch) ? 18 : ch === ' ' ? 5 : 9.4);

/** Break a title into at most two lines at word boundaries; ellipsis only if it still overflows. */
function wrap2(t: string, max: number): string[] {
  const words = t.split(' ');
  const lines: string[] = [''];
  let w = 0;
  for (const word of words) {
    const ww = [...word].reduce((a, c) => a + charW(c), 0);
    const add = lines[lines.length - 1] ? charW(' ') + ww : ww;
    if (w + add > max && lines[lines.length - 1]) {
      if (lines.length === 2) {
        lines[1] = clip(lines[1] + ' ' + word, max);
        return lines;
      }
      lines.push(word);
      w = ww;
    } else {
      lines[lines.length - 1] += (lines[lines.length - 1] ? ' ' : '') + word;
      w += add;
    }
  }
  return lines.map((l) => clip(l, max));
}
function clip(t: string, max: number): string {
  let w = 0;
  let out = '';
  for (const ch of t) {
    w += charW(ch);
    if (w > max) return out.trimEnd() + '…';
    out += ch;
  }
  return out;
}

function Glyph({ kind, x, y }: { kind: ProcNode['kind']; x: number; y: number }) {
  const g = { className: 'glyph', transform: `translate(${x},${y})` } as const;
  switch (kind) {
    case 'check':
      return (
        <g {...g}>
          <path d="M7 0l7 7-7 7-7-7z" />
        </g>
      );
    case 'branch':
      return (
        <g {...g}>
          <path d="M1 12L7 2l6 10" />
          <path d="M7 2v12" />
        </g>
      );
    case 'table':
      return (
        <g {...g}>
          <rect x="0" y="1" width="14" height="12" />
          <path d="M0 5h14M0 9h14M5 1v12" />
        </g>
      );
    case 'loop':
      return (
        <g {...g}>
          <path d="M12 7a5 5 0 11-2-4" />
          <path d="M10 0v3.5h3.5" />
        </g>
      );
    case 'start':
      return (
        <g {...g}>
          <circle cx="7" cy="7" r="6" />
          <path d="M7 1v12M1 7h12" />
        </g>
      );
    case 'outcome':
      return (
        <g {...g}>
          <rect x="1" y="1" width="12" height="12" />
          <rect x="4" y="4" width="6" height="6" />
        </g>
      );
    case 'note':
      return (
        <g {...g}>
          <path d="M2 2h10M2 7h10M2 12h6" />
        </g>
      );
    default:
      return (
        <g {...g}>
          <path d="M1 7h12M8 2l5 5-5 5" />
        </g>
      );
  }
}

interface Props {
  p: Procedure;
  selected: string | null;
  onSelect: (id: string) => void;
}

export function Plan({ p, selected, onSelect }: Props) {
  const { width: W, height: H } = planSize(p);
  const byId = useMemo(() => new Map(p.nodes.map((n) => [n.id, n])), [p]);
  const routes = useMemo(() => planRoutes(p), [p]);
  const markers = useId();
  const canvasId = useId();
  const canvas = useRef<HTMLDivElement>(null);
  const drawing = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);
  const [fit, setFit] = useState(0.82);
  const [textWidths, setTextWidths] = useState<Record<string, number>>({});
  const scale = zoom ?? fit;
  const start = p.nodes.find((n) => n.kind === 'start');
  const labels = useMemo(() => planLabels(p, routes, textWidths), [p, routes, textWidths]);

  useLayoutEffect(() => {
    let active = true;
    const measure = () => {
      if (!active || !drawing.current) return;
      const widths = Object.fromEntries(Array.from(drawing.current.querySelectorAll<SVGTextElement>('.edge-label'), (text) => [
        text.dataset.edge!, Math.ceil(text.getComputedTextLength()),
      ] as const).filter(([, width]) => width > 0));
      setTextWidths((previous) => JSON.stringify(widths) === JSON.stringify(previous) ? previous : widths);
    };
    measure();
    void document.fonts.ready.then(measure);
    document.fonts.addEventListener('loadingdone', measure);
    return () => {
      active = false;
      document.fonts.removeEventListener('loadingdone', measure);
    };
  }, [routes]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const measure = () => setFit(Math.max(0.8, Math.min(1, (el.clientWidth - 24) / W)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [W]);

  const center = useCallback((id: string) => {
    const el = canvas.current;
    const node = byId.get(id);
    if (!el || !node) return;
    const { x, y, width, height } = planNodeBox(node);
    const halfWidth = el.clientWidth / 2;
    const halfHeight = el.clientHeight / 2;
    el.scrollTo({
      left: (x + width / 2) * scale + 12 - halfWidth,
      top: (y + height / 2) * scale + 12 - halfHeight,
    });
  }, [byId, scale]);

  useEffect(() => {
    if (selected) center(selected);
  }, [center, selected]);

  const edges = routes.map((edge) => ({ ...edge, hot: selected === edge.from || selected === edge.to }));

  return (
    <div className="atlas-drawing">
      <div className="atlas-drawing-tools" role="group" aria-label="도면 조작">
        {start && <button type="button" className="btn ghost" onClick={() => { center(start.id); onSelect(start.id); }}>시작점</button>}
        <div className="atlas-zoom" aria-label="도면 배율" role="group">
          <button type="button" className="btn ghost" aria-label="도면 축소" aria-controls={canvasId} disabled={scale <= 0.8} onClick={() => setZoom(Math.max(0.8, scale - 0.2))}>−</button>
          <button type="button" className="btn ghost" aria-label={`도면 배율 ${Math.round(scale * 100)}%, 기본 배율로 돌아가기`} aria-controls={canvasId} onClick={() => setZoom(null)}>{Math.round(scale * 100)}%</button>
          <button type="button" className="btn ghost" aria-label="도면 확대" aria-controls={canvasId} disabled={scale >= 1.6} onClick={() => setZoom(Math.min(1.6, scale + 0.2))}>+</button>
        </div>
      </div>
      <div
        className="sheet atlas-canvas"
        ref={canvas}
        id={canvasId}
        tabIndex={0}
        role="region"
        aria-label={`${p.ko} 도면. 방향키로 이동`}
        data-panning={panning || undefined}
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('[role=button]')) return;
          const el = event.currentTarget;
          drag.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
          el.setPointerCapture(event.pointerId);
          setPanning(true);
        }}
        onPointerMove={(event) => {
          const origin = drag.current;
          if (origin) event.currentTarget.scrollTo({ left: origin.left + origin.x - event.clientX, top: origin.top + origin.y - event.clientY });
        }}
        onLostPointerCapture={() => { drag.current = null; setPanning(false); }}
      >
        <svg ref={drawing} className="plan-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: Math.round(W * scale) }} role="group" aria-label={`${p.ko} 단계`}>
          <defs>
            <marker id={`${markers}-arrow`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--slate-2)" />
            </marker>
            <marker id={`${markers}-active`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 z" fill="var(--oxblood)" />
            </marker>
          </defs>
          <g aria-hidden="true">
            {[...edges].sort((a, b) => Number(a.hot) - Number(b.hot)).map((edge) => (
              <path key={edge.key} className={`edge${edge.hot ? ' atlas-edge-selected' : ''}`} d={edge.d}
                markerEnd={`url(#${markers}-${edge.hot ? 'active' : 'arrow'})`} />
            ))}
          </g>
          {edges.filter(({ label }) => label).map(({ key, label, hot }) => {
            const box = labels.get(key);
            return <g key={key} className={hot ? 'atlas-edge-selected' : undefined} visibility={box ? undefined : 'hidden'}>
              {box && <rect className="edge-label-backplate" {...box} rx={3} />}
              <text className="edge-label" data-edge={key} x={box ? box.x + box.width / 2 : 0}
                y={box ? box.y + box.height / 2 : 0} textAnchor="middle" dominantBaseline="central">{label}</text>
            </g>;
          })}
          {p.nodes.map((n) => {
            const { x, y, width: NW, height: NH } = planNodeBox(n);
            const sel = selected === n.id;
            return (
              <g
                key={n.id}
                data-title={n.title}
                className={`node k-${n.kind} ${sel ? 'sel' : ''}`}
                transform={`translate(${x},${y})`}
                tabIndex={0}
                role="button"
                aria-pressed={sel}
                aria-label={`${KIND_KO[n.kind]}: ${n.title}`}
                onClick={() => onSelect(n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(n.id);
                  }
                }}
              >
                <title>{n.title}</title>
                <rect className="box" width={NW} height={NH} />
                {n.kind === 'outcome' && <rect className="inner" x={4} y={4} width={NW - 8} height={NH - 8} />}
                <path className="ticks" d={`M-5,0 H0 M0,-5 V0 M${NW},-5 V0 M${NW},0 H${NW + 5} M-5,${NH} H0 M0,${NH} V${NH + 5} M${NW},${NH} H${NW + 5} M${NW},${NH} V${NH + 5}`} />
                <Glyph kind={n.kind} x={12} y={11} />
                <text className="n-kind" x={34} y={22}>
                  {KIND_KO[n.kind]}
                </text>
                {n.need && <rect className={`need-${n.need}`} x={NW - 18} y={11} width={8} height={8} />}
                {wrap2(n.title, NW - 26).map((line, li, all) => (
                  <text key={li} className="n-title" x={12} y={all.length === 1 ? 54 : 46 + li * 22}>
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
