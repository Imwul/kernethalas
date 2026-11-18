import { useMemo } from 'react';
import { entries, entryById, CATEGORY_LABEL, hrefOf } from '../content';
import type { Category, Entry } from '../content/schema';
import { Link, navigate, useLocation } from '../lib/router';
import { EntryBody } from '../components/EntryBody';
import { BenchButton, CopyButton, PinButton, useVisit, V_LABEL } from '../components/bits';
import { NotFound } from './NotFound';

const ORDER: Category[] = ['core', 'combat', 'conditions', 'health', 'survival', 'exploration', 'overseers', 'creatures', 'equipment', 'loot', 'character'];

/** Split a plate into labelled groups when it mixes kinds (Character: rules, 20 Masteries, minion stat blocks). */
function subgroups(items: Entry[]): [string, Entry[]][] {
  const mastery = items.filter((e) => e.tags?.includes('Mastery'));
  const minion = items.filter((e) => e.kind === 'creature');
  if (!mastery.length && !(minion.length && minion.length < items.length)) return [['', items]];
  const rest = items.filter((e) => !mastery.includes(e) && !minion.includes(e));
  const out: [string, Entry[]][] = [];
  if (rest.length) out.push(['규칙 · Rules', rest]);
  if (mastery.length) out.push(['Mastery 20종 · Masteries', mastery]);
  if (minion.length) out.push(['Mastery Minion · 소환수', minion]);
  return out;
}

export function ReferenceIndex() {
  const { search } = useLocation();
  const cat = (search.get('c') as Category | null) ?? null;
  const v = search.get('v');
  const list = useMemo(() => entries.filter((e) => (!cat || e.category === cat) && (!v || e.verification === v)), [cat, v]);
  const counts = useMemo(() => Object.fromEntries(ORDER.map((c) => [c, entries.filter((e) => e.category === c).length])), []);
  const setQ = (k: string, val: string | null) => {
    const p = new URLSearchParams(search);
    if (val) p.set(k, val);
    else p.delete(k);
    navigate(`/ref${p.toString() ? `?${p}` : ''}`, { replace: true, keepScroll: true });
  };
  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">
          규칙 색인
        </h1>
        <p className="lede">규칙·상태·생물·장비 전체. 항목마다 원본 쪽수와 검증 상태를 표시합니다.</p>
      </header>
      <div className="filterbar" role="group" aria-label="범주">
        <button aria-pressed={!cat} onClick={() => setQ('c', null)}>
          전체<span className="count">{entries.length}</span>
        </button>
        {ORDER.map((c) => (
          <button key={c} aria-pressed={cat === c} onClick={() => setQ('c', c)}>
            {CATEGORY_LABEL[c].ko}
            <span className="count">{counts[c]}</span>
          </button>
        ))}
      </div>
      <div className="filterbar" role="group" aria-label="검증 상태">
        {(['verified', 'discrepancy', 'ambiguous', 'partial'] as const).map((s) => (
          <button key={s} aria-pressed={v === s} onClick={() => setQ('v', v === s ? null : s)}>
            {V_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="plates">
        {!list.length && <p className="empty" role="status">선택한 조건에 맞는 항목이 없습니다.</p>}
        {ORDER.filter((c) => list.some((e) => e.category === c)).map((c) => (
          <section key={c} className="plate-sec" aria-labelledby={`cat-${c}`}>
            <div className="section-head">
              <h2 id={`cat-${c}`}>{CATEGORY_LABEL[c].ko}</h2>
              {(c === 'creatures' || c === 'overseers') && (
                <Link to={c === 'overseers' ? '/bestiary?g=overseer' : '/bestiary?g=creature'} className="more">
                  수치 비교는 도감에서 →
                </Link>
              )}
            </div>
            {subgroups(list.filter((e) => e.category === c)).map(([label, items]) => (
              <div key={label || 'all'}>
                {label && (
                  <h3 className="subhead">
                    {label}
                    <span className="count">{items.length}</span>
                  </h3>
                )}
                <div className="entries">
                  {items.map((e) => (
                    <Link key={e.id} to={`/ref/${e.id}`} className="entry-line">
                      <span>
                        <span className="et">{e.ko}</span>
                      </span>
                      <span className={`vd v-${e.verification}`} title={V_LABEL[e.verification]} />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function ReferencePage({ id }: { id: string }) {
  const e = entryById.get(id);
  useVisit(e?.id);
  if (!e) return <NotFound />;
  return (
    <div className="record reference-record">
      <EntryBody e={e} actions={<>
        <PinButton id={e.id} />
        <BenchButton id={e.id} />
        <CopyButton text={new URL(hrefOf(e.id), window.location.origin).href} label="규칙 링크 복사" />
      </>} />
    </div>
  );
}
