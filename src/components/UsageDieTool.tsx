import { useEffect, useId, useState } from 'react';
import { rollDie, tableSides } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraftState, usePlayRoll, usePlayRollField, usePlayRollInput } from '../lib/play-draft';
import { resolveUsageDie, USAGE_DIE_PROFILES, type UsageDie, type UsageDieRule } from '../lib/usage-die';
import { XRef } from './bits';
import { IDie } from './icons';
import '../styles/usage-die.css';

interface Props {
  rule: UsageDieRule;
  onReport?: (text: string) => void;
  /** The caller shows the title above the card (play desk step headings). */
  hideTitle?: boolean;
  progress?: {
    itemId?: string;
    die: UsageDie;
    recorded?: { die: UsageDie; value: number };
    onRoll: (value: number) => void;
  };
}

export function UsageDieTool({ rule, onReport, progress, hideTitle = false }: Props) {
  const profile = USAGE_DIE_PROFILES[rule];
  const id = useId();
  const [selectedDie, setDie] = usePlayDraftState<UsageDie | null>(`${rule}-die`, profile.start);
  const [selectedValue, setValue] = usePlayDraftState<number | null>(`${rule}-value`, null);
  const [invalid, setInvalid] = useState(false);
  const commitRoll = usePlayRoll();
  const die = progress ? progress.recorded?.die ?? progress.die : selectedDie;
  const value = progress ? progress.recorded?.value ?? null : selectedValue;
  const sides = die === null ? null : tableSides(die);
  const fieldKey = `usage:${rule}`;
  const [manual, setManual] = usePlayRollInput(progress?.itemId ? `${fieldKey}:${progress.itemId}:${die}` : fieldKey);
  const field = usePlayRollField(fieldKey, profile.title, die ?? '', value !== null && !manual);
  const result = die && value !== null ? resolveUsageDie(rule, die, value) : null;
  const report = !result ? '' : result.kind === 'trigger' ? result.title : `방어구 내구도 ${result.next}${result.kind === 'unchanged' ? ' 유지' : '로 하락'}`;
  useEffect(() => { onReport?.(report); }, [onReport, report]);
  const showRoll = (rolled: number, source: 'manual' | 'app') => {
    commitRoll(() => (progress?.onRoll ?? setValue)(rolled), { label: profile.title, dice: die ?? '', value: String(rolled),
      source, field: field['data-play-roll-field'] });
    setManual('');
    setInvalid(false);
  };

  return (
    <section className="usage-die" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={hideTitle ? 'sr-only' : undefined}>{profile.title}</h3>
      {!progress?.recorded && (
        <>
          <div className="usage-die-inputs">
            {progress ? <span className="usage-die-current">현재 주사위 <strong>{die}</strong></span> : (
              <div className="field">
                <label htmlFor={`${id}-die`}>현재 주사위</label>
                <select id={`${id}-die`} value={die ?? ''} onChange={(event) => {
                  setDie(profile.dice.find((option) => option === event.target.value) ?? null);
                  setValue(null);
                  setManual('');
                  setInvalid(false);
                }}>
                  {profile.start === null && <option value="" disabled>선택</option>}
                  {profile.dice.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            )}
            <button className="btn primary" type="button" disabled={sides === null} onClick={() => {
              if (sides !== null) showRoll(rollDie(sides), 'app');
            }}>
              <IDie /> {die ? `${die} 굴리기` : '굴리기'}
            </button>
          </div>
          <form className="usage-die-inputs" data-play-roll noValidate onSubmit={(event) => {
            event.preventDefault();
            const next = readOracleValue(manual.trim(), sides);
            if (next === null) {
              setInvalid(true);
              return;
            }
            showRoll(next, 'manual');
          }}>
            <div className="field">
              <label htmlFor={`${id}-manual`}>직접 굴린 값</label>
              <input id={`${id}-manual`} inputMode="numeric" {...field} autoComplete="off" disabled={sides === null}
                value={manual} placeholder={sides === null ? undefined : `1–${sides}`} aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-error` : undefined} onChange={(event) => {
                  setManual(event.target.value);
                  setInvalid(false);
                }} />
            </div>
            <button className="btn ghost" type="submit" disabled={sides === null}>확인</button>
            {invalid && <p className="field-err" id={`${id}-error`} role="alert">1에서 {sides} 사이의 정수를 입력하세요.</p>}
          </form>
        </>
      )}
      <div className="usage-die-result" role="status">
        {result && (
          <>
            <div className="usage-die-readout">
              <span className="readout">{value}</span>
              <span>{die} 결과</span>
            </div>
            <div className="usage-die-effect">
              {result.kind === 'trigger' ? (
                <>
                  <strong>{result.title}</strong>
                  <span>{result.effect}</span>
                  {!progress && result.followUps?.map(({ id: target, label }) => <XRef key={target} id={target}>{label}</XRef>)}
                </>
              ) : (
                <>
                  {progress && progress.die !== result.next
                    ? <strong>판정 직후 {result.next} · 다음 {progress.die}</strong>
                    : <strong>다음 주사위 {result.next}</strong>}
                  <span>{result.kind === 'decreased' ? '한 단계 하락' : '현재 단계 유지'}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
