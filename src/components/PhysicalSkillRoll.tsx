import { useState } from 'react';
import { d100FromValue, resolveCheck, rollDie, type CheckResult, type Edge } from '../lib/dice';
import { encounterInteger } from '../lib/encounter-start';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { XRef } from './bits';
import '../styles/physical-skill-roll.css';

const DIFFICULTY = [30, 20, 10, 0, 0, -10, -20, -30];
const OUTCOMES = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
type Inputs = { skill: string; roll: string; difficulty: string; edge: Edge };
const EMPTY: Inputs = { skill: '', roll: '', difficulty: '', edge: 'none' };

export function skillCheckSucceeded(result: CheckResult) {
  return result.outcome === 'success' || result.outcome === 'critical';
}

export function PhysicalSkillRoll({ label, skill, modifier = 0, randomDifficulty = false, slot = 'skill-roll', initialSkill = '', onResult, onClear }: {
  label: string;
  skill: string;
  modifier?: number;
  randomDifficulty?: boolean;
  slot?: string;
  initialSkill?: string;
  onResult: (result: CheckResult) => void;
  onClear?: () => void;
}) {
  const commitRoll = usePlayRoll();
  const [confirmed, setConfirmed] = usePlayDraftState<{ inputs: Inputs; result: CheckResult } | null>(slot, null);
  const [draft, setDraft] = useState<Partial<Inputs>>({});
  const [invalid, setInvalid] = useState(false);
  const inputs = { ...EMPTY, skill: initialSkill, ...confirmed?.inputs, roll: '', ...draft };
  const difficultyDie = readOracleValue(inputs.difficulty.trim(), 8);
  const difficulty = randomDifficulty && difficultyDie !== null ? DIFFICULTY[difficultyDie - 1] ?? 0 : 0;
  const update = (patch: Partial<Inputs>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setInvalid(false);
  };

  const apply = (roll: number | null) => {
    const base = encounterInteger(inputs.skill);
    if (roll === null || base === null || randomDifficulty && difficultyDie === null || !Number.isSafeInteger(base + modifier + difficulty)) {
      setInvalid(true);
      return;
    }
    const result = resolveCheck(d100FromValue(roll), base + modifier + difficulty, inputs.edge);
    commitRoll(() => {
      setConfirmed({ inputs: { ...inputs, roll: String(roll) }, result });
      onResult(result);
    });
    setDraft({});
    setInvalid(false);
  };

  const result = confirmed?.result;
  return (
    <fieldset className="physical-check">
      <legend>{label}</legend>
      <form className="physical-check-form" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        apply(readOracleValue(inputs.roll.trim(), 100));
      }}>
        <label className="field"><span>{skill} 수치</span>
          <input value={inputs.skill} inputMode="text" placeholder="예: 45" onChange={(event) => update({ skill: event.target.value })} />
        </label>
        {randomDifficulty && <label className="field"><span>난이도 D8</span>
          <input value={inputs.difficulty} inputMode="numeric" placeholder="1–8" onChange={(event) => update({ difficulty: event.target.value })} />
        </label>}
        <label className="field"><span>유불리</span>
          <select value={inputs.edge} onChange={(event) => update({ edge: event.target.value as Edge })}>
            <option value="none">없음</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option>
          </select>
        </label>
        <label className="field"><span>직접 굴린 D100</span>
          <input value={inputs.roll} inputMode="numeric" data-play-dice placeholder="1–100 / 00" aria-invalid={invalid || undefined}
            onChange={(event) => update({ roll: event.target.value })} />
        </label>
        <div className="physical-check-actions">
          <button type="submit" className="btn ghost">판정</button>
          <button type="button" className="btn ghost" onClick={() => apply(rollDie(100))}>D100 굴리기</button>
          {onClear && confirmed && <button type="button" className="btn ghost" onClick={() => {
            setConfirmed(null);
            setDraft({});
            setInvalid(false);
            onClear();
          }}>판정 지우기</button>}
        </div>
        {invalid && <p className="field-err" role="alert">{skill} 수치{randomDifficulty ? '와 난이도 1–8, ' : '와 '}D100의 값을 확인하세요.</p>}
      </form>
      {result && <div className="physical-check-result" role="status">
        <span className="readout">{result.read.value}</span>
        <strong>{OUTCOMES[result.outcome]}</strong>
        <span>보정 후 {skill} {result.skill}{result.flippedRead && ' · 뒤집은 값'}</span>
        {(result.outcome === 'critical' || result.outcome === 'fumble') && <XRef id="t-noncombat-crits">대성공·대실패 효과</XRef>}
      </div>}
    </fieldset>
  );
}
