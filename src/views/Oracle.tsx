import { useMemo, useRef, useState, type ReactNode } from 'react';
import { tables, tableById, TABLE_GROUP_LABEL } from '../content';
import type { OracleTable } from '../content/schema';
import { ENCOUNTER_PLACES, encounterRowsForPlace, type EncounterPlace } from '../content/tables/exploration';
import { Link, navigate, useLocation } from '../lib/router';
import { TableView } from '../components/TableView';
import { CheckCalculator } from '../components/CheckCalculator';
import { Roller } from '../components/Roller';
import { RulingNote } from '../components/RulingNote';
import type { RoomShapeState } from '../components/RoomShapeDiagram';
import { BenchButton, Cite, Notes, PinButton, Relations, VChip, useVisit } from '../components/bits';
import { IDie, IPin, ISearch } from '../components/icons';
import { roll, tableSides } from '../lib/dice';
import { automaticRollSides, quickRollHref, readOracleValue } from '../lib/oracle';
import { docs, search as searchContent } from '../lib/search';
import { nav, useNav } from '../lib/store';
import { NotFound } from './NotFound';
import '../styles/oracle.css';

const GROUPS = ['exploration', 'combat', 'survival', 'creatures', 'loot', 'magic-items', 'character', 'flavor'];

export function OracleIndex() {
  const { search } = useLocation();
  const { pins } = useNav();
  const group = search.get('g') ?? '';
  const lookup = search.get('lookup');
  const favorites = search.get('pins') === '1';
  const query = search.get('q') ?? '';
  const matches = useMemo(() => {
    if (!query.trim()) return tables;
    return searchContent(query, docs.length, 'table')
      .flatMap(({ doc }) => {
        const table = tableById.get(doc.id);
        return table ? [table] : [];
      });
  }, [query]);
  const list = matches.filter((t) =>
    (!group || t.group === group) && (lookup === null || (t.dice === '—') === (lookup === '1')) && (!favorites || pins.includes(t.id)),
  );
  const setQ = (k: string, v: string | null) => {
    const p = new URLSearchParams(search);
    if (v) p.set(k, v);
    else p.delete(k);
    const next = p.toString();
    navigate(`/oracle${next ? `?${next}` : ''}`, { replace: true, keepScroll: true });
  };
  const clear = () => navigate('/oracle', { replace: true, keepScroll: true });

  return (
    <div className="oracle-index">
      <header className="page-head oracle-index-head">
        <h1 className="page-title">무작위 표</h1>
        <a className="btn ghost" href="#oracle-tools">주사위 · 판정 도구</a>
      </header>
      <div className="oracle-query">
        <label htmlFor="oracle-query">표 검색</label>
        <div>
          <ISearch />
          <input id="oracle-query" type="search" value={query} placeholder="표 이름이나 상황 입력"
            onChange={(e) => setQ('q', e.target.value)} />
        </div>
      </div>
      <div className="oracle-filters">
        <div className="seg" role="group" aria-label="표 종류">
          <button type="button" aria-pressed={lookup === null} onClick={() => setQ('lookup', null)}>전체</button>
          <button type="button" aria-pressed={lookup === '0'} onClick={() => setQ('lookup', '0')}>굴리는 표</button>
          <button type="button" aria-pressed={lookup === '1'} onClick={() => setQ('lookup', '1')}>조회표</button>
        </div>
        <label className="sr-only" htmlFor="oracle-category">표 분류</label>
        <select id="oracle-category" value={group} onChange={(e) => setQ('g', e.target.value)}>
          <option value="">모든 분류</option>
          {GROUPS.map((x) => <option key={x} value={x}>{TABLE_GROUP_LABEL[x]}</option>)}
        </select>
        <button className="btn ghost" type="button" aria-pressed={favorites} onClick={() => setQ('pins', favorites ? null : '1')}>
          <IPin /> 즐겨찾기
        </button>
        <span className="oracle-count" role="status">{list.length}개 표</span>
      </div>
      {list.length === 0 ? (
        <div className="empty oracle-empty">
          <p>{favorites ? '현재 조건에 맞는 즐겨찾기가 없습니다.' : '현재 조건에 맞는 표가 없습니다.'}</p>
          <button className="btn ghost" type="button" onClick={clear}>검색 조건 지우기</button>
        </div>
      ) : query.trim() || group || favorites ? (
        <OracleList list={list} pins={pins} />
      ) : (
        GROUPS.map((x) => {
          const inGroup = list.filter((t) => t.group === x);
          return inGroup.length > 0 && (
            <section className="oracle-group" key={x} aria-labelledby={`og-${x}`}>
              <h2 id={`og-${x}`}>{TABLE_GROUP_LABEL[x]}</h2>
              <OracleList list={inGroup} pins={pins} />
            </section>
          );
        })
      )}
      <section id="oracle-tools" aria-labelledby="oracle-tools-h">
        <div className="section-head">
          <h2 id="oracle-tools-h">주사위 · 판정 도구</h2>
        </div>
        <div className="oracle-tools">
          <DiceTray />
          <CheckCalculator />
        </div>
      </section>
    </div>
  );
}

function OracleList({ list, pins }: { list: OracleTable[]; pins: string[] }) {
  return (
    <ul className="oracle-ledger">
      {list.map((t) => {
        const pinned = pins.includes(t.id);
        const canRoll = automaticRollSides(t) !== null;
        return (
          <li key={t.id}>
            <span className="oracle-ledger-die">{t.dice === '—' ? '조회' : t.dice}</span>
            <Link to={`/oracle/${t.id}`} className="oracle-ledger-entry">
              <strong>{t.ko}</strong>
              <span className="oracle-ledger-en" lang="en">{t.en}</span>
              <span className="oracle-ledger-usage">{t.usage}</span>
            </Link>
            <div className="oracle-ledger-actions">
              {canRoll && (
                <button className="btn ghost" type="button" aria-label={`${t.ko} ${t.dice} 굴리기`} onClick={() => {
                  const href = quickRollHref(t);
                  if (href) navigate(href);
                }}>
                  <IDie /> 굴리기
                </button>
              )}
              <button className="iconbtn pinbtn" type="button" aria-pressed={pinned}
                aria-label={`${t.ko} 즐겨찾기`} title={pinned ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                onClick={() => nav.togglePin(t.id)}>
                <IPin />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function DiceTray() {
  const [out, setOut] = useState<{ expr: string; dice: number[]; total: number } | null>(null);
  const [expr, setExpr] = useState('2D6+2');
  const [err, setErr] = useState(false);
  const r = (e: string) => {
    const res = roll(e);
    setErr(!res);
    setOut(res);
  };
  return (
    <div className="roller">
      <span className="kicker">자유 굴림</span>
      <div className="tray">
        {['D4', 'D6', 'D8', 'D10', 'D12', 'D20', 'D100'].map((d) => (
          <button key={d} onClick={() => r(d)}>
            {d}
          </button>
        ))}
      </div>
      <form
        className="manual"
        onSubmit={(e) => {
          e.preventDefault();
          r(expr);
        }}
      >
        <label htmlFor="expr">식</label>
        <input
          id="expr"
          value={expr}
          aria-invalid={err || undefined}
          aria-describedby={err ? 'expr-err' : undefined}
          onChange={(e) => {
            setExpr(e.target.value);
            if (err) setErr(false);
          }}
          style={{ width: 120 }}
        />
        <button className="btn ghost" type="submit">
          굴리기
        </button>
      </form>
      {err && (
        <p id="expr-err" className="field-err">
          이 식은 굴릴 수 없습니다. D6, 2D6+2, 3D4처럼 적어 주세요.
        </p>
      )}
      <div className="aperture">
        <div className={`readout ${out ? '' : 'idle'}`}>{out ? out.total : '—'}</div>
        <div className="readout-meta">
          {out ? (
            <>
              <span>{out.expr}</span>
              <span>[{out.dice.join(', ')}]</span>
              <span className="muted">피해 풀이라면 합산하지 말고 하나를 고르세요(적은 최고값).</span>
            </>
          ) : (
            <span>예: D6, 2D6+2, 3D4</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface OracleBodyProps {
  t: OracleTable;
  value: number | null;
  onValue: (value: number | null) => void;
  only?: boolean;
  onOnly?: (only: boolean) => void;
  encounterPlace?: EncounterPlace | null;
  onEncounterPlace?: (place: EncounterPlace | null) => void;
  compact?: boolean;
  collapseTableBeforeRoll?: boolean;
  tableDisclosure?: 'hidden' | 'revealed';
  rollLabel?: string;
  sourceForRow?: (row: OracleTable['rows'][number]) => string | undefined;
  roomShape?: RoomShapeState;
  afterResult?: ReactNode;
  /** Play desk: drop reference-only extras (copy, related links, per-table history). */
  play?: boolean;
}

export function OracleBody({ t, value, onValue, only, onOnly, encounterPlace, onEncounterPlace, compact = false, collapseTableBeforeRoll = false,
  tableDisclosure, rollLabel, sourceForRow, roomShape, afterResult, play = false }: OracleBodyProps) {
  const [localOnly, setLocalOnly] = useState(compact);
  const [localEncounterPlace, setLocalEncounterPlace] = useState<EncounterPlace | null>(null);
  const table = useRef<HTMLDivElement>(null);
  const sides = tableSides(t.dice);
  const resultOnly = tableDisclosure ? tableDisclosure === 'hidden' : only ?? localOnly;
  const showTable = sides === null || !resultOnly || (value === null && !collapseTableBeforeRoll);
  const isEncounter = t.id === 't-encounter-check';
  const place = encounterPlace === undefined ? localEncounterPlace : encounterPlace;
  const contextual = isEncounter && place !== null;
  const activeTable = contextual
    ? { ...t, columns: undefined, rows: encounterRowsForPlace(place) }
    : t;
  return (
    <div className={`oracle-body${compact ? ' compact' : ''}${sides ? ' split' : ''}`}>
      {sides !== null && (
        <Roller
          key={t.id}
          t={activeTable}
          sides={sides}
          value={value}
          onValue={onValue}
          only={resultOnly}
          onOnly={onOnly ?? setLocalOnly}
          rollLabel={rollLabel}
          sourceForRow={sourceForRow}
          roomShape={roomShape}
          afterResult={afterResult}
          play={play}
          showUnrolledViewToggle={collapseTableBeforeRoll}
          hideViewToggle={!!tableDisclosure}
          beforeRoll={isEncounter && (
            <div className="oracle-encounter-place">
              <span aria-hidden="true">장소</span>
              <div className="seg" role="group" aria-label="조우 장소">
                {([null, 'room', 'corridor'] as const).map((choice) => (
                  <button key={choice ?? 'both'} type="button" aria-pressed={place === choice}
                    onClick={() => (onEncounterPlace ?? setLocalEncounterPlace)(choice)}>
                    {choice === null ? '방·통로 비교' : ENCOUNTER_PLACES[choice].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          onShowRow={() => {
            const row = table.current?.querySelector<HTMLTableRowElement>('tr[aria-current="true"]');
            row?.scrollIntoView({ block: 'center' });
            row?.focus({ preventScroll: true });
          }}
        />
      )}
      {tableDisclosure !== 'hidden' && <div className="oracle-table-area">
        <Notes notes={t.notes} />
        {showTable && (
          <div className="oracle-table-sheet" ref={table}>
            <TableView t={activeTable} hit={value} sourceForRow={contextual ? () => '' : sourceForRow} />
          </div>
        )}
        {!play && t.related.length > 0 && (
          <details className="oracle-related" open={!compact}>
            <summary>관련 항목</summary>
            <Relations related={t.related} />
          </details>
        )}
      </div>}
    </div>
  );
}

export function OraclePage({ id }: { id: string }) {
  const t = tableById.get(id);
  const { search } = useLocation();
  useVisit(t?.id);
  if (!t) return <NotFound />;
  const value = readOracleValue(search.get('r'), tableSides(t.dice));
  const only = search.get('view') === 'one';
  const place = search.get('place');
  const encounterPlace = place === 'room' || place === 'corridor' ? place : null;
  const setParam = (key: string, val: string | null) => {
    const params = new URLSearchParams(search);
    if (val === null) params.delete(key);
    else params.set(key, val);
    const next = params.toString();
    navigate(`/oracle/${t.id}${next ? `?${next}` : ''}`, { replace: true, keepScroll: true });
  };
  return (
    <div className="specimen oracle-detail">
      <header className="specimen-head">
        <Link to="/oracle" className="oracle-back">표 목록</Link>
        <h1 className="folio-title">
          {t.ko}
          <span className="en" lang="en">{t.en}</span>
        </h1>
        <p className="usage">{t.usage}</p>
        <div className="oracle-detail-marks">
          <VChip v={t.verification} />
          <Cite source={t.source} />
        </div>
        <div className="oracle-detail-actions">
          <PinButton id={t.id} />
          <BenchButton id={t.id} oracleView={value !== null || encounterPlace || only ? {
            result: value ?? undefined, only, encounterPlace,
          } : undefined} />
        </div>
      </header>
      <RulingNote key={`note:${t.id}`} id={t.id} />
      <OracleBody
        key={t.id}
        t={t}
        value={value}
        onValue={(n) => setParam('r', n === null ? null : String(n))}
        only={only}
        onOnly={(v) => setParam('view', v ? 'one' : null)}
        encounterPlace={encounterPlace}
        onEncounterPlace={(v) => setParam('place', v)}
      />
    </div>
  );
}
