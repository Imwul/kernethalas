import { useEffect, useRef, useState } from 'react';
import { entryById, tableById, procById, rulingById, hrefOf, titleOf, kindOf } from '../content';
import { Link } from '../lib/router';
import { nav, OPEN_MAX, useNav } from '../lib/store';
import { BENCH_SET_NAME_MAX, benchSetName, readBenchSets, storeBenchSets, type BenchLayout, type BenchSet } from '../lib/workbench-sets';
import { EntryBody } from '../components/EntryBody';
import { IClose, IDown, IUp } from '../components/icons';
import { KIND_KO } from '../components/Plan';
import { procedureTools } from '../components/procedure-tools';
import { Notes, XRef } from '../components/bits';
import { LedgerItem } from './Home';
import { OracleBody } from './Oracle';
import '../styles/workbench.css';

const KIND_SHORT: Record<string, string> = { entry: '항목', table: '표', procedure: '절차', ruling: '문답' };
const PRESETS = [
  { label: '전투', ids: ['p-attack', 'conditions'] },
  { label: '탐험', ids: ['t-room-shape', 'p-tension', 't-encounter-general'] },
] as const;

function BenchPresets() {
  const { open } = useNav();
  const [feedback, setFeedback] = useState<{ open: string[]; text: string }>();

  return (
    <div className="bench-presets">
      <div className="bench-preset-buttons" role="group" aria-label="작업대 프리셋">
        {PRESETS.map(({ label, ids }) => (
          <button className="btn ghost" key={label} type="button" onClick={() => {
            const { added, missingSlots } = nav.openPreset(ids);
            const text = missingSlots
              ? `${label} 프리셋에 빈자리가 ${missingSlots}개 더 필요합니다. 펼친 항목을 닫아 주세요.`
              : added ? `${label} 프리셋의 항목 ${added}개를 펼쳤습니다.`
                : `${label} 프리셋의 항목이 이미 펼쳐져 있습니다.`;
            setFeedback({ open: nav.get().open, text });
          }}>{label} 프리셋 펼치기</button>
        ))}
      </div>
      <p className="bench-preset-feedback" role="status">{feedback?.open === open && feedback.text}</p>
    </div>
  );
}

function SavedBenchSets({ layout, onRestore }: { layout: BenchLayout; onRestore: (set: BenchSet) => void }) {
  const { open, active } = useNav();
  const [sets, setSets] = useState(() => readBenchSets() ?? []);
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const temporary = useRef(false);

  const currentList = () => temporary.current ? sets : readBenchSets() ?? sets;
  const updateSets = (next: BenchSet[], text: string) => {
    temporary.current = !storeBenchSets(next);
    setSets(next);
    setFeedback(temporary.current ? `${text} 작업대를 열어 둔 동안만 남습니다.` : text);
  };

  return (
    <details className="fold bench-saved">
      <summary>내 작업대 세트</summary>
      <div className="bench-saved-body">
        {open.length > 0 && (
          <form className="bench-saved-form" onSubmit={(event) => {
            event.preventDefault();
            const current = currentList();
            const title = benchSetName(name);
            if (!title || title.length > BENCH_SET_NAME_MAX) return;
            if (current.some((set) => set.name === title)) {
              setFeedback('같은 이름의 세트가 있습니다. 다른 이름을 입력하세요.');
              return;
            }
            updateSets([{ id: crypto.randomUUID(), name: title, open: [...open], active, layout }, ...current], `${title} 저장 완료`);
            setName('');
          }}>
            <label className="field">
              <span>작업대 세트 이름</span>
              <input value={name} maxLength={BENCH_SET_NAME_MAX} placeholder="예: Overseer 전투"
                onChange={(event) => setName(event.target.value)} />
            </label>
            <button className="btn ghost" type="submit" disabled={!benchSetName(name)}>현재 배치 저장</button>
          </form>
        )}
        {sets.length > 0 ? (
          <ul className="bench-saved-list">
            {sets.map((set) => {
              const closing = open.filter((id) => !set.open.includes(id)).length;
              const restore = () => {
                onRestore(set);
                setFeedback(`${set.name} 배치를 열었습니다.`);
                setConfirm(null);
              };
              return (
                <li key={set.id} className="bench-saved-row">
                  <div>
                    <strong>{set.name}</strong>
                    <span>{set.open.length}개 항목 · {set.layout === 'tabs' ? '탭' : '나란히'}</span>
                  </div>
                  <div className="bench-saved-controls">
                    <button className="btn ghost" type="button" aria-label={`${set.name} 세트 열기`} onClick={() => {
                      if (closing) setConfirm(set.id);
                      else restore();
                    }}>세트 열기</button>
                    <button className="iconbtn" type="button" aria-label={`${set.name} 세트 삭제`} title="세트 삭제" onClick={() => {
                      updateSets(currentList().filter((item) => item.id !== set.id), `${set.name} 세트를 삭제했습니다.`);
                      if (confirm === set.id) setConfirm(null);
                    }}><IClose /></button>
                  </div>
                  {confirm === set.id && (
                    <div className="bench-saved-confirm">
                      <p>현재 항목 {closing}개를 닫고 이 세트를 엽니다.</p>
                      <button className="btn primary" type="button" onClick={restore}>배치 바꾸기</button>
                      <button className="btn ghost" type="button" onClick={() => setConfirm(null)}>취소</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : open.length === 0 && <p>항목을 펼친 뒤 배치에 이름을 붙여 저장하세요.</p>}
        {feedback && <p className="bench-preset-feedback" role="status">{feedback}</p>}
      </div>
    </details>
  );
}

export function PaneBody({ id }: { id: string }) {
  const e = entryById.get(id);
  if (e) return <EntryBody e={e} compact />;
  const t = tableById.get(id);
  if (t) return <TablePane id={id} />;
  const p = procById.get(id);
  if (p) {
    const Tool = procedureTools[id];
    const outline = (
      <ol className="steps">
        {[...p.nodes]
          .sort((a, b) => a.row - b.row || a.col - b.col)
          .map((n) => (
            <li key={n.id}>
              <b className="ko-display" style={{ fontWeight: 400 }}>
                {n.title}
              </b>{' '}
              <span className="kicker">{KIND_KO[n.kind]}</span>
              <div>{n.body}</div>
            </li>
          ))}
      </ol>
    );
    return (
      <div className="bench-procedure">
        <p className="summary">{p.summary}</p>
        {Tool ? (
          <>
            <Tool />
            <details className="fold bench-tool-outline">
              <summary>절차 순서</summary>
              {outline}
              <Notes notes={p.notes} />
            </details>
          </>
        ) : outline}
      </div>
    );
  }
  const r = rulingById.get(id);
  if (r)
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="ans" style={{ margin: 0, fontFamily: 'var(--f-ko)', fontSize: 17 }}>
          {r.answer}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {r.refs.map((x) => <XRef key={x} id={x} showKind />)}
        </div>
      </div>
    );
  return <p className="muted">항목을 찾을 수 없습니다.</p>;
}

function TablePane({ id }: { id: string }) {
  const t = tableById.get(id)!;
  const [v, setV] = useState<number | null>(null);
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <p className="usage" style={{ margin: 0, fontSize: 15 }}>
        {t.usage}
      </p>
      <OracleBody t={t} value={v} onValue={setV} compact />
    </div>
  );
}

export function Pane({ id, onFocus, tab, hidden }: { id: string; onFocus?: () => void; tab?: boolean; hidden?: boolean }) {
  const k = kindOf(id);
  return (
    <section className="pane" aria-label={titleOf(id).ko} onFocus={onFocus} hidden={hidden}
      role={tab ? 'tabpanel' : undefined} id={tab ? `bench-panel-${id}` : undefined}
      aria-labelledby={tab ? `bench-tab-${id}` : undefined}>
      <div className="pane-head">
        <span className="pk">{k ? KIND_SHORT[k] : ''}</span>
        <Link to={hrefOf(id)}>{titleOf(id).ko}</Link>
        <button className="iconbtn" onClick={() => nav.close(id)} aria-label={`${titleOf(id).ko} 닫기`}>
          <IClose />
        </button>
      </div>
      <div className="pane-body">
        <PaneBody id={id} />
      </div>
    </section>
  );
}

export function Workbench() {
  const { open, active, pins, recent } = useNav();
  const [layout, setLayout] = useState<BenchLayout>('columns');
  const cur = active && open.includes(active) ? active : open[open.length - 1];
  const [undo, setUndo] = useState<{ msg: string; run: () => void } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);
  const closeAll = () => {
    const prev = nav.closeAll();
    setUndo({ msg: `펼친 항목 ${prev.open.length}개를 닫았습니다.`, run: () => nav.restoreOpen(prev) });
  };
  const clearRecent = () => {
    const prev = nav.clearRecent();
    setUndo({ msg: `최근 열람 ${prev.length}개를 비웠습니다.`, run: () => nav.restoreRecent(prev) });
  };
  return (
    <div className="bench">
      <div className="undo-bar" role="status" aria-live="polite">
        {undo && (
          <>
            <span>{undo.msg}</span>
            <button
              className="btn ghost"
              onClick={() => {
                undo.run();
                setUndo(null);
              }}
            >
              되돌리기
            </button>
          </>
        )}
      </div>
      <header className="page-head">
        <h1 className="page-title">작업대</h1>
        <p className="lede">규칙을 나란히 펼쳐 비교하고, 자주 쓰는 조합을 작업대 세트로 저장하세요.</p>
      </header>

      <section aria-labelledby="open-h">
        <div className="section-head">
          <h2 id="open-h">펼친 항목 ({open.length}/{OPEN_MAX})</h2>
          <span className="more bench-actions">
            <span className="seg" role="group" aria-label="배치">
              <button aria-pressed={layout === 'columns'} onClick={() => setLayout('columns')}>
                나란히
              </button>
              <button aria-pressed={layout === 'tabs'} onClick={() => setLayout('tabs')}>
                탭
              </button>
            </span>
            {open.length > 0 && (
              <button className="btn ghost" onClick={closeAll}>
                모두 닫기
              </button>
            )}
          </span>
        </div>
        <BenchPresets />
        <SavedBenchSets layout={layout} onRestore={(set) => {
          nav.replaceOpen(set);
          setLayout(set.layout);
        }} />
        {open.length === 0 ? (
          <div className="empty">
            규칙·표·절차 페이지의 <b>작업대에 펼치기</b> 버튼이나 검색 창의 <kbd>Shift</kbd>+<kbd>Enter</kbd>로 항목을 펼치세요.
          </div>
        ) : (
          <>
            {layout === 'tabs' && <div className="bench-tabs" role="tablist" aria-label="펼친 항목">
              {open.map((id, index) => (
                <div key={id} className="bench-tab" role="presentation" data-current={id === cur}>
                  <button type="button" role="tab" id={`bench-tab-${id}`} aria-controls={`bench-panel-${id}`}
                    aria-selected={id === cur} tabIndex={id === cur ? 0 : -1} onClick={() => nav.activate(id)}
                    onKeyDown={(event) => {
                      const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
                      const target = offset ? (index + offset + open.length) % open.length
                        : event.key === 'Home' ? 0 : event.key === 'End' ? open.length - 1 : -1;
                      if (target < 0) return;
                      event.preventDefault();
                      const next = open[target];
                      nav.activate(next);
                      document.getElementById(`bench-tab-${next}`)?.focus();
                    }}><span>{titleOf(id).ko}</span></button>
                  <button
                    className="x"
                    type="button"
                    aria-label={`${titleOf(id).ko} 닫기`}
                    onClick={() => nav.close(id)}
                  >
                    <IClose />
                  </button>
                </div>
              ))}
            </div>}
            <div className={`bench-cols ${layout === 'columns' && open.length > 1 ? 'multi' : ''}`}>
              {open.map((id) => (
                <Pane key={id} id={id} onFocus={layout === 'columns' ? () => nav.activate(id) : undefined}
                  tab={layout === 'tabs'} hidden={layout === 'tabs' && cur !== id} />
              ))}
            </div>
          </>
        )}
      </section>

      <div className="home-grid">
        <section aria-labelledby="pins-h">
          <div className="section-head">
            <h2 id="pins-h">고정 항목</h2>
          </div>
          {pins.length === 0 ? (
            <div className="empty">고정한 항목이 없습니다.</div>
          ) : (
            <ul className="ledger">
              {pins.map((id, i) => (
                <li key={id} className="pin-row">
                  <ul className="ledger" style={{ border: 0 }}>
                    <LedgerItem id={id} />
                  </ul>
                  <span className="pin-actions">
                    <button className="iconbtn reorder" aria-label={`${titleOf(id).ko} 위로 옮기기`} title="위로 옮기기" disabled={i === 0} onClick={() => nav.movePin(id, -1)}>
                      <IUp />
                    </button>
                    <button className="iconbtn reorder" aria-label={`${titleOf(id).ko} 아래로 옮기기`} title="아래로 옮기기" disabled={i === pins.length - 1} onClick={() => nav.movePin(id, 1)}>
                      <IDown />
                    </button>
                    <button className="iconbtn" aria-label={`${titleOf(id).ko} 작업대에 펼치기`} title="작업대에 펼치기" onClick={() => nav.open(id)}>
                      +
                    </button>
                    <button className="iconbtn" aria-label={`${titleOf(id).ko} 고정 해제`} title="고정 해제" onClick={() => nav.togglePin(id)}>
                      <IClose />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="rec-h">
          <div className="section-head">
            <h2 id="rec-h">최근 열람</h2>
            {recent.length > 0 && (
              <button className="more linkbtn" onClick={clearRecent}>
                비우기
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <div className="empty">최근 열람한 항목이 없습니다.</div>
          ) : (
            <ul className="ledger">
              {recent.map((id) => (
                <LedgerItem key={id} id={id} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/** Ultrawide dock: open panes live beside whatever page you are reading. */
export function Dock() {
  const { open } = useNav();
  return (
    <aside className="dock" aria-label="작업대 도크">
      <div>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 style={{ fontSize: 19 }}>펼친 항목</h2>
          <Link to="/workbench" className="more">
            작업대 →
          </Link>
        </div>
        <BenchPresets />
      </div>
      {open.length === 0 ? (
        <div className="empty">
          넓은 화면에서는 펼친 항목이 이곳에 계속 머뭅니다. 아무 페이지에서나 <b>작업대에 펼치기</b>를 눌러 보세요.
        </div>
      ) : (
        <div className="dock-panes">
          {open.map((id) => (
            <Pane key={id} id={id} />
          ))}
        </div>
      )}
    </aside>
  );
}
