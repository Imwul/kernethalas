import { useId, useState } from 'react';
import { EdgeToggle } from './EdgeToggle';
import { d100FromValue, resolveCheck, rollDie, type CheckOutcome, type CheckResult, type Edge } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { exhaustionDisadvantage } from '../lib/character-progress';
import { usePlayCharacter } from '../lib/play-character';
import { usePlayDraft, usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import type { PlayRollDetails } from '../lib/play-roll-history';
import { formatSkillBreakdown, skillBreakdown, type SkillModifier } from '../lib/play-skill';
import { isSkillDouble, skillCriticalEffect } from '../lib/skill-criticals';
import { GROWTH_SKILLS, isGrowthSkill, useRecordSkillCritical } from '../lib/skill-growth';
import { XRef } from './bits';
import { PlayDieHint, PlayZeroKey } from './play/PlayDieHints';
import { SkillAdjustments } from './play/SkillAdjustments';
import '../styles/physical-skill-roll.css';

const DIFFICULTY = [30, 20, 10, 0, 0, -10, -20, -30];
const OUTCOMES = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
type Inputs = { skill: string; roll: string; difficulty: string; edge: Edge; weapon?: string; modifiers?: SkillModifier[] };
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
  const id = useId();
  const commitRoll = usePlayRoll();
  const recordCritical = useRecordSkillCritical();
  const [confirmed, setConfirmed] = usePlayDraftState<{ inputs: Inputs; result: CheckResult } | null>(slot, null);
  const field = usePlayRollField(slot, label, 'D100', !!confirmed, true);
  const [draft, setDraft] = useState<Partial<Inputs>>({});
  const [invalid, setInvalid] = useState(false);
  const pc = usePlayCharacter();
  const own = context !== 'npc' ? pc : null;
  const chooseWeapon = context !== 'npc' && skill.includes('무기 Skill');
  // Exhaustion 16–20 gives Disadvantage on every check (p.90); Scholar and Trap Buster give Advantage (p.63).
  // Each is the default until the player picks otherwise; when both apply the book gives no rule, so nothing is preset.
  const exhausted = !!own && exhaustionDisadvantage(own.exhaustion);
  const perk = !own ? null : skill === 'Reason' && own.hasPerk('Scholar') ? 'Scholar'
    : skill === 'Thievery' && /함정|trap/i.test(label) && own.hasPerk('Trap Buster') ? 'Trap Buster' : null;
  const presetEdge = exhausted && perk ? null : exhausted ? 'disadvantage' as const : perk ? 'advantage' as const : null;
  // Madness 6 makes Resolve checks Demanding (−10) per result (p.91).
  const madnessResolve = own && skill === 'Resolve' ? own.madness.resolve : 0;
  const inputs = { ...EMPTY, ...(presetEdge ? { edge: presetEdge } : {}),
    ...(chooseWeapon && own?.character.weapon ? { weapon: own.character.weapon } : {}),
    skill: initialSkill, ...confirmed?.inputs, roll: '', ...draft };
  // Until the player types here, an empty value falls back to the Character tab.
  if (!inputs.skill && draft.skill === undefined && !confirmed && own) inputs.skill = own.skill(chooseWeapon ? inputs.weapon : skill);
  const difficultyDie = readOracleValue(inputs.difficulty.trim(), 8);
  const difficulty = randomDifficulty && difficultyDie !== null ? DIFFICULTY[difficultyDie - 1] ?? 0 : 0;
  const fixed = [{ label: '규칙 보정', value: modifier }, { label: '난이도 D8', value: difficulty }, { label: '광기', value: -madnessResolve }];
  const breakdown = skillBreakdown(inputs.skill, inputs.modifiers, fixed);
  const update = (patch: Partial<Inputs>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setInvalid(false);
  };

  const apply = (roll: number | null, source: PlayRollDetails['source']) => {
    if (roll === null || breakdown === null || randomDifficulty && difficultyDie === null) {
      setInvalid(true);
      return;
    }
    const result = resolveCheck(d100FromValue(roll), breakdown.total, inputs.edge);
    commitRoll(() => {
      setConfirmed({ inputs: { ...inputs, roll: String(roll) }, result });
      if (!existingRoll && context !== 'npc') recordCritical(inputs.weapon || skill, result, context === 'skill' ? skill : null);
      onResult(result);
    }, existingRoll ? undefined : { label, dice: 'D100', value: roll === 100 ? '00' : String(roll), source, field: field['data-play-roll-field'],
      breakdown: formatSkillBreakdown(breakdown) });
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
        apply(readOracleValue(inputs.roll.trim(), 100), 'manual');
      }}>
        <label className="field"><span>{skill} 수치</span>
          <input value={inputs.skill} inputMode="text" placeholder="예: 45" onChange={(event) => update({ skill: event.target.value })} />
        </label>
        {randomDifficulty && <div className="field"><label htmlFor={`${id}-difficulty`}>난이도 D8</label>
          <PlayDieHint dice="D8" sides={8} />
          <input id={`${id}-difficulty`} value={inputs.difficulty} inputMode="numeric" placeholder="1–8" onChange={(event) => update({ difficulty: event.target.value })} />
        </div>}
        <EdgeToggle value={inputs.edge} onChange={(edge) => update({ edge })} />
        {(exhausted || perk) && <p className="physical-check-exhausted">{[exhausted && `Exhaustion ${own!.exhaustion} · 모든 판정 불리`,
          perk && `${perk} · 유리`, exhausted && perk && '둘 다 해당 · 직접 고르세요'].filter(Boolean).join(' / ')}</p>}
        {madnessResolve > 0 && <p className="physical-check-exhausted">광기 · Resolve −{madnessResolve}</p>}
        <div className="field"><label htmlFor={`${id}-roll`}>직접 굴린 D100</label><PlayDieHint dice="D100" sides={100} />
          <input id={`${id}-roll`} value={inputs.roll} inputMode="numeric" {...field} placeholder="1–100" aria-invalid={invalid || undefined}
            onChange={(event) => update({ roll: event.target.value })} />
        </div>
        {chooseWeapon && <label className="field physical-check-weapon"><span>사용한 무기 Skill</span>
          <select value={inputs.weapon ?? ''} onChange={(event) => update({ weapon: event.target.value })}>
            <option value="">성장 기록용 선택</option>
            {WEAPON_SKILLS.map((name) => <option key={name}>{name}</option>)}
          </select>
        </label>}
        <div className="physical-check-actions">
          <PlayZeroKey onInput={() => update({ roll: '00' })} />
          <button type="submit" className="btn ghost">판정</button>
          {!existingRoll && <button type="button" className="btn ghost" onClick={() => apply(rollDie(100), 'app')}>D100 굴리기</button>}
          {onClear && confirmed && <button type="button" className="btn ghost" onClick={() => commitRoll(() => {
            setConfirmed(null);
            setDraft({});
            setInvalid(false);
            onClear();
          })}>판정 지우기</button>}
        </div>
        {context !== 'npc' && !existingRoll && <SkillAdjustments skill={chooseWeapon ? inputs.weapon : skill} base={inputs.skill}
          onBase={(value) => update({ skill: value })} modifiers={inputs.modifiers ?? []} fixed={fixed}
          onModifiers={(modifiers) => update({ modifiers })} />}
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
