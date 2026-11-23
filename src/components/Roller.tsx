import { useId, useState, type ReactNode } from 'react';
import type { OracleTable, TableRow } from '../content/schema';
import { d100FromValue } from '../lib/dice';
import { automaticRollSides, oracleRowsAvailable, readOracleValue, rollTable } from '../lib/oracle';
import { tableRowSource } from '../lib/overlay';
import { usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import type { PlayRollDetails } from '../lib/play-roll-history';
import { CopyButton, XRef } from './bits';
import { IDie } from './icons';
import { RoomShapeDiagram, type RoomShapeState } from './RoomShapeDiagram';
import { rangeText, rowTitle, showLabel } from './TableView';
import { PlayDieHint, PlayZeroKey } from './play/PlayDieHints';

interface Props {
  t: OracleTable;
  sides: number;
  value: number | null;
  onValue: (v: number | null) => void;
  only: boolean;
  onOnly: (only: boolean) => void;
  onShowRow: () => void;
  rollLabel?: string;
  sourceForRow?: (row: TableRow) => string | undefined;
  showUnrolledViewToggle?: boolean;
  beforeRoll?: ReactNode;
  roomShape?: RoomShapeState;
  afterResult?: ReactNode;
  play?: boolean;
}

export function Roller({ t, sides, value, onValue, only, onOnly, onShowRow, rollLabel, sourceForRow, showUnrolledViewToggle, beforeRoll, roomShape, afterResult, play = false }: Props) {
  const id = useId();
  const [manual, setManual] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [history, setHistory] = usePlayDraftState<number[]>(`oracle-history:${t.id}`, []);
  const commitRoll = usePlayRoll();
  const field = usePlayRollField(`oracle:${t.id}`, t.ko, t.dice, value !== null, sides === 100);
  const canRoll = automaticRollSides(t) !== null;
  const row = value === null ? undefined : t.rows.find((r) => value >= r.min && value <= r.max);
  const showLocalSource = t.mode === 'local-only' || t.group === 'flavor' || t.id === 't-events';
  const original = row && (sourceForRow?.(row) ?? (showLocalSource ? tableRowSource(t.id, row.min) : undefined));
  const digits = value !== null && sides === 100 ? d100FromValue(value) : null;
  const rollValue = (n: number, source: PlayRollDetails['source']) => {
    setInvalid(false);
    commitRoll(() => {
      setHistory((h) => [n, ...h].slice(0, 12));
      onValue(n);
    }, { label: t.ko, dice: t.dice, value: sides === 100 && n === 100 ? '00' : String(n), source, field: field['data-play-roll-field'] });
  };
  const copyText = row ? [
    `[${t.en}, ${t.dice}: ${value}] ${showLabel(t, row) ? row.label + ' — ' : ''}${row.ko}`,
    ...(t.columns ?? []).map((c) => `${c.ko} ${row.cols?.[c.key] ?? ''}`),
  ].join('\n') : '';

  return (
    <section className="oracle-instrument" aria-label="표 굴리기">
      {beforeRoll}
      <div className="oracle-instrument-entry">
      <div className="oracle-instrument-top">
        <div className="oracle-dice-spec">
          <span>{t.dice}</span>
          <span>1–{sides}</span>
        </div>
        <div className="oracle-instrument-actions">
          {canRoll && (
            <button className="btn primary" type="button" onClick={() => {
              const number = rollTable(t);
              if (number !== null) rollValue(number, 'app');
            }}>
              <IDie />
              {rollLabel ?? (value === null ? '굴리기' : '다시 굴리기')}
            </button>
          )}
          {value !== null && (
            <button className="btn ghost" type="button" onClick={() => onValue(null)}>
              지우기
            </button>
          )}
        </div>
      </div>
      {!canRoll && (
        <p className="oracle-roll-availability">
          {t.mode === 'local-only' && !oracleRowsAvailable(t)
            ? '결과 본문은 인용한 원본 쪽에서 확인하세요. 직접 굴린 값으로 범위를 찾을 수 있습니다.'
            : '표 결과에 검증이 필요해 자동 굴림을 중지했습니다.'}
        </p>
      )}
      <form className="manual oracle-manual" data-play-roll noValidate onSubmit={(e) => {
        e.preventDefault();
        const number = readOracleValue(manual.trim(), sides);
        if (number === null) {
          setInvalid(true);
          return;
        }
        rollValue(number, 'manual');
        setManual('');
      }}>
        <div className="oracle-manual-label"><label htmlFor={id}>직접 굴린 값</label><PlayDieHint dice={t.dice} sides={sides} /></div>
        <input
          id={id}
          inputMode="numeric"
          {...field}
          autoComplete="off"
          value={manual}
          onChange={(e) => {
            setManual(e.target.value);
            if (invalid) setInvalid(false);
          }}
          placeholder={sides === 100 ? '1–100/00' : `1–${sides}`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
        />
        {sides === 100 && <PlayZeroKey onInput={() => { setManual('00'); setInvalid(false); }} />}
        <button className="btn ghost" type="submit">확인</button>
        {invalid && (
          <p className="field-err" id={`${id}-error`} role="alert">
            1에서 {sides} 사이의 정수를 입력하세요.{sides === 100 && ' 00도 입력할 수 있습니다.'}
          </p>
        )}
      </form>
      </div>

      <div className="oracle-result" role="status" aria-live="polite" data-idle={value === null && !canRoll || undefined}>
        {value === null ? (
          <p className="oracle-result-idle">굴리기 버튼을 누르거나 직접 굴린 값을 입력하세요.</p>
        ) : (
          <>
            <div className="oracle-result-value">
              <span className="readout">{sides === 100 ? String(value).padStart(2, '0') : value}</span>
              {(row || digits) && <div className="oracle-result-meta">
                {row && <span>범위 {rangeText(row, t.dice)}</span>}
                {digits && <span>십 {digits.tens} · 일 {digits.ones}{digits.tens === digits.ones && ' 더블'}</span>}
              </div>}
            </div>
            <div className="oracle-result-text">
              {row && showLabel(t, row) && <span className="oracle-result-label" lang="en">{row.label}</span>}
              <p>{row?.ko ?? '해당 값의 결과는 수록되지 않았습니다. 출처에서 확인하세요.'}</p>
              {original && <span className="oracle-result-label" lang="en">{original}</span>}
              {!!t.columns?.length && row?.cols && (
                <dl>
                  {t.columns.map((c) => (
                    <div key={c.key}>
                      <dt>{c.ko}</dt>
                      <dd>{row.cols?.[c.key]}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {t.id === 't-room-shape' && row && (
                <figure className="room-shape-result">
                  <RoomShapeDiagram roll={row.min} state={roomShape} />
                  <figcaption>출입구 배치 예시</figcaption>
                </figure>
              )}
            </div>
          </>
        )}
      </div>

      {afterResult}
      {!!row?.next?.length && (
        <div className="oracle-follow-on">
          <span>이어서 보기</span>
          <ul>
            {row.next.map((n) => (
              <li key={n.id}>
                <XRef id={n.id} showKind />
                {n.note && <span>{n.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(value !== null || showUnrolledViewToggle) && (
        <div className="oracle-result-actions">
          <div className="seg" role="group" aria-label="표 보기">
            <button type="button" aria-pressed={only} onClick={() => onOnly(true)}>{value === null ? '표 접기' : '결과만'}</button>
            <button type="button" aria-pressed={!only} onClick={() => onOnly(false)}>전체 표</button>
          </div>
          {row && !play && <CopyButton text={copyText} label="결과 복사" />}
          {!only && row && <button className="btn ghost" type="button" onClick={onShowRow}>해당 행으로</button>}
        </div>
      )}

      {!play && history.length > 1 && (
        <details className="oracle-roll-history">
          <summary>이번 열람의 굴림 기록 ({history.length})</summary>
          <ol className="history">
            {history.map((h, i) => {
              const r = t.rows.find((x) => h >= x.min && h <= x.max);
              return (
                <li key={i}>
                  <span>{h}</span>
                  <span>{r ? rowTitle(t, r) : ''}</span>
                </li>
              );
            })}
          </ol>
        </details>
      )}
    </section>
  );
}
