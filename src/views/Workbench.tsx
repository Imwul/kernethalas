import { useEffect, useState } from 'react';
import { entryById, tableById, procById, rulingById, hrefOf, titleOf, kindOf } from '../content';
import { Link } from '../lib/router';
import { nav, useNav } from '../lib/store';
import { EntryBody } from '../components/EntryBody';
import { IClose, IDown, IUp } from '../components/icons';
import { KIND_KO } from '../components/Plan';
import { XRef } from '../components/bits';
import { LedgerItem } from './Home';
import { OracleBody } from './Oracle';

const KIND_SHORT: Record<string, string> = { entry: '항목', table: '표', procedure: '절차', ruling: '문답' };

export function PaneBody({ id }: { id: string }) {
  const e = entryById.get(id);
  if (e) return <EntryBody e={e} compact />;
  const t = tableById.get(id);
  if (t) return <TablePane id={id} />;
  const p = procById.get(id);
  if (p)
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        <p className="summary" style={{ margin: 0 }}>
          {p.summary}
        </p>
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
      </div>
    );
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

export function Pane({ id, onFocus }: { id: string; onFocus?: () => void }) {
  const k = kindOf(id);
  return (
    <section className="pane" aria-label={titleOf(id).ko} onFocus={onFocus}>
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
  const [layout, setLayout] = useState<'tabs' | 'columns'>('columns');
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
        <p className="lede">규칙을 나란히 펼쳐 비교합니다. 게임 진행은 기록하지 않고 펼친 항목·Pin·최근 열람만 이 브라우저에 남습니다.</p>
      </header>

      <section aria-labelledby="open-h">
        <div className="section-head">
          <h2 id="open-h">펼친 항목 ({open.length}/8)</h2>
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
        {open.length === 0 ? (
          <div className="empty">
            규칙·표·절차 페이지의 <b>작업대에 펼치기</b> 버튼이나 검색 창의 <kbd>Shift</kbd>+<kbd>Enter</kbd>로 항목을 펼치세요.
          </div>
        ) : layout === 'tabs' ? (
          <>
            <div className="bench-tabs" role="tablist">
              {open.map((id) => (
                <div key={id} className="bench-tab" role="tab" aria-selected={id === cur} tabIndex={0} onClick={() => nav.activate(id)} onKeyDown={(e) => e.key === 'Enter' && nav.activate(id)}>
                  <span>{titleOf(id).ko}</span>
                  <button
                    className="x"
                    aria-label={`${titleOf(id).ko} 닫기`}
                    onClick={(e) => {
                      e.stopPropagation();
                      nav.close(id);
                    }}
                  >
                    <IClose />
                  </button>
                </div>
              ))}
            </div>
            {cur && <Pane id={cur} />}
          </>
        ) : (
          <div className={`bench-cols ${open.length > 1 ? 'multi' : ''}`}>
            {open.map((id) => (
              <Pane key={id} id={id} onFocus={() => nav.activate(id)} />
            ))}
          </div>
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
      <div className="section-head" style={{ marginBottom: 0 }}>
        <h2 style={{ fontSize: 19 }}>펼친 항목</h2>
        <Link to="/workbench" className="more">
          작업대 →
        </Link>
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
