import { useState } from 'react';
import { d100FromValue, resolveCheck, rollDie, type CheckOutcome, type CheckResult, type Edge } from '../lib/dice';
import { encounterInteger } from '../lib/encounter-start';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraft, usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { isSkillDouble, skillCriticalEffect } from '../lib/skill-criticals';
import { GROWTH_SKILLS, isGrowthSkill, useRecordSkillCritical } from '../lib/skill-growth';
import { XRef } from './bits';
import '../styles/physical-skill-roll.css';

const DIFFICULTY = [30, 20, 10, 0, 0, -10, -20, -30];
const OUTCOMES = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
type Inputs = { skill: string; roll: string; difficulty: string; edge: Edge; weapon?: string };
const EMPTY: Inputs = { skill: '', roll: '', difficulty: '', edge: 'none' };
const WEAPON_SKILLS = GROWTH_SKILLS.filter((name) => name.endsWith('Weapons'));

export function skillCheckSucceeded(result: CheckResult) {
  return result.outcome === 'success' || result.outcome === 'critical';
}

export function SkillCriticalDetails({ skill, outcome, growthSkill = skill, showEffect = true }: {
  skill: string;
  outcome: CheckOutcome;
  growthSkill?: string;
  showEffect?: boolean;
}) {
  const play = usePlayDraft();
  if (!isSkillDouble(outcome)) return null;
  const effect = showEffect ? skillCriticalEffect(skill, outcome) : undefined;
  return (
    <div className="physical-check-critical">
      {effect && <div>{effect} <XRef id="t-noncombat-crits">판정별 효과 표</XRef></div>}
      {isGrowthSkill(growthSkill) && <span>
        {play ? <>기술 성장 표시 대상 · 야영의 <XRef id="skill-improvement">기술 성장</XRef>에서 확인</>
          : <><XRef id="skill-improvement">기술 성장</XRef> 표시를 종이 시트에 남기세요.</>}
      </span>}
    </div>
  );
}

export function PhysicalSkillRoll({ label, skill, modifier = 0, randomDifficulty = false, slot = 'skill-roll', initialSkill = '',
  readOnly = false, existingRoll = false, context = 'skill', onResult, onClear }: {
  label: string;
  skill: string;
  modifier?: number;
  randomDifficulty?: boolean;
  slot?: string;
  initialSkill?: string;
  readOnly?: boolean;
  existingRoll?: boolean;
  context?: 'skill' | 'attack' | 'npc';
  onResult: (result: CheckResult) => void;
  onClear?: () => void;
}) {
  const commitRoll = usePlayRoll();
  const recordCritical = useRecordSkillCritical();
  const [confirmed, setConfirmed] = usePlayDraftState<{ inputs: Inputs; result: CheckResult } | null>(slot, null);
  const [draft, setDraft] = useState<Partial<Inputs>>({});
  const [invalid, setInvalid] = useState(false);
  const inputs = { ...EMPTY, skill: initialSkill, ...confirmed?.inputs, roll: '', ...draft };
  const chooseWeapon = context !== 'npc' && skill.includes('무기 Skill');
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
      if (!existingRoll && context !== 'npc') recordCritical(inputs.weapon || skill, result, context === 'skill' ? skill : null);
      onResult(result);
    });
    setDraft({});
    setInvalid(false);
  };

  const result = confirmed?.result;
  if (readOnly && !result) return null;
  return (
    <fieldset className="physical-check">
      <legend>{label}</legend>
      {!readOnly && <form className="physical-check-form" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        apply(readOracleValue(inputs.roll.trim(), 100));
      }}>
        <label className="field"><span>{skill} 수치</span>
          <input value={inputs.skill} inputMode="text" placeholder="예: 45" onChange={(event) => update({ skill: event.target.value })} />
        </label>
        {chooseWeapon && <label className="field"><span>사용한 무기 Skill</span>
          <select value={inputs.weapon ?? ''} onChange={(event) => update({ weapon: event.target.value })}>
            <option value="">성장 기록용 선택</option>
            {WEAPON_SKILLS.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>}
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
          {!existingRoll && <button type="button" className="btn ghost" onClick={() => apply(rollDie(100))}>D100 굴리기</button>}
          {onClear && confirmed && <button type="button" className="btn ghost" onClick={() => commitRoll(() => {
            setConfirmed(null);
            setDraft({});
            setInvalid(false);
            onClear();
          })}>판정 지우기</button>}
        </div>
        {invalid && <p className="field-err" role="alert">{skill} 수치{randomDifficulty ? '와 난이도 1–8, ' : '와 '}D100의 값을 확인하세요.</p>}
      </form>}
      {result && <div className="physical-check-result" role="status">
        <span className="readout">{result.read.value}</span>
        <strong>{OUTCOMES[result.outcome]}</strong>
        <span>보정 후 {skill} {result.skill}{result.flippedRead && ' · 뒤집은 값'}</span>
        {context !== 'npc' && <SkillCriticalDetails skill={skill} outcome={result.outcome}
          growthSkill={existingRoll ? '' : confirmed.inputs.weapon || skill} showEffect={context === 'skill'} />}
      </div>}
    </fieldset>
  );
}
