import { useEffect, useState, type ReactNode } from 'react';
import type { Note, Relation, SourceRef, Verification } from '../content/schema';
import { BOOK_LABEL, kindOf, titleOf } from '../content';
import { nav, useNav } from '../lib/store';
import { IAddPane, ICopy, IPin } from './icons';
import { ContextLink } from './ReferenceContext';

export const V_LABEL: Record<Verification, string> = {
  verified: '원문 대조 완료',
  discrepancy: '보조 자료와 불일치',
  ambiguous: '원문 불명확',
  partial: '부분 수록',
  pending: '요약 미작성',
};

export function VChip({ v }: { v: Verification }) {
  return (
    <span className={`chip v-${v}`} title={V_LABEL[v]}>
      <span className="dot" aria-hidden="true" />
      {V_LABEL[v]}
    </span>
  );
}

export function Cite({ source }: { source: SourceRef[] }) {
  return (
    <span className="cite">
      {source.map((s, i) => (
        <span key={i} className="cite-ref">
          <b>{BOOK_LABEL[s.book]}</b>
          {s.book === 'core' || s.book === 'rr' ? ` p.${s.pages.join(', ')}` : ''}
        </span>
      ))}
    </span>
  );
}

const KIND_SHORT: Record<string, string> = { entry: '항목', table: '표', procedure: '절차', ruling: '문답' };

export function XRef({ id, children, showKind = false }: { id: string; children?: ReactNode; showKind?: boolean }) {
  const k = kindOf(id);
  const t = titleOf(id);
  return (
    <ContextLink id={id} className="xref" title={t.en || undefined}>
      {showKind && k && <span className="xk">{KIND_SHORT[k]}</span>}
      <span className="xt">{children ?? t.ko}</span>
    </ContextLink>
  );
}

const NOTE_LABEL: Record<Note['type'], string> = {
  discrepancy: '판본 · 자료 불일치',
  ambiguity: '원문 불명확',
  clarification: '편집 주',
  'optional-rule': '선택 규칙',
};

export function Notes({ notes }: { notes?: Note[] }) {
  if (!notes?.length) return null;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {notes.map((n, i) => (
        <div key={i} className={`notice ${n.type === 'clarification' ? 'clar' : n.type === 'optional-rule' ? 'opt' : ''}`}>
          <span className="kicker">{NOTE_LABEL[n.type]}</span>
          {n.text}
          {n.source && (
            <>
              {' '}
              <Cite source={[n.source]} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const STRENGTH: Record<Relation['strength'], string> = {
  required: '필수로 확인',
  conditional: '조건에 따라',
  optional: '함께 참고',
};

export function Relations({ related }: { related: Relation[] }) {
  if (!related.length) return null;
  const groups: [string, string, Relation[]][] = [
    ['required', STRENGTH.required, related.filter((r) => r.basis === 'source' && r.strength === 'required')],
    ['conditional', STRENGTH.conditional, related.filter((r) => r.basis === 'source' && r.strength === 'conditional')],
    ['optional', STRENGTH.optional, related.filter((r) => r.basis === 'source' && r.strength === 'optional')],
    ['editorial', '편집자 연결(원문 근거 아님)', related.filter((r) => r.basis === 'editorial')],
  ];
  return (
    <div>
      {groups
        .filter(([, , list]) => list.length)
        .map(([key, label, list]) => (
          <div className="rel-group" key={key}>
            <div className={`rel-label ${key}`}>{label}</div>
            <ul className="rel-list">
              {list.map((r) => (
                <li key={r.id + (r.note ?? '')}>
                  <XRef id={r.id} showKind />
                  {r.note && <span className="note">{r.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}

export function PinButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const { pins } = useNav();
  const on = pins.includes(id);
  const label = on ? '고정 해제' : '항목 고정';
  return (
    <button className={compact ? 'iconbtn pinbtn' : 'btn ghost pinbtn'} aria-pressed={on} onClick={() => nav.togglePin(id)} title={label} aria-label={compact ? label : undefined}>
      <IPin />
      {!compact && (on ? '고정됨' : '고정')}
    </button>
  );
}

export function BenchButton({ id, compact = false }: { id: string; compact?: boolean }) {
  const { open } = useNav();
  const on = open.includes(id);
  return (
    <button className={compact ? 'iconbtn' : 'btn ghost'} aria-pressed={on} onClick={() => nav.open(id)} title="작업대에 펼치기" aria-label={compact ? '작업대에 펼치기' : undefined}>
      <IAddPane />
      {!compact && (on ? '작업대에 있음' : '작업대에 펼치기')}
    </button>
  );
}

export function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(''), 2200);
    return () => clearTimeout(t);
  }, [feedback]);
  return (
    <button
      className="btn ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setFeedback('복사됨');
        } catch {
          setFeedback('복사할 수 없음');
        }
      }}
    >
      <ICopy />
      <span aria-live="polite">{feedback || label}</span>
    </button>
  );
}

/** record a visit in Recent */
export function useVisit(id: string | undefined) {
  useEffect(() => {
    if (id) nav.visit(id);
  }, [id]);
}

export function roman(n: number): string {
  const m: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of m) while (n >= v) (out += s), (n -= v);
  return out;
}
