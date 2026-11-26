import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { tableById } from '../content';
import { rollDie } from '../lib/dice';
import { forceOpeningBonus, lockpickDifficulty, LOCK_THRESHOLDS, trapInvestigation, type Detection, type LockTarget } from '../lib/lock-trap';
import { readOracleValue } from '../lib/oracle';
import { PlayDraftScope, usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import type { PlayRollDetails } from '../lib/play-roll-history';
import { XRef } from './bits';
import { PerkNote } from './PerkNote';
import { PhysicalSkillRoll, skillCheckSucceeded } from './PhysicalSkillRoll';
import { TensionTool, type TensionResult } from './TensionTool';
import { PlayDieHint } from './play/PlayDieHints';
import '../styles/lock-trap.css';

/** Core p.212: Thieves’ Toolkit, required to disarm traps, gives +5 to Thievery. */
const TOOLKIT_BONUS = 5;

const TARGETS = { door: '문', container: '용기', environment: '환경 함정' } as const;
type Outcome = 'success' | 'failure';
type TrapMethod = '' | 'disarm' | 'bypass' | 'trigger';

export interface PlayLockReport {
  text: string;
  opened: boolean;
  lockpicks: number;
  xp: number;
  pendingTension: boolean;
}

interface OpeningResult { opened: boolean; lockpicks: number; pendingTension: boolean }
const EMPTY_OPENING_RESULT: OpeningResult = { opened: false, lockpicks: 0, pendingTension: false };

interface EmbeddedLock {
  target: LockTarget;
  onReport: (result: PlayLockReport) => void;
  renderTension: (attempt: string) => ReactNode;
  tensionReady: (attempt: string) => boolean;
}

export function LockTrapTool({ embedded }: { embedded?: EmbeddedLock } = {}) {
  const id = useId();
  const [target, setTarget] = useState<LockTarget>('door');
  const [revision, setRevision] = useState(0);

  return (
    <section className="lock-trap-tool" aria-labelledby={`${id}-title`}>
      <div className="lock-trap-head">
        {embedded ? <h4 id={`${id}-title`}>{TARGETS[embedded.target]} 조사</h4> : <h2 id={`${id}-title`}>문·용기·함정 판정</h2>}
        {!embedded && <button type="button" className="btn ghost" onClick={() => setRevision(revision + 1)}>새 대상</button>}
      </div>
      {!embedded && <div className="seg lock-trap-targets" role="group" aria-label="조사할 대상">
        {(Object.keys(TARGETS) as LockTarget[]).map((value) => (
          <button key={value} type="button" aria-pressed={target === value} onClick={() => setTarget(value)}>{TARGETS[value]}</button>
        ))}
      </div>}
      <LockTrapCase key={`${embedded?.target ?? target}:${revision}`} target={embedded?.target ?? target} embedded={embedded} />
      <div className="lock-trap-links"><XRef id="locks-traps">자물쇠와 함정 규칙</XRef></div>
    </section>
  );
}

function LockTrapCase({ target, embedded }: { target: LockTarget; embedded?: EmbeddedLock }) {
  const [detection, setDetection] = usePlayDraftState<Detection>('lock-detection', '');
  const [touched, setTouched] = usePlayDraftState('lock-touched', false);
  const [trapRaw, setTrapRaw] = usePlayDraftState('lock-trap-roll', '');
  const [lockRaw, setLockRaw] = usePlayDraftState('lock-locked-roll', '');
  const [disarmed, setDisarmed] = usePlayDraftState('lock-disarmed', false);
  const [openedUnlocked, setOpenedUnlocked] = usePlayDraftState('lock-opened-unlocked', false);
  const [investigation, setInvestigation] = usePlayDraftState('lock-investigation', 0);
  const [locks, setLocks] = usePlayDraftState('lock-check-revision', 0);
  const [trapReport, setTrapReport] = useState({ text: '', xp: 0 });
  const [openingReport, setOpeningReport] = useState(EMPTY_OPENING_RESULT);
  const trapInput = useRef<HTMLInputElement>(null);
  const trapDie = readOracleValue(trapRaw.trim(), 10);
  const lockDie = readOracleValue(lockRaw.trim(), 20);
  const environment = target === 'environment';
  const trap = trapInvestigation(target, detection, touched, trapDie);
  const locked = environment || lockDie === null ? null : lockDie >= LOCK_THRESHOLDS[target];
  const canOpen = trap === 'clear' || disarmed;
  const unlocked = !environment && canOpen && locked === false;
  const reportCallback = embedded?.onReport;
  const opened = unlocked && openedUnlocked || canOpen && locked === true && openingReport.opened;
  const opening = canOpen && locked === true ? openingReport : EMPTY_OPENING_RESULT;
  const { lockpicks, pendingTension } = opening;
  const xp = ((trap === 'spotted' || trap === 'triggered') ? trapReport.xp : 0) + (opened && locked ? 10 : 0);
  const text = [
    trap === 'spotted' || trap === 'triggered' ? trapReport.text || (trap === 'spotted' ? '함정 발견' : '함정 발동') : trap === 'clear' ? '함정 없음' : '',
    opened ? `${TARGETS[target]} 개방` : locked === true ? `${TARGETS[target]} 잠김` : locked === false ? `${TARGETS[target]} 잠기지 않음` : '',
  ].filter(Boolean).join(' · ');
  useEffect(() => { reportCallback?.({ text, opened, lockpicks, xp, pendingTension }); }, [reportCallback, text, opened, lockpicks, xp, pendingTension]);

  const resetResponses = () => {
    setInvestigation((previous) => previous + 1);
    setTrapReport({ text: '', xp: 0 });
    setOpeningReport(EMPTY_OPENING_RESULT);
    setOpenedUnlocked(false);
  };
  const applyDetection = (value: Detection) => {
    setDetection(value);
    setTouched(false);
    setTrapRaw('');
    setDisarmed(false);
    resetResponses();
  };

  return (
    <>
      <section className="lock-trap-step" aria-label="대상 조사">
        <h3>조사</h3>
        {environment && <p>이벤트 등으로 환경 함정이 있는 장소에서 조사합니다.</p>}
        <div className="lock-trap-fields">
          <RollCheck label="탐지" skill="Perception" randomDifficulty onResult={applyDetection} />
          <div className="lock-trap-links"><XRef id="t-difficulty">탐지 난이도 D8</XRef></div>
          {trap === 'choose' && (
            <div className="lock-trap-wide lock-trap-choices">
              <p>대상을 그대로 두거나 건드려 함정 여부를 확인할 수 있습니다.</p>
              <button type="button" className="btn ghost" onClick={() => {
                setTouched(true);
                requestAnimationFrame(() => trapInput.current?.focus());
              }}>대상 건드리기</button>
            </div>
          )}
          {!environment && (detection === 'success' || touched) && (
            <TrapRoll label="함정 여부 D10" sides={10} value={trapRaw} inputRef={trapInput} confirm={!!embedded} onChange={(value) => {
              setTrapRaw(value);
              setDisarmed(false);
              resetResponses();
            }} />
          )}
          {!environment && <TrapRoll label="잠김 여부 D20" sides={20} value={lockRaw} confirm={!!embedded} onChange={(raw) => {
            setLockRaw(raw);
            setLocks((previous) => previous + 1);
            setOpenedUnlocked(false);
            setOpeningReport(EMPTY_OPENING_RESULT);
          }} />}
        </div>
        <p className="lock-trap-status" role="status">
          {trap === 'clear' && <span>함정 없음</span>}
          {trap === 'spotted' && <span>함정 발견</span>}
          {trap === 'triggered' && <span>함정 발동</span>}
          {locked !== null && <span>{TARGETS[target]} {locked ? '잠김' : '잠기지 않음'}</span>}
        </p>
      </section>
      {(trap === 'spotted' || trap === 'triggered') && (
        <PlayDraftScope name={`trap-${investigation}`}>
          <TrapResponse key={`${trap}:${investigation}`} environment={environment} known={trap === 'spotted'} confirm={!!embedded}
            onDisarmed={setDisarmed} onReport={embedded ? setTrapReport : undefined} />
        </PlayDraftScope>
      )}
      {!environment && canOpen && locked === true && <PlayDraftScope name={`opening-${investigation}-${locks}`}>
        <LockResponse key={`${trap}:${investigation}:${locks}`} container={target === 'container'} embedded={embedded}
          onReport={embedded ? setOpeningReport : undefined} attemptKey={`${investigation}-${locks}`} />
      </PlayDraftScope>}
      {unlocked && <p className="lock-trap-note">{openedUnlocked ? `${TARGETS[target]} 열림` : '잠기지 않아 바로 열 수 있습니다.'}</p>}
      {embedded && unlocked && !openedUnlocked && <div className="lock-trap-links">
        <button type="button" className="btn ghost" onClick={() => setOpenedUnlocked(true)}>{TARGETS[target]} 열기</button>
      </div>}
      {!embedded && target === 'container' && unlocked && (
        <div className="lock-trap-links"><XRef id="t-deep-search">깊은 수색으로 찾은 용기를 열었을 때</XRef></div>
      )}
    </>
  );
}

function TrapRoll({ label, sides, value, inputRef, onChange, confirm = false }: {
  label: string;
  sides: number;
  value: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  confirm?: boolean;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [submittedInvalid, setSubmittedInvalid] = useState(false);
  const commitRoll = usePlayRoll();
  const input = usePlayRollField(`trap:${label}`, label, `D${sides}`, readOracleValue(value, sides) !== null);
  const field = confirm ? draft ?? value : value;
  const invalid = submittedInvalid || field.trim() !== '' && readOracleValue(field.trim(), sides) === null;
  const apply = (roll: number, source: PlayRollDetails['source']) => {
    commitRoll(() => onChange(String(roll)), { label, dice: `D${sides}`, value: String(roll), source, field: input['data-play-roll-field'] });
    setDraft(null);
    setSubmittedInvalid(false);
  };
  const contents = <>
    <input id={id} ref={inputRef} {...(confirm ? input : {})} inputMode="numeric" autoComplete="off"
      placeholder={`1–${sides}`} value={field} aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : undefined} onChange={(event) => {
        if (confirm) setDraft(event.target.value);
        else onChange(event.target.value);
        setSubmittedInvalid(false);
      }} />
    {confirm && <button type="submit" className="btn ghost" aria-label={`${label} 확인`}>확인</button>}
    <button type="button" className="btn ghost" aria-label={`${label} 굴리기`} onClick={() => apply(rollDie(sides), 'app')}>굴리기</button>
  </>;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label><PlayDieHint dice={`D${sides}`} sides={sides} />
      {confirm ? <form className="lock-trap-roll" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        const roll = readOracleValue(field.trim(), sides);
        if (roll === null) setSubmittedInvalid(true);
        else apply(roll, 'manual');
      }}>{contents}</form> : <div className="lock-trap-roll">{contents}</div>}
      {invalid && <span id={`${id}-error`} className="field-err">{sides} 이하의 양의 정수를 입력하세요.</span>}
    </div>
  );
}

function TrapResponse({ environment, known, onDisarmed, onReport, confirm }: {
  environment: boolean;
  known: boolean;
  onDisarmed: (resolved: boolean) => void;
  onReport?: (result: { text: string; xp: number }) => void;
  confirm: boolean;
}) {
  const id = useId();
  const [kind, setKind] = usePlayDraftState('kind', '');
  const [method, setMethod] = usePlayDraftState<TrapMethod>('method', '');
  const [result, setResult] = usePlayDraftState<Outcome | null>('result', null);
  const [avoided, setAvoided] = usePlayDraftState<Outcome | null>('avoided', null);
  const [attempt, setAttempt] = usePlayDraftState('check-attempt', 0);
  const roll = readOracleValue(kind.trim(), 10);
  const row = tableById.get('t-traps')?.rows.find((item) => item.min === roll);
  const triggered = !known || method === 'trigger' || result === 'failure';
  const xp = result === 'success' && method === 'disarm' ? 10 : 0;
  const text = xp > 0 ? '함정 해제'
    : result === 'success' && method === 'bypass' ? '함정 우회'
      : avoided && row ? `함정 ${avoided === 'success' ? '회피 성공' : `회피 실패 · ${row.ko}`}` : '';
  useEffect(() => { onReport?.({ text, xp }); }, [onReport, text, xp]);
  const clearChoice = () => {
    setAttempt((previous) => previous + 1);
    setResult(null);
    setAvoided(null);
    onDisarmed(false);
  };
  const applyResponse = (value: Outcome) => {
    setResult(value);
    onDisarmed(value === 'success' && method === 'disarm');
  };
  const applyAvoidance = (value: Outcome) => {
    setAvoided(value);
    onDisarmed(true);
  };

  return (
    <section className="lock-trap-step" aria-label="함정 처리">
      <h3>함정 처리</h3>
      <div className="lock-trap-fields">
        <TrapRoll label="함정 종류 D10" sides={10} value={kind} confirm={confirm} onChange={(value) => {
          setKind(value);
          setMethod('');
          clearChoice();
        }} />
        <div className="lock-trap-links"><XRef id="t-traps">함정 표 열기</XRef></div>
      </div>
      {row && (
        <>
          <p className="lock-trap-note"><b>{row.cols?.avoid}</b> · {row.ko}</p>
          {known && (
            <div className="field lock-trap-select">
              <label htmlFor={`${id}-method`}>함정 처리 방법</label>
              <select id={`${id}-method`} value={method} onChange={(event) => {
                setMethod(event.target.value as TrapMethod);
                clearChoice();
              }}>
                <option value="">방법 선택</option>
                <option value="disarm">해제</option>
                {environment && <option value="bypass">우회</option>}
                <option value="trigger">고의 발동</option>
              </select>
            </div>
          )}
          {(method === 'disarm' || method === 'bypass') && (
            <>
              {method === 'disarm'
                ? <p className="lock-trap-links">Thieves’ Toolkit을 사용해 Thievery +5로 판정 <XRef id="t-difficulty">해제 난이도 D8</XRef></p>
                : <p>{row.cols?.avoid} +20으로 우회 판정</p>}
              <RollCheck key={attempt} slot={String(attempt)} label={method === 'disarm' ? '해제' : '우회'}
                skill={method === 'disarm' ? 'Thievery' : row.cols?.avoid ?? 'Skill'} randomDifficulty={method === 'disarm'}
                modifier={method === 'bypass' ? 20 : TOOLKIT_BONUS} readOnly={result !== null} onResult={applyResponse} />
            </>
          )}
          {result === 'success' && method === 'disarm' && <p className="lock-trap-note" role="status">함정 해제 · XP +10</p>}
          {result === 'success' && method === 'bypass' && (
            <p className="lock-trap-note" role="status">우회 성공. 문을 조사하거나 출구로 이동할 수 있습니다. 수색이나 다른 물체를 건드리면 함정이 발동합니다. 같은 함정을 다시 우회할 때는 Effortless(+20)입니다.</p>
          )}
          {triggered && (
            <>
              <p>함정 발동 · {row.cols?.avoid} {known ? '+20으로' : '탐지 보정 없이'} 회피 판정</p>
              <RollCheck key={attempt} slot={String(attempt)} label="회피" skill={row.cols?.avoid ?? 'Skill'} modifier={known ? 20 : 0}
                readOnly={avoided !== null} onResult={applyAvoidance} />
              {avoided && (
                <div className="lock-trap-note" role="status">
                  <p>{avoided === 'success' ? '회피 성공. 발동한 함정은 해제됩니다.' : '회피 실패. 위의 함정 효과를 적용한 뒤 함정은 해제됩니다.'}</p>
                  {avoided === 'failure' && row.next?.map(({ id: ref }) => <XRef key={ref} id={ref} />)}
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function RollCheck({ label, skill, randomDifficulty, modifier, slot = 'main', readOnly, onResult }: {
  label: string;
  skill: string;
  randomDifficulty?: boolean;
  modifier?: number;
  slot?: string;
  readOnly?: boolean;
  onResult: (result: Outcome) => void;
}) {
  return (
    <div className="lock-trap-physical lock-trap-wide">
      <PhysicalSkillRoll label={`${label} 판정`} skill={skill} randomDifficulty={randomDifficulty} modifier={modifier}
        slot={slot === 'main' ? `check-${label}` : `check-${label}-${slot}`} readOnly={readOnly}
        onResult={(result) => onResult(skillCheckSucceeded(result) ? 'success' : 'failure')} />
    </div>
  );
}

function LockResponse({ container, embedded, onReport, attemptKey }: {
  container: boolean;
  embedded?: EmbeddedLock;
  onReport?: (result: OpeningResult) => void;
  attemptKey: string;
}) {
  const id = useId();
  const [method, setMethod] = usePlayDraftState('method', 'pick');
  const [opened, setOpened] = usePlayDraftState('opened', false);
  const [pickFailures, setPickFailures] = usePlayDraftState('pick-failures', 0);
  const [forceFailures, setForceFailures] = usePlayDraftState('force-failures', 0);
  const [crowbar, setCrowbar] = usePlayDraftState('crowbar', false);
  const [forceResult, setForceResult] = usePlayDraftState<Outcome | null>('force-result', null);
  const [standaloneTension, setStandaloneTension] = usePlayDraftState<Record<number, TensionResult>>('force-tension', {});
  const openingMethod = useRef<HTMLSelectElement>(null);
  const tensionHeading = useRef<HTMLHeadingElement>(null);
  const attempt = `${attemptKey}-${forceFailures + 1}`;
  const tension = standaloneTension[forceFailures] ?? null;
  const tensionReady = !forceResult || (embedded ? embedded.tensionReady(attempt) : tension !== null);
  const openedReport = opened && tensionReady;
  useEffect(() => {
    onReport?.({ opened: openedReport, lockpicks: pickFailures, pendingTension: !tensionReady });
  }, [onReport, openedReport, pickFailures, tensionReady]);
  const applyPick = (value: Outcome) => {
    if (value === 'success') setOpened(true);
    else setPickFailures((previous) => previous + 1);
  };
  const applyForce = (value: Outcome) => {
    setForceResult(value);
    if (value === 'success') setOpened(true);
    requestAnimationFrame(() => tensionHeading.current?.focus());
  };

  return (
    <section className="lock-trap-step" aria-label="잠긴 대상 열기">
      <h3>잠긴 대상 열기</h3>
      {openedReport && <p className="lock-trap-note" role="status">개방 성공 · XP +10</p>}
      {openedReport && container && <PerkNote perk="Lucky Find">용기를 열 때마다 D20₵을 얻습니다.</PerkNote>}
      {!embedded && openedReport && container && (
        <div className="lock-trap-links"><XRef id="t-deep-search">깊은 수색으로 찾은 용기 보상</XRef></div>
      )}
      {!opened && !forceResult && (
        <div className="field lock-trap-select">
          <label htmlFor={`${id}-lock`}>개방 방법</label>
          <select id={`${id}-lock`} ref={openingMethod} value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="pick">자물쇠 따기</option>
            <option value="force">강제 개방</option>
          </select>
        </div>
      )}
      {method === 'pick' && (
        <>
          {!opened && <p>Lockpick을 사용해 Thievery +{lockpickDifficulty(pickFailures)}로 판정합니다. Thieves’ Toolkit의 +{TOOLKIT_BONUS}가 자물쇠 따기에도 붙는지는 원문에 명시되어 있지 않습니다.</p>}
          {pickFailures > 0 && <p className="lock-trap-note" role="status">Lockpick 파손 {pickFailures}개 · 재시도 난이도 한 단계 완화(최대 +30)</p>}
          <RollCheck label="자물쇠 따기" skill="Thievery" modifier={lockpickDifficulty(pickFailures)} readOnly={opened} onResult={applyPick} />
        </>
      )}
      {!opened && method === 'force' && !forceResult && (
        <>
          <label className="lock-trap-check"><input type="checkbox" checked={crowbar} onChange={(event) => setCrowbar(event.target.checked)} /> Crowbar 사용 (+10)</label>
          <p role="status">{forceFailures + 1}번째 시도 · Athletics +{forceOpeningBonus(forceFailures, crowbar)}</p>
        </>
      )}
      {method === 'force' && <RollCheck key={attempt} slot={attempt} label="강제 개방" skill="Athletics"
        modifier={forceOpeningBonus(forceFailures, crowbar)} readOnly={forceResult !== null} onResult={applyForce} />}
      {forceResult && (
        <section className="lock-trap-step" aria-label="강제 개방 시도의 긴장 주사위">
          <h4 ref={tensionHeading} tabIndex={-1}>{forceFailures + 1}번째 시도의 긴장 주사위</h4>
          {forceResult === 'failure' && (
            <p>강제 개방 실패. 긴장 주사위 처리 후 Athletics +{forceOpeningBonus(forceFailures + 1, crowbar)}로 재시도할 수 있습니다.</p>
          )}
          {embedded ? embedded.renderTension(attempt) : <TensionTool key={attempt}
            initialSides={standaloneTension[forceFailures - 1]?.nextDie ?? 8} value={tension}
            onResult={(result) => setStandaloneTension((previous) => ({ ...previous, [forceFailures]: result }))} />}
          {forceResult === 'failure' && tensionReady && (
            <div className="lock-trap-links">
              <button type="button" className="btn ghost" onClick={() => {
                setForceFailures(forceFailures + 1);
                setForceResult(null);
                requestAnimationFrame(() => openingMethod.current?.focus());
              }}>다음 시도</button>
            </div>
          )}
        </section>
      )}
    </section>
  );
}
