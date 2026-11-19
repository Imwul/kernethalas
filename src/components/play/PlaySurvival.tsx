import { useEffect, useMemo, useRef } from 'react';
import { entryById } from '../../content';
import { d100FromValue, resolveCheck, type CheckResult, type Edge } from '../../lib/dice';
import { encounterInteger } from '../../lib/encounter-start';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { gearCount, type PaperChange } from '../../lib/play-inventory';
import { isGrowthSkill, skillGrowthKey, skillGrowthName, useClearSkillGrowth, usePendingSkillGrowth, useRecordSkillCritical } from '../../lib/skill-growth';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
import '../../styles/play-survival.css';

export type SurvivalPane = 'treatment' | 'rot' | 'growth';

export interface SurvivalReport {
  summary: string;
  sheet: PaperChange[];
}

interface SurvivalRecord {
  kind: SurvivalPane;
  summary: string;
  changes: string[];
  key?: string;
}

type SaveRecord = (record: SurvivalRecord) => void;

interface CheckDraft {
  target: string;
  edge: Edge;
  roll: number | null;
}

const EMPTY_CHECK: CheckDraft = { target: '', edge: 'none', roll: null };
const CHECK_LABEL = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
const passed = ({ outcome }: CheckResult) => outcome === 'success' || outcome === 'critical';

function resolveDraft({ target, edge, roll }: CheckDraft) {
  const score = encounterInteger(target);
  return score === null || roll === null ? null : resolveCheck(d100FromValue(roll), score, edge);
}

function CheckInputs({ label, value, result, onChange }: {
  label: string;
  value: CheckDraft;
  result: CheckResult | null;
  onChange: (next: CheckDraft) => void;
}) {
  const invalid = !!value.target.trim() && encounterInteger(value.target) === null;
  const recordCritical = useRecordSkillCritical();
  const growthEligible = isGrowthSkill(label);
  return (
    <>
      <div className="survival-fields">
        <label className="field"><span>보정 {label}</span>
          <input value={value.target} placeholder="예 45" aria-invalid={invalid || undefined}
            onChange={(event) => onChange({ ...value, target: event.target.value, roll: null })} />
        </label>
        <label className="field"><span>이점·불이점</span>
          <select value={value.edge} onChange={(event) => onChange({ ...value, edge: event.target.value as Edge, roll: null })}>
            <option value="none">없음</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
        </label>
      </div>
      {invalid && <p className="field-err" role="alert">보정 수치는 정수로 입력하세요.</p>}
      <JournalRoll die="D100" label={label} value={value.roll} onValue={(roll) => {
        const next = { ...value, roll };
        onChange(next);
        const rolled = resolveDraft(next);
        if (rolled) recordCritical(label, rolled);
      }} resultText={result ? `${CHECK_LABEL[result.outcome]}${result.flippedRead ? ` · 뒤집은 값 ${result.read.value}` : ''}${growthEligible && (result.outcome === 'critical' || result.outcome === 'fumble') ? ' · 야영 성장 표시' : ''}` : '판정에 쓸 보정 수치를 입력하세요.'} />
    </>
  );
}

const CONDITIONS = [
  { id: 'bleeding', label: '출혈' },
  { id: 'burning', label: '화상' },
  { id: 'poisoned', label: '중독' },
] as const;
type Condition = typeof CONDITIONS[number]['id'];
type Treatment = 'heal' | 'bleeding' | 'poisoned';
const TREATMENTS = { heal: 'Toughness 회복', bleeding: '출혈 해제', poisoned: '중독 해제' } as const;

interface TreatmentDraft {
  purpose: Treatment;
  check: CheckDraft;
  recovery: number | null;
  damage: [number | null, number | null];
}

const EMPTY_TREATMENT: TreatmentDraft = { purpose: 'heal', check: EMPTY_CHECK, recovery: null, damage: [null, null] };

function TreatmentTool({ healedHere, onRecord }: { healedHere: boolean; onRecord: SaveRecord }) {
  const [conditions, setConditions] = usePlayDraftState<Condition[]>('lingering', []);
  const [draft, setDraft] = usePlayDraftState<TreatmentDraft>('bandage', EMPTY_TREATMENT);
  const commitRoll = usePlayRoll();
  const { purpose, check, recovery, damage } = draft;
  const result = resolveDraft(check);
  const success = result !== null && passed(result);
  const critical = result?.outcome === 'critical';
  const fumble = result?.outcome === 'fumble';
  const needsRecovery = success && (purpose === 'heal' || critical);
  const canTreat = purpose !== 'heal' || !healedHere;
  const fumbleDamage = damage[0] !== null && damage[1] !== null ? damage[0] + damage[1] : null;
  const parts = [
    ...(success && purpose !== 'heal' ? [TREATMENTS[purpose]] : []),
    ...(needsRecovery && recovery !== null ? [`Toughness +${recovery}`] : []),
    ...(fumble && fumbleDamage !== null ? [`Bludgeoning 피해 ${fumbleDamage}`] : []),
  ];
  const resetDice = (next: Pick<TreatmentDraft, 'purpose' | 'check'>) => setDraft({ ...EMPTY_TREATMENT, ...next });
  const clear = (condition: Condition) => setConditions((previous) => previous.filter((item) => item !== condition));
  const save = () => {
    if (!result || !canTreat || (needsRecovery && recovery === null) || (fumble && fumbleDamage === null)) return;
    commitRoll(() => {
      onRecord({ kind: 'treatment', key: success && purpose === 'heal' ? 'heal' : undefined,
        summary: `붕대 처치 ${CHECK_LABEL[result.outcome]}${parts.length ? ` · ${parts.join(', ')}` : ''}`,
        changes: ['Bandage −1 (붕대 처치)', ...parts.map((part) => `${part} (붕대 처치)`)] });
      if (success && purpose !== 'heal') clear(purpose);
      resetDice({ purpose: success && purpose === 'heal' ? 'bleeding' : purpose, check: { ...check, roll: null } });
    });
  };

  return (
    <section className="survival-card" aria-label="지속 피해와 붕대 처치">
      <h3>지속 피해와 붕대 처치</h3>
      <fieldset className="survival-conditions">
        <legend>전투 후 남은 상태</legend>
        {CONDITIONS.map(({ id, label }) => (
          <label key={id}><input type="checkbox" checked={conditions.includes(id)} onChange={(event) => {
            if (event.target.checked) setConditions((previous) => [...previous, id]);
            else clear(id);
          }} />{label}</label>
        ))}
      </fieldset>
      <div className="survival-preview" role="status" aria-label="다음 방 지속 피해">
        <strong>다음 방 Health −{conditions.length}</strong>
        {conditions.length > 0 && <span>{CONDITIONS.filter(({ id }) => conditions.includes(id))
          .map(({ id, label }) => `${label} 1${id === 'poisoned' ? ' Poison' : ''}`).join(' · ')} · Armor 무시</span>}
      </div>
      {conditions.includes('burning') && <button className="btn ghost survival-action" type="button" onClick={() => {
        clear('burning');
        onRecord({ kind: 'treatment', summary: '화상 해제 · Exhaustion +2', changes: ['화상 해제', 'Exhaustion +2 (화상 끄기)'] });
      }}>화상 끄기 · Exhaustion +2</button>}
      <label className="field survival-choice"><span>붕대 처치 목적</span>
        <select value={purpose} onChange={(event) => resetDice({ purpose: event.target.value as Treatment, check: { ...check, roll: null } })}>
          <option value="heal" disabled={healedHere}>Toughness 회복{healedHere ? ' · 이 방에서 적용함' : ''}</option>
          <option value="bleeding">출혈 해제</option>
          <option value="poisoned">중독 해제</option>
        </select>
      </label>
      <CheckInputs label="Medicine" value={check} result={result} onChange={(next) => resetDice({ purpose, check: next })} />
      {needsRecovery && <JournalRoll die={critical ? 'D10' : 'D4'} label="붕대 회복" value={recovery}
        onValue={(value) => setDraft({ ...draft, recovery: value })} resultText={recovery === null ? undefined : `Toughness +${recovery}`} />}
      {fumble && (
        <div className="survival-fields" aria-label="대실패 피해">
          <JournalRoll die="D6" label="Bludgeoning 피해 첫 번째" value={damage[0]} onValue={(value) => setDraft({ ...draft, damage: [value, damage[1]] })} />
          <JournalRoll die="D6" label="Bludgeoning 피해 두 번째" value={damage[1]} onValue={(value) => setDraft({ ...draft, damage: [damage[0], value] })} />
        </div>
      )}
      {result && (
        <div className="survival-actions">
          <span>Bandage −1{parts.length > 0 ? ` · ${parts.join(' · ')}` : ''}</span>
          <button className="btn ghost" type="button" disabled={!canTreat || (needsRecovery && recovery === null) || (fumble && fumbleDamage === null)} onClick={save}>
            붕대 처치 기록
          </button>
        </div>
      )}
      <div className="play-wrap-links"><XRef id="bandage-treatment">붕대 처치 규칙</XRef><XRef id="lingering-damage">지속 피해 규칙</XRef></div>
    </section>
  );
}

type RotTrigger = 'exposure' | 'breather' | 'camp';
const ROT_TRIGGER = { exposure: '처음 노출', breather: '숨 고르기 후', camp: '야영 후' } as const;
const ROT_STAGES = entryById.get('the-rot')!.outcomes!;

interface RotDraft {
  trigger: RotTrigger;
  stage: number;
  check: CheckDraft;
  exhaustion: number | null;
  health: number | null;
}

const EMPTY_ROT: RotDraft = { trigger: 'exposure', stage: 1, check: EMPTY_CHECK, exhaustion: null, health: null };

function RotTool({ onRecord }: { onRecord: SaveRecord }) {
  const [draft, setDraft] = usePlayDraftState<RotDraft>('rot', EMPTY_ROT);
  const commitRoll = usePlayRoll();
  const { trigger, stage, check, exhaustion, health } = draft;
  const start = trigger === 'exposure' ? 0 : stage;
  const result = start < 8 ? resolveDraft(check) : null;
  const next = result && !passed(result) ? start + 1 : start;
  const critical = result?.outcome === 'critical';
  const extra = critical || result?.outcome === 'fumble';
  const campHealth = result !== null && trigger === 'camp' && start >= 5 && next < 8;
  const resultTitle = next === 0 ? '감염 없음' : start === 0 ? '감염 · 1단계로 진행' : next !== start ? `${next}단계로 진행` : `${next}단계 유지`;
  const stageInfo = ROT_STAGES[next - 1]?.text;
  const save = () => {
    if (!result || (extra && exhaustion === null) || (campHealth && health === null)) return;
    const changes = next > start ? [`부패병 ${next}단계 · ${stageInfo}`] : [];
    if (critical) changes.push('Health +1 (Endurance 대성공)');
    if (extra) changes.push(`Exhaustion ${critical ? '−' : '+'}${exhaustion} (Endurance ${CHECK_LABEL[result.outcome]})`);
    if (campHealth) changes.push(`Health +${health} (부패병 야영 효과)`);
    commitRoll(() => {
      onRecord({ kind: 'rot', summary: `부패병 ${ROT_TRIGGER[trigger]} · ${resultTitle}`, changes });
      setDraft({ ...draft, check: { ...check, roll: null }, exhaustion: null, health: null });
    });
  };

  return (
    <section className="survival-card" aria-label="부패병 판정">
      <h3>부패병 판정</h3>
      <div className="survival-fields">
        <label className="field"><span>판정 시점</span>
          <select value={trigger} onChange={(event) => setDraft({ ...draft, trigger: event.target.value as RotTrigger,
            check: { ...check, roll: null }, exhaustion: null, health: null })}>
            {Object.entries(ROT_TRIGGER).map(([id, label]) => <option value={id} key={id}>{label}</option>)}
          </select>
        </label>
        {trigger !== 'exposure' && (
          <label className="field"><span>현재 부패병 단계</span>
            <select value={stage} onChange={(event) => setDraft({ ...draft, stage: Number(event.target.value),
              check: { ...check, roll: null }, exhaustion: null, health: null })}>
              {ROT_STAGES.map(({ label }, index) => <option value={index + 1} key={label}>{label}</option>)}
            </select>
          </label>
        )}
      </div>
      {start < 8 && <CheckInputs label="Endurance" value={check} result={result} onChange={(value) => setDraft({ ...draft,
        check: value, exhaustion: null, health: null })} />}
      {result && (
        <div className="survival-preview" role="status" aria-label="부패병 결과">
          <strong>{resultTitle}</strong>{stageInfo && <span>{stageInfo}</span>}
        </div>
      )}
      {start === 8 && <p className="survival-notice">{stageInfo}</p>}
      {extra && <JournalRoll die="D4" label={`Endurance ${critical ? '대성공' : '대실패'} Exhaustion`} value={exhaustion}
        onValue={(value) => setDraft({ ...draft, exhaustion: value })}
        resultText={exhaustion === null ? undefined : `${critical ? 'Health +1 · ' : ''}Exhaustion ${critical ? '−' : '+'}${exhaustion}`} />}
      {campHealth && <JournalRoll die="D4" label="부패병 야영 Health" value={health} onValue={(value) => setDraft({ ...draft, health: value })}
        resultText={health === null ? undefined : `Health +${health}`} />}
      {result && <button className="btn ghost survival-action" type="button" disabled={(extra && exhaustion === null) || (campHealth && health === null)}
        onClick={save}>부패병 판정 기록</button>}
      <div className="play-wrap-links"><XRef id="the-rot">부패병 단계 규칙</XRef></div>
    </section>
  );
}

interface GrowthDraft {
  name: string;
  score: string;
  roll: number | null;
  gain: number | null;
}

const EMPTY_GROWTH: GrowthDraft = { name: '', score: '', roll: null, gain: null };

function GrowthTool({ recorded, onRecord }: { recorded: string[]; onRecord: SaveRecord }) {
  const [draft, setDraft] = usePlayDraftState<GrowthDraft>('skill-growth', EMPTY_GROWTH);
  const commitRoll = usePlayRoll();
  const pending = usePendingSkillGrowth();
  const clearGrowth = useClearSkillGrowth();
  const scoreField = useRef<HTMLInputElement>(null);
  const { name, score, roll, gain } = draft;
  const skill = skillGrowthName(name);
  const key = skillGrowthKey(name);
  const pendingSkill = skill !== undefined && pending.includes(skill);
  const duplicate = !pendingSkill && recorded.some((record) => skillGrowthKey(record) === key);
  const current = encounterInteger(score);
  const valid = current !== null && current >= 0 && current <= 80;
  const uncapped = valid && current < 80;
  const above = uncapped && roll !== null && roll > current;
  const increase = !uncapped || roll === null ? null : above ? gain : 1;
  const next = increase !== null && current !== null ? Math.min(80, current + increase) : null;
  const change = next !== null && current !== null ? `${skill ?? name.trim()} ${current} → ${next} (+${next - current})` : '';
  const chooseSkill = (name: string) => {
    setDraft((previous) => skillGrowthKey(previous.name) === skillGrowthKey(name)
      ? { ...previous, name } : { ...EMPTY_GROWTH, name });
  };

  return (
    <section className="survival-card" aria-label="야영 기술 성장">
      <h3>야영 기술 성장</h3>
      <p className="survival-notice">종이 시트에서 성장 표시한 기술을 야영 중 기술마다 한 번 처리합니다.</p>
      {pending.length > 0 && <div className="survival-growth-options" role="group" aria-label="성장 대기 기술">
        {pending.map((item) => <button type="button" key={item} className="btn ghost"
          onClick={() => {
            chooseSkill(item);
            scoreField.current?.focus();
          }}>{item}</button>)}
      </div>}
      <div className="survival-fields">
        <label className="field"><span>기술 이름</span>
          <input maxLength={80} value={name} onChange={(event) => chooseSkill(event.target.value)}
            placeholder="예 Medicine" aria-invalid={!!name.trim() && !skill || undefined} />
        </label>
        <label className="field"><span>현재 Skill</span>
          <input ref={scoreField} inputMode="numeric" value={score} placeholder="0–80" aria-invalid={!!score.trim() && !valid || undefined}
            onChange={(event) => setDraft({ ...draft, score: event.target.value, roll: null, gain: null })} />
        </label>
      </div>
      {!!name.trim() && !skill && <p className="field-err" role="alert">성장 대상 기술 이름을 입력하세요.</p>}
      {!!score.trim() && !valid && <p className="field-err" role="alert">현재 Skill은 0–80 사이의 정수로 입력하세요.</p>}
      {valid && !uncapped && <p className="survival-notice" role="status">성장 상한 80에 도달했습니다.</p>}
      {uncapped && <JournalRoll die="D100" label="기술 성장" value={roll} onValue={(value) => setDraft({ ...draft, roll: value, gain: null })}
        resultText={roll === null ? undefined : above ? '현재 Skill 초과 · D4 성장' : '현재 Skill 이하 · +1 성장'} />}
      {above && <JournalRoll die="D4" label="성장량" value={gain} onValue={(value) => setDraft({ ...draft, gain: value })} />}
      {duplicate && <p className="field-err" role="alert">이 기술을 다시 성장시키려면 새 성장 표시가 필요합니다.</p>}
      {next !== null && (
        <div className="survival-actions">
          <strong role="status">{change.trim()}</strong>
          <button className="btn ghost" type="button" disabled={!skill || duplicate} onClick={() => commitRoll(() => {
            onRecord({ kind: 'growth', key, summary: `기술 성장 · ${change}`, changes: [`${change} (성장 표시 지우기)`] });
            if (skill) clearGrowth(skill);
            setDraft(EMPTY_GROWTH);
          })}>기술 성장 기록</button>
        </div>
      )}
      {pendingSkill && <button className="btn ghost survival-action" type="button" onClick={() => commitRoll(() => {
        clearGrowth(skill);
        setDraft(EMPTY_GROWTH);
      })}>종이 시트에서 성장 표시를 지웠어요</button>}
      <div className="play-wrap-links"><XRef id="skill-improvement">기술 성장 규칙</XRef></div>
    </section>
  );
}

export function PlaySurvival({ pane, onPane, onReport }: {
  pane: SurvivalPane;
  onPane: (pane: SurvivalPane) => void;
  onReport: (report: SurvivalReport) => void;
}) {
  const [records, setRecords] = usePlayDraftState<SurvivalRecord[]>('records', []);
  const report = useMemo(() => ({
    summary: records.map(({ summary }) => summary).join(' · '),
    sheet: records.flatMap(({ kind, changes }, index) => changes.map((text, part) => ({
      id: `survival:${index}:${part}`, text,
      gear: kind === 'treatment' && text === 'Bandage −1 (붕대 처치)' ? gearCount('Bandage', -1) : undefined,
    }))),
  }), [records]);
  useEffect(() => { onReport(report); }, [onReport, report]);
  const onRecord: SaveRecord = (record) => setRecords((previous) => [...previous, record]);

  return (
    <section className="play-survival" aria-label="치료·성장 도구">
      <div className="seg survival-nav" role="group" aria-label="치료·성장 선택">
        <button type="button" aria-pressed={pane === 'treatment'} onClick={() => onPane('treatment')}>붕대·지속 피해</button>
        <button type="button" aria-pressed={pane === 'rot'} onClick={() => onPane('rot')}>부패병</button>
        <button type="button" aria-pressed={pane === 'growth'} onClick={() => onPane('growth')}>기술 성장</button>
      </div>
      <div hidden={pane !== 'treatment'}><TreatmentTool onRecord={onRecord} healedHere={records.some(({ kind, key }) => kind === 'treatment' && key === 'heal')} /></div>
      <div hidden={pane !== 'rot'}><RotTool onRecord={onRecord} /></div>
      <div hidden={pane !== 'growth'}><GrowthTool onRecord={onRecord} recorded={records.filter(({ kind }) => kind === 'growth').flatMap(({ key }) => key ?? [])} /></div>
      {records.length > 0 && <ul className="survival-records" aria-label="이번 장소 치료·성장 결과">
        {records.map(({ summary }, index) => <li key={index}>{summary}</li>)}
      </ul>}
    </section>
  );
}
