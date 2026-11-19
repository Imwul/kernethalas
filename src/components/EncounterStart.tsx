import { useId } from 'react';
import type { CreatureRecord } from '../content/entries/creatures';
import type { CheckResult, Edge } from '../lib/dice';
import { encounterCheck, encounterFear, encounterInitiativeModifier, encounterInteger, encounterOpposed } from '../lib/encounter-start';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraft, usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { isSkillDouble, skillCriticalEffect } from '../lib/skill-criticals';
import { useRecordSkillCritical } from '../lib/skill-growth';
import { XRef } from './bits';
import '../styles/encounter-start.css';

type StartMode = 'initiative' | 'surprise' | 'ambushed';
type RollDraft = { roll: string; edge: Edge; growthRecorded?: boolean };
const emptyRoll: RollDraft = { roll: '', edge: 'none' };
const emptyCheck = { ...emptyRoll, skill: '' };
const labels = { pc: 'PC 측 선공', enemy: '적 측 선공', reroll: '동률 · 다시 굴림', undefined: '원문에 승자 명시 없음' } as const;

function changeCriticalRoll<T extends RollDraft>(draft: T, roll: string): T {
  const sameRoll = readOracleValue(roll.trim(), 100) === readOracleValue(draft.roll.trim(), 100);
  return { ...draft, roll, growthRecorded: sameRoll && draft.growthRecorded };
}

function CheckField({ label, value, set, roll = false, nonnegative = false }: {
  label: string; value: string; set: (value: string) => void; roll?: boolean; nonnegative?: boolean;
}) {
  const id = useId();
  const parsed = roll ? readOracleValue(value.trim(), 100) : encounterInteger(value);
  const invalid = value.trim() !== '' && (parsed === null || (nonnegative && parsed < 0));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} value={value} inputMode={roll || nonnegative ? 'numeric' : 'text'}
        onChange={(event) => set(event.target.value)} placeholder={roll ? '1–100 / 00' : undefined}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined} />
      {invalid && <p id={`${id}-error`} className="field-err">
        {roll ? '1–100 또는 00을 입력하세요.' : nonnegative ? '0 이상의 정수를 입력하세요.' : '정수를 입력하세요.'}
      </p>}
    </div>
  );
}

function EdgeField({ label, value, set }: { label: string; value: Edge; set: (value: Edge) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => set(event.target.value as Edge)}>
        <option value="none">없음</option>
        <option value="advantage">Advantage</option>
        <option value="disadvantage">Disadvantage</option>
      </select>
    </div>
  );
}

function CriticalEffect({ skill, check }: { skill: 'Initiative' | 'Stealth'; check: CheckResult | null }) {
  if (!check || !isSkillDouble(check.outcome)) return null;
  const effect = skillCriticalEffect(skill, check.outcome);
  return effect ? <p className="encounter-note">PC {check.outcome === 'critical' ? '대성공' : '대실패'} · {effect}</p> : null;
}

function EncounterCriticalRecord({ skill, check, recorded, onRecord }: {
  skill: 'Stealth' | 'Perception' | 'Resolve';
  check: CheckResult | null;
  recorded?: boolean;
  onRecord: () => void;
}) {
  const play = usePlayDraft();
  if (!play || !check || !isSkillDouble(check.outcome)) return null;
  return (
    <button className="btn ghost" type="button" disabled={recorded} onClick={onRecord}>
      {skill === 'Resolve'
        ? `Resolve 더블 저널에 ${recorded ? '기록됨' : '기록'}`
        : `${skill} 야영 성장 ${recorded ? '표시됨' : '표시'}`}
    </button>
  );
}

export function EncounterStart({ creature }: { creature?: Pick<CreatureRecord, 'name' | 'mind' | 'traits'> }) {
  const id = useId();
  const commit = usePlayRoll();
  const record = useRecordSkillCritical();
  const knownFear = encounterFear(creature?.traits ?? []);
  const knownAlert = creature?.traits.includes('Alert') ?? false;
  const [mode, setMode] = usePlayDraftState<StartMode>('start-mode', 'initiative');
  const [alert, setAlert] = usePlayDraftState('start-alert', false);
  const [fear, setFear] = usePlayDraftState('start-fear', 0);
  const [mindOverride, setMind] = usePlayDraftState<string | null>('start-mind', null);
  const [resolve, setResolve] = usePlayDraftState('start-resolve', emptyCheck);
  const [stealth, setStealth] = usePlayDraftState('start-stealth', emptyCheck);
  const [perception, setPerception] = usePlayDraftState('start-perception', emptyCheck);
  const [surpriseEnemy, setSurpriseEnemy] = usePlayDraftState('start-enemy-surprise', emptyRoll);
  const [initiativeEnemy, setInitiativeEnemy] = usePlayDraftState('start-enemy-initiative', emptyRoll);
  const [followers, setFollowers] = usePlayDraftState('start-followers', '');
  const [quick, setQuick] = usePlayDraftState('start-quick', false);

  const mind = mindOverride ?? creature?.mind ?? '';
  const alertActive = knownAlert || alert;
  const fearLoss = Math.max(knownFear, fear);
  const enemyMind = encounterInteger(mind);
  const resolveCheck = encounterCheck(resolve.roll, encounterInteger(resolve.skill), resolve.edge);
  const fearFumble = `Sanity ${fearLoss} + D4 손실`;
  const followerCount = followers.trim() ? encounterInteger(followers) : 0;
  const stealthSkill = encounterInteger(stealth.skill);
  const stealthTarget = stealthSkill === null || followerCount === null || followerCount < 0
    ? null : stealthSkill - followerCount * 10;
  const surprisePC = encounterCheck(stealth.roll, stealthTarget, stealth.edge);
  const enemySurpriseCheck = encounterCheck(surpriseEnemy.roll, enemyMind, surpriseEnemy.edge);
  const surprise = mode === 'surprise' && !alertActive && surprisePC && enemySurpriseCheck
    ? encounterOpposed(surprisePC, enemySurpriseCheck) : null;
  const failedSurprise = surprise?.winner === 'enemy';
  const perceptionSkill = encounterInteger(perception.skill);
  const initiativeModifier = encounterInitiativeModifier(failedSurprise, quick);
  const initiativeTarget = perceptionSkill === null ? null : perceptionSkill + initiativeModifier;
  const initiativePC = encounterCheck(perception.roll, initiativeTarget, perception.edge);
  const enemyInitiativeCheck = encounterCheck(initiativeEnemy.roll, enemyMind, initiativeEnemy.edge);
  const initiative = initiativePC && enemyInitiativeCheck ? encounterOpposed(initiativePC, enemyInitiativeCheck) : null;

  return (
    <section className="encounter-start" aria-label="조우 시작 계산기">
      <div className="encounter-grid">
        <CheckField label="적 최고 Mind" value={mind} set={setMind} />
        <div className="field">
          <label htmlFor={`${id}-mode`}>조우 시작 방식</label>
          <select id={`${id}-mode`} value={alertActive && mode === 'surprise' ? 'initiative' : mode} onChange={(event) => setMode(event.target.value as StartMode)}>
            <option value="initiative">Initiative부터</option>
            <option value="surprise" disabled={alertActive}>PC가 기습 시도</option>
            <option value="ambushed">적에게 기습당함</option>
          </select>
        </div>
      </div>
      {creature && <p className="encounter-note">{creature.name} 기본 Mind {creature.mind}. 적이 여럿이면 가장 높은 Mind를 사용하세요.</p>}
      <div className="encounter-traits">
        <label className="encounter-option">
          <input type="checkbox" checked={alertActive} disabled={knownAlert} onChange={(event) => {
            setAlert(event.target.checked);
            if (event.target.checked && mode === 'surprise') setMode('initiative');
          }} /> 조우에 Alert 적 있음
        </label>
        <div className="field">
          <label htmlFor={`${id}-fear`}>조우의 공포 특성</label>
          <select id={`${id}-fear`} value={fearLoss} onChange={(event) => setFear(Number(event.target.value))}>
            <option value={0} disabled={knownFear > 0}>없음</option>
            <option value={2} disabled={knownFear > 2}>Frightening</option>
            <option value={4}>Horrifying</option>
          </select>
        </div>
      </div>
      {alertActive && <p className="encounter-note"><XRef id="creature-traits">Alert</XRef> 적은 기습할 수 없습니다.</p>}

      {fearLoss > 0 && (
        <fieldset className="encounter-check">
          <legend>Resolve · 조우당 1회</legend>
          <p className="encounter-note">실패하면 Sanity {fearLoss} 손실. 공포 특성이 여럿이면 가장 큰 손실을 적용합니다.</p>
          <div className="encounter-grid">
            <CheckField label="PC Resolve" value={resolve.skill} set={(skill) => setResolve({ ...resolve, skill })} />
            <CheckField label="Resolve D100" value={resolve.roll} roll set={(roll) => setResolve(changeCriticalRoll(resolve, roll))} />
            <EdgeField label="Resolve 이점" value={resolve.edge} set={(edge) => setResolve({ ...resolve, edge })} />
          </div>
          {resolveCheck && (
            <p className="encounter-outcome" role="status" aria-label="Resolve 결과">
              {resolveCheck.outcome === 'critical' ? '대성공 · Sanity D4+1 회복'
                : resolveCheck.outcome === 'success' ? '성공 · Sanity 유지'
                  : resolveCheck.outcome === 'fumble' ? `대실패 · ${fearFumble}`
                    : `실패 · Sanity ${fearLoss} 손실`}
            </p>
          )}
          {resolveCheck && <EncounterCriticalRecord skill="Resolve" check={resolveCheck} recorded={resolve.growthRecorded} onRecord={() => commit(() => {
            setResolve({ ...resolve, growthRecorded: true });
            record('Resolve', resolveCheck, 'Resolve', resolveCheck.outcome === 'fumble' ? fearFumble : undefined);
          })} />}
        </fieldset>
      )}

      {mode === 'ambushed' && (
        <div className="verdict" role="status" aria-label="기습 결과">
          <b>적 측 선공</b>
          <p className="encounter-note">적의 기습에 붙는 수치 보너스는 코어북에 명시되어 있지 않습니다.</p>
        </div>
      )}
      {mode === 'surprise' && !alertActive && (
        <fieldset className="encounter-check">
          <legend>기습 · Stealth 대 Mind</legend>
          <div className="encounter-grid">
            <CheckField label="PC 최저 Stealth" value={stealth.skill} set={(skill) => setStealth({ ...stealth, skill })} />
            <CheckField label="솔로 동료 수" value={followers} set={setFollowers} nonnegative />
            <CheckField label="PC 기습 D100" value={stealth.roll} roll set={(roll) => setStealth(changeCriticalRoll(stealth, roll))} />
            <CheckField label="적 기습 D100" value={surpriseEnemy.roll} roll set={(roll) => setSurpriseEnemy({ ...surpriseEnemy, roll })} />
            <EdgeField label="PC 기습 이점" value={stealth.edge} set={(edge) => setStealth({ ...stealth, edge })} />
            <EdgeField label="적 기습 이점" value={surpriseEnemy.edge} set={(edge) => setSurpriseEnemy({ ...surpriseEnemy, edge })} />
          </div>
          <p className="encounter-note">PC가 혼자이고 동료가 있으면 동료마다 Stealth −10.{stealthTarget !== null && ` 적용 Skill ${stealthTarget}.`}</p>
          {surprise && (
            <div className="verdict" role="status" aria-label="기습 결과">
              <b>{surprise.winner === 'pc' ? '기습 성공 · PC 측 선공'
                : failedSurprise ? '기습 실패 · Initiative 판정으로' : labels[surprise.winner]}</b>
              <p className="encounter-note">{surprise.reason}</p>
              {surprise.winner === 'pc' && <p className="encounter-note">PC 측 첫 공격 +20.</p>}
              {failedSurprise && <p className="encounter-note">다음 Initiative의 Perception −20.</p>}
              <CriticalEffect skill="Stealth" check={surprisePC} />
            </div>
          )}
          {surprise && surprisePC && <EncounterCriticalRecord skill="Stealth" check={surprisePC} recorded={stealth.growthRecorded} onRecord={() => commit(() => {
            setStealth({ ...stealth, growthRecorded: true });
            record('Stealth', surprisePC);
          })} />}
        </fieldset>
      )}
      {(mode === 'initiative' || failedSurprise || (mode === 'surprise' && alertActive)) && (
        <fieldset className="encounter-check">
          <legend>Initiative · Perception 대 Mind</legend>
          <div className="encounter-grid">
            <CheckField label="PC 최고 Perception" value={perception.skill} set={(skill) => setPerception({ ...perception, skill })} />
            <CheckField label="PC Initiative D100" value={perception.roll} roll set={(roll) => setPerception(changeCriticalRoll(perception, roll))} />
            <CheckField label="적 Initiative D100" value={initiativeEnemy.roll} roll set={(roll) => setInitiativeEnemy({ ...initiativeEnemy, roll })} />
            <EdgeField label="PC Initiative 이점" value={perception.edge} set={(edge) => setPerception({ ...perception, edge })} />
            <EdgeField label="적 Initiative 이점" value={initiativeEnemy.edge} set={(edge) => setInitiativeEnemy({ ...initiativeEnemy, edge })} />
          </div>
          <label className="encounter-option">
            <input type="checkbox" checked={quick} onChange={(event) => setQuick(event.target.checked)} /> Quick 무기 +10
          </label>
          {initiativeTarget !== null && (quick || failedSurprise) && <p className="encounter-note">보정된 Perception {initiativeTarget}.</p>}
          {initiative && (
            <div className="verdict" role="status" aria-label="Initiative 결과">
              <b>{labels[initiative.winner]}</b>
              <p className="encounter-note">{initiative.reason}</p>
              <CriticalEffect skill="Initiative" check={initiativePC} />
            </div>
          )}
          {initiative && initiativePC && <EncounterCriticalRecord skill="Perception" check={initiativePC} recorded={perception.growthRecorded} onRecord={() => commit(() => {
            setPerception({ ...perception, growthRecorded: true });
            record('Perception', initiativePC, 'Initiative');
          })} />}
        </fieldset>
      )}
      <div className="encounter-links">
        <XRef id="surprise">기습</XRef>
        <XRef id="initiative">Initiative</XRef>
        {fearLoss > 0 && <XRef id="frightening-horrifying">공포 특성</XRef>}
        {fearLoss > 0 && <XRef id="p-sanity">Sanity 손실 처리</XRef>}
      </div>
    </section>
  );
}
