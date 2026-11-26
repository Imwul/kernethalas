import { useId, useState } from 'react';
import { rollDie } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraftState, usePlayRoll, usePlayRollField, usePlayRollInput } from '../lib/play-draft';
import type { PlayRollDetails } from '../lib/play-roll-history';
import { XRef } from './bits';
import { PlayDieHint } from './play/PlayDieHints';
import '../styles/tension-tool.css';

const TENSION_DICE = [8, 6, 4] as const;
const NEXT_DIE = { 8: 6, 6: 4, 4: 8 } as const;

export type TensionDie = (typeof TENSION_DICE)[number];

export interface TensionResult {
  sides: TensionDie;
  value: number;
  nextDie: TensionDie;
  darkness: boolean;
}

export function TensionTool({ onResult, showDarknessLink = true, initialSides = 8, value, rollContext }: {
  onResult?: (result: TensionResult) => void;
  showDarknessLink?: boolean;
  initialSides?: TensionDie;
  value?: TensionResult | null;
  rollContext?: string;
} = {}) {
  const id = useId();
  const suffix = rollContext ? `:${rollContext}` : '';
  const [selected, setSelected] = usePlayDraftState<TensionDie | null>(`tension-selected${suffix}`, null);
  const [manual, setManual] = usePlayRollInput(`tension${suffix}`);
  const [invalid, setInvalid] = useState(false);
  const [localResult, setLocalResult] = useState<TensionResult | null>(null);
  const commitRoll = usePlayRoll();
  const result = value === undefined ? localResult : value;
  const sides = selected ?? result?.sides ?? initialSides;
  const field = usePlayRollField('tension', '긴장 주사위', `D${sides}`, !!result && !manual);
  const apply = (die: TensionDie, rolled: number, source: PlayRollDetails['source']) => {
    const next = { sides: die, value: rolled, nextDie: rolled <= 2 ? NEXT_DIE[die] : die, darkness: die === 4 && rolled <= 2 };
    commitRoll(() => {
      if (value === undefined) setLocalResult(next);
      onResult?.(next);
    }, { label: '긴장 주사위', dice: `D${die}`, value: String(rolled), source, field: field['data-play-roll-field'] });
    setSelected(null);
    setManual('');
    setInvalid(false);
  };

  return (
    <div className="tension-tool">
      <div className="tension-rolls" role="group" aria-label="긴장 주사위 굴리기">
        {TENSION_DICE.map((die) => (
          <button key={die} type="button" className="btn ghost" aria-label={`D${die} 굴리기`} onClick={() => apply(die, rollDie(die), 'app')}>
            D{die}
          </button>
        ))}
      </div>
      <form className="tension-manual" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        const value = readOracleValue(manual.trim(), sides);
        if (value === null) setInvalid(true);
        else apply(sides, value, 'manual');
      }}>
        <label className="field"><span>현재 주사위</span>
          <select aria-label="긴장 주사위 크기" value={sides} onChange={(event) => {
            setSelected(Number(event.target.value) as TensionDie);
            setInvalid(false);
          }}>{TENSION_DICE.map((die) => <option key={die} value={die}>D{die}</option>)}</select>
        </label>
        <label className="field"><span>굴린 값</span><PlayDieHint dice={`D${sides}`} sides={sides} />
          <input aria-label="긴장 주사위 굴린 값" value={manual} inputMode="numeric" {...field} autoComplete="off" placeholder={`1–${sides}`}
            aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(event) => {
              setManual(event.target.value);
              setInvalid(false);
            }} />
        </label>
        <button type="submit" className="btn ghost" aria-label="긴장 주사위 확인">확인</button>
        {invalid && <p className="field-err" id={`${id}-error`} role="alert">1에서 {sides} 사이의 정수를 입력하세요.</p>}
      </form>
      <div className="tension-result" role="status">
        {result && (
          <>
            <div className="tension-value">
              <span>D{result.sides} 결과</span>
              <span className="readout">{result.value}</span>
            </div>
            <div className="tension-next">
              {result.darkness && showDarknessLink && <XRef id="t-growing-darkness">짙어지는 어둠 표 열기</XRef>}
              <span>{result.darkness && '표를 굴린 뒤 '}다음 긴장 주사위 <strong>D{result.nextDie}</strong></span>
            </div>
          </>
        )}
      </div>
      <div className="tension-refs">
        <XRef id="tension-die">긴장 주사위 규칙</XRef>
        <XRef id="growing-darkness">짙어지는 어둠 규칙</XRef>
      </div>
    </div>
  );
}
