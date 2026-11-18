import { Fragment, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tableById } from '../content';
import { automaticRollSides, rollTable } from '../lib/oracle';
import { search, docs, KIND_LABEL, SEARCH_FILTERS, querySuggestions, searchTerms, type Doc, type SearchFilter } from '../lib/search';
import { nav, useNav } from '../lib/store';
import { IClose, IDie, ISearch } from './icons';

interface Props {
  open: boolean;
  query: string;
  filter: SearchFilter;
  onQuery: (query: string) => void;
  onFilter: (filter: SearchFilter) => void;
  onPreview: (id: string, result?: number) => void;
  onClose: () => void;
}

const byId = new Map(docs.map((d) => [d.id, d]));

function Highlight({ value, terms }: { value: string; terms: string[] }) {
  if (!terms.length) return value;
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = value.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return parts.map((part, i) => <Fragment key={i}>{i % 2 ? <mark>{part}</mark> : part}</Fragment>);
}

export function Palette({ open, query, filter, onQuery, onFilter, onPreview, onClose }: Props) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const { recent, pins } = useNav();

  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element || !open) return;
    element.showModal();
    input.current?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const fitKeyboard = () => {
      if (viewport) element.style.setProperty('--search-viewport', `${viewport.height}px`);
    };
    fitKeyboard();
    viewport?.addEventListener('resize', fitKeyboard);
    return () => {
      viewport?.removeEventListener('resize', fitKeyboard);
      element.close();
    };
  }, [open]);

  const results: { doc: Doc; snippet: string; group?: string }[] = useMemo(() => {
    if (query.trim()) return search(query, 40, filter);
    const collect = (ids: string[], group: string) => ids.flatMap((id) => {
      const doc = byId.get(id);
      if (!doc || (filter !== 'all' && filter !== doc.kind && !(filter === 'reference' && doc.kind !== 'table' && doc.kind !== 'procedure'))) return [];
      return [{ doc, snippet: doc.summary, group }];
    });
    return [...collect(pins, '고정 항목').slice(0, 8), ...collect(recent.filter((id) => !pins.includes(id)), '최근 열람').slice(0, 10)];
  }, [query, filter, recent, pins]);
  const terms = useMemo(() => searchTerms(query).filter(Boolean).sort((a, b) => b.length - a.length), [query]);
  const suggestions = useMemo(() => query.trim() && !results.length ? querySuggestions(query, filter) : [], [query, filter, results.length]);
  const active = Math.min(selected, results.length - 1);

  const changeQuery = (value: string) => {
    setSelected(0);
    onQuery(value);
    list.current?.scrollTo({ top: 0 });
  };
  const move = (distance: number) => {
    const next = Math.max(0, Math.min(active + distance, results.length - 1));
    setSelected(next);
    list.current?.querySelector(`[data-result="${next}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const addToDesk = (id: string) => { nav.open(id); onClose(); };

  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label="규칙 검색"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="search-content">
        <div className="search-input">
          <ISearch />
          <input
            type="search"
            ref={input}
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            placeholder="Prone, 방어구, 양쪽 다 실패…"
            aria-label="검색어"
            aria-controls="search-results"
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.key === 'ArrowDown' ? 1 : -1);
              } else if (event.key === 'Enter' && results[active]) {
                event.preventDefault();
                const { id } = results[active].doc;
                if (event.shiftKey) addToDesk(id);
                else onPreview(id);
              }
            }}
          />
          <button className="iconbtn" onClick={onClose} aria-label="검색 닫기"><IClose /></button>
        </div>
        <div className="search-filters" role="group" aria-label="검색 유형">
          {SEARCH_FILTERS.map(({ id, label }) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setSelected(0); onFilter(id); list.current?.scrollTo({ top: 0 }); }}>
              {label}
            </button>
          ))}
        </div>
        <div className="search-results" id="search-results" ref={list}>
          {!results.length && (
            <div className="search-empty">
              <p>{query.trim() ? `‘${query.trim()}’ 검색 결과가 없습니다.` : '규칙명이나 플레이 중인 상황을 입력하세요.'}</p>
              {suggestions.length > 0 && (
                <div className="quickterms" aria-label="추천 검색어">
                  {suggestions.map((suggestion) => <button key={suggestion} onClick={() => { changeQuery(suggestion); input.current?.focus(); }}>{suggestion}</button>)}
                </div>
              )}
            </div>
          )}
          {results.map(({ doc, snippet, group }, index) => {
            const table = tableById.get(doc.id);
            const rollable = table && automaticRollSides(table);
            return (
              <Fragment key={doc.id}>
                {group && group !== results[index - 1]?.group && <h3 className="search-group">{group}</h3>}
                <div className="search-result" data-result={index} data-active={index === active}>
                  <button className="search-preview" onClick={() => onPreview(doc.id)} onFocus={() => setSelected(index)}>
                    <span className="search-kind">{KIND_LABEL[doc.kind]}</span>
                    <span className="search-match">
                      <strong><Highlight value={doc.ko} terms={terms} /></strong>
                      {doc.en && doc.en !== doc.ko && <span className="en"><Highlight value={doc.en} terms={terms} /></span>}
                      <span className="search-snippet"><Highlight value={snippet} terms={terms} /></span>
                    </span>
                  </button>
                  {rollable && (
                    <button className="search-roll" aria-label={`${doc.ko} ${table.dice} 굴리기`} onClick={() => {
                      const value = rollTable(table);
                      if (value !== null) onPreview(doc.id, value);
                    }}><IDie /> {table.dice} 굴리기</button>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
        <div className="search-foot">
          <span className="search-keys"><kbd>↑</kbd> <kbd>↓</kbd> 이동 <kbd>Enter</kbd> 참고 패널 <kbd>Shift</kbd> + <kbd>Enter</kbd> 작업대</span>
          <span role="status">{query.trim() ? `표시 결과 ${results.length}건` : `검색 가능 ${docs.length}건`}</span>
        </div>
      </div>
    </dialog>
  );
}
