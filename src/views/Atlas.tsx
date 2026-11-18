import { useEffect, useState } from 'react';
import { BOOK_LABEL, entryById, procedures, procById, rulingById, tableById } from '../content';
import type { ProcEdge, ProcNode, Procedure } from '../content/schema';
import { rollDie } from '../lib/dice';
import { Link, navigate, useLocation } from '../lib/router';
import { Plan, KIND_KO } from '../components/Plan';
import { ContextLink } from '../components/ReferenceContext';
import { RulingMatrix } from '../components/RulingMatrix';
import { BenchButton, Cite, Notes, PinButton, VChip, XRef, useVisit } from '../components/bits';
import { NotFound } from './NotFound';
import '../styles/atlas.css';

const NEED_KO = { required: '필수 확인', conditional: '조건부', optional: '선택 참고' } as const;
const GROUP_KO = { combat: '전투', exploration: '탐험', survival: '생존', loot: '전리품' } as const;
const SOURCE_URLS = {
  core: 'https://blackoath.itch.io/ker-nethalas-into-the-midnight-throne',
  rr: 'https://assets.zyrosite.com/AzGeq3BjKQHn9P8x/rules-reference-UCBrQ6b2VOMVzmsW.pdf',
  'flow-combat': 'https://assets.zyrosite.com/AzGeq3BjKQHn9P8x/combat-flowchart-OxOqQQyinPDN1LY2.pdf',
  'flow-explore': 'https://assets.zyrosite.com/AzGeq3BjKQHn9P8x/domain-exploration-loop-QjsJh883s8EpLPNK.pdf',
};

export function AtlasIndex() {
  return (
    <div className="atlas-index">
      <header className="page-head">
        <h1 className="page-title">절차 도해</h1>
        <p className="lede">지금 상황에 맞는 절차를 고르고, 필요한 단계와 분기를 바로 확인하세요.</p>
      </header>
      <div className="atlas-register">
        {Object.entries(GROUP_KO).map(([group, name]) => (
          <section key={group} aria-labelledby={'atlas-group-' + group}>
            <h2 id={'atlas-group-' + group}>{name}</h2>
            <ul>
              {procedures.filter((p) => p.group === group).map((p) => (
                <li key={p.id}>
                  <Link to={`/atlas/${p.id}`} className="atlas-index-link">
                    <span className="atlas-index-situation">{p.situation}</span>
                    <span className="atlas-index-title">{p.ko}</span>
                    <span className="atlas-index-summary">{p.summary}</span>
                    <span className="atlas-index-arrow" aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function useWidePlan() {
  const query = '(min-width: 1100px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

export function AtlasPage({ id }: { id: string }) {
  const p = procById.get(id);
  const { search } = useLocation();
  const wide = useWidePlan();
  useVisit(p?.id);
  if (!p) return <NotFound />;
  const requestedNode = search.get('node');
  const active = p.nodes.find((n) => n.id === requestedNode);
  const start = p.nodes.find((n) => n.kind === 'start') ?? p.nodes[0];
  const requestedView = search.get('view');
  const view = requestedView === 'list' || requestedView === 'plan' ? requestedView : wide ? 'plan' : 'list';
  const full = search.get('detail') === 'full';
  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(search);
    if (value === null) next.delete(key);
    else next.set(key, value);
    navigate(`/atlas/${p.id}${next.size > 0 ? `?${next}` : ''}`, { replace: true, keepScroll: true });
  };
  const jumpTo = (node: string) => {
    set('node', node);
    requestAnimationFrame(() => {
      const target = document.getElementById('atlas-node-' + node);
      target?.querySelector<HTMLElement>('.atlas-step-head')?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    });
  };
  return (
    <div className="atlas-page">
      <header className="folio-head">
        <div className="kicker">
          <Link to="/atlas">절차 도해</Link>
          <span>{GROUP_KO[p.group]}</span>
        </div>
        <h1 className="folio-title">
          {p.ko}
          <span className="en" lang="en">{p.en}</span>
        </h1>
        <div className="marks">
          <VChip v={p.verification} />
          <Cite source={p.source} />
        </div>
        <div className="actions">
          <PinButton id={p.id} />
          <BenchButton id={p.id} />
        </div>
      </header>
      <p className="summary atlas-summary">{p.summary}</p>
      {p.id === 'p-explore-room' && <ExplorationTools />}
      {p.id === 'p-attack' && <AttackComparison />}
      <div className="atlas-controls">
        <div className="seg" role="group" aria-label="절차 보기">
          <button type="button" aria-pressed={view === 'list'} onClick={() => set('view', 'list')}>단계 목록</button>
          <button type="button" aria-pressed={view === 'plan'} onClick={() => set('view', 'plan')}>도면</button>
        </div>
        {view === 'list' && (
          <button type="button" className="btn ghost" onClick={() => set('detail', full ? null : 'full')}>{full ? '간략히 보기' : '모두 펼치기'}</button>
        )}
      </div>
      {view === 'plan' ? (
        <div className="atlas-drawing-layout">
          <Plan key={p.id} p={p} selected={(active ?? start).id} onSelect={(node) => set('node', node)} />
          <Inspector p={p} node={active ?? start} onSelect={(node) => set('node', node)} />
        </div>
      ) : (
        <Outline p={p} selected={active?.id} full={full} onToggle={(node) => set('node', active?.id === node ? null : node)} onJump={jumpTo} />
      )}
      <div className="atlas-notes">
        <Notes notes={p.notes} />
        <details className="atlas-details">
          <summary>원본 자료</summary>
          <ul className="atlas-source-links">
            {p.source.map(({ book, pages }) => (
              <li key={book}>
                <a href={SOURCE_URLS[book] + (book === 'rr' && pages.length ? `#page=${pages[0]}` : '')} target="_blank" rel="noreferrer">
                  {BOOK_LABEL[book]}{pages.length && (book === 'core' || book === 'rr') ? ` · ${pages.join(', ')}쪽` : ''}
                </a>
                {book === 'core' && <span>공식 배포처</span>}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}

function ExplorationTable({ id, label, condition }: { id: string; label: string; condition?: string }) {
  const table = tableById.get(id);
  if (!table) return null;
  return (
    <ContextLink id={id} className="atlas-quick-item">
      <span>{label}</span><span className="atlas-quick-die">{table.dice}</span>
      {condition && <span className="atlas-quick-condition">{condition}</span>}
    </ContextLink>
  );
}

function ExplorationTools() {
  const [showTension, setShowTension] = useState(false);
  const [tension, setTension] = useState<{ sides: number; value: number } | null>(null);
  return (
    <section className="atlas-quick-tools" aria-labelledby="atlas-quick-title">
      <h2 id="atlas-quick-title">탐험 바로가기</h2>
      <div className="atlas-quick-grid">
        <ExplorationTable id="t-room-shape" label="방·통로 모양" />
        <button type="button" className="atlas-quick-item" aria-expanded={showTension} aria-controls="atlas-tension-tool" onClick={() => setShowTension(!showTension)}>
          <span>긴장 주사위</span><span className="atlas-quick-die">D8 · D6 · D4</span>
        </button>
        <ExplorationTable id="t-encounter-check" label="조우 판정" condition="새 장소 · 은신처 제외" />
        <ExplorationTable id="t-events" label="이벤트" condition="조우가 없는 새 방" />
      </div>
      <div id="atlas-tension-tool" className="atlas-tension-tool" hidden={!showTension}>
        <div className="atlas-tension-rolls" role="group" aria-label="긴장 주사위 굴리기">
          {[8, 6, 4].map((sides) => (
            <button key={sides} type="button" className="btn ghost" aria-label={`D${sides} 굴리기`} onClick={() => setTension({ sides, value: rollDie(sides) })}>
              D{sides}
            </button>
          ))}
        </div>
        <div className="atlas-tension-result" role="status">
          {tension && <><span className="atlas-quick-die">D{tension.sides} 결과</span> <span className="readout">{tension.value}</span></>}
        </div>
        <div className="atlas-refs">
          <XRef id="tension-die">긴장 주사위 규칙</XRef>
          <XRef id="t-growing-darkness">짙어지는 어둠 (D4에서 1–2)</XRef>
        </div>
      </div>
      <div className="atlas-refs atlas-quick-related">
        <XRef id="lair-check">은신처 판정 (미발견)</XRef>
        <XRef id="domain-exit-check">출구 판정 (은신처 발견 후)</XRef>
        <XRef id="t-encounter-general">조우 표 선택 (일반 도메인 조우)</XRef>
      </div>
    </section>
  );
}

function AttackComparison() {
  const ruling = rulingById.get('q-both-fail');
  const attack = entryById.get('attack-check');
  if (!ruling?.matrix || !attack) return null;
  return (
    <div className="atlas-attack">
      <div className="atlas-attack-links">
        {['multiple-targets', 'defense-reaction-penalty', 'damage-pool', 'armor'].map((id) => <XRef key={id} id={id} />)}
      </div>
      <details className="atlas-details">
        <summary>공격·방어 결과 비교</summary>
        <div className="atlas-comparison-body">
          <RulingMatrix matrix={ruling.matrix} compare />
          <p>{ruling.answer}</p>
          <ul className="bullets">
            {ruling.exceptions?.map((text) => <li key={text}>{text}</li>)}
          </ul>
          <details className="atlas-details">
            <summary>판정 전에 확인할 예외</summary>
            <ul className="bullets">
              {attack.exceptions?.map((text) => <li key={text}>{text}</li>)}
            </ul>
          </details>
          <div className="atlas-refs">
            {['opposed-check', 'defensive-move', 'fumble', 'sacrifice-gear', 'prone'].map((id) => <XRef key={id} id={id} showKind />)}
          </div>
          <Cite source={ruling.source} />
        </div>
      </details>
    </div>
  );
}

function Refs({ node }: { node: ProcNode }) {
  const refs = [...new Set([...(node.refs ?? []), ...(node.tables ?? [])])];
  return refs.length > 0 && <div className="atlas-refs">{refs.map((id) => <XRef key={id} id={id} showKind />)}</div>;
}

function Branches({ p, node, onSelect }: { p: Procedure; node: ProcNode; onSelect: (id: string) => void }) {
  const outgoing = p.edges.filter((e) => e.from === node.id);
  if (outgoing.length === 0) return null;
  return (
    <div className="atlas-branches">
      <b>{outgoing.length > 1 ? '분기와 이어지는 단계' : '이어서'}</b>
      <ul>
        {outgoing.map((edge) => (
          <li key={edge.to}>
            <BranchLink edge={edge} title={p.nodes.find((n) => n.id === edge.to)!.title} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BranchLink({ edge, title, onSelect }: { edge: ProcEdge; title: string; onSelect: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(edge.to)}>
      {edge.label && <span className="atlas-branch-condition">{edge.label}</span>}
      <span>{title}</span>
      <span className="atlas-branch-arrow" aria-hidden="true">›</span>
    </button>
  );
}

function NodeLabel({ node }: { node: ProcNode }) {
  return (
    <span className="atlas-node-label">
      <span>{KIND_KO[node.kind]}</span>
      {node.need && <span className={`need-pill ${node.need}`}><i aria-hidden="true" /> {NEED_KO[node.need]}</span>}
    </span>
  );
}

function Inspector({ p, node, onSelect }: { p: Procedure; node: ProcNode; onSelect: (id: string) => void }) {
  const incoming = p.edges.filter((e) => e.to === node.id);
  return (
    <aside className="atlas-inspector" aria-label="선택한 단계">
      <div className={`atlas-inspector-title k-${node.kind}`} aria-live="polite">
        <NodeLabel node={node} />
        <h2>{node.title}</h2>
        <p>{node.body}</p>
      </div>
      <Refs node={node} />
      <Branches p={p} node={node} onSelect={onSelect} />
      {incoming.length > 0 && (
        <div className="atlas-inspector-previous">
          <b>이어져 온 단계</b>
          {incoming.map((e) => (
            <button type="button" className="btn ghost" key={e.from} onClick={() => onSelect(e.from)}>
              {p.nodes.find((n) => n.id === e.from)!.title}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function Outline({
  p, selected, full, onToggle, onJump,
}: {
  p: Procedure;
  selected?: string;
  full: boolean;
  onToggle: (id: string) => void;
  onJump: (id: string) => void;
}) {
  const ordered = [...p.nodes].sort((a, b) => a.row - b.row || a.col - b.col);
  return (
    <ol className="atlas-outline" aria-label="절차 단계">
      {ordered.map((node) => {
        const current = selected === node.id;
        const expanded = full || current;
        const contentId = 'atlas-content-' + node.id;
        return (
          <li key={node.id} id={'atlas-node-' + node.id} className={`atlas-step k-${node.kind}`} data-current={current || undefined}>
            {full ? (
              <h2 className="atlas-step-head" tabIndex={-1}>
                <NodeLabel node={node} />
                <span className="atlas-step-title">{node.title}</span>
              </h2>
            ) : (
              <h2>
                <button type="button" className="atlas-step-head" aria-expanded={expanded} aria-controls={contentId} onClick={() => onToggle(node.id)}>
                  <NodeLabel node={node} />
                  <span className="atlas-step-title">{node.title}</span>
                  <span className="atlas-step-toggle" aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
              </h2>
            )}
            <div id={contentId} className="atlas-step-body" hidden={!expanded}>
              <p>{node.body}</p>
              {expanded && <Refs node={node} />}
              {expanded && <Branches p={p} node={node} onSelect={onJump} />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
