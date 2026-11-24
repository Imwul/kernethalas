import { useEffect, useId, useMemo, useState } from 'react';
import { CAMP_ACTIVITIES, CAMP_BARRICADE, campTotals, resolveCampCheck, type CampActivityId, type CampQuantities } from '../lib/camp';
import { rollDie } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import { GEAR_LOCATIONS, gearCount, gearKey, type GearItem, type PaperChange } from '../lib/play-inventory';
import { XRef } from './bits';
import { TogglePanel } from './TogglePanel';
import { JournalRoll } from './LootJournal';
import { PlayDieHint } from './play/PlayDieHints';
import '../styles/camp-calculator.css';

function readInteger(raw: string, signed = false) {
  const value = raw.trim().replace(/^−/, '-');
  if (!value) return 0;
  const valid = signed ? /^[+-]?\d+$/.test(value) : /^\d+$/.test(value);
  const n = Number(value);
  return valid && Number.isSafeInteger(n) ? n : null;
}

const signed = (n: number) => n < 0 ? `−${Math.abs(n)}` : `+${n}`;
const materials = (items: Partial<Record<string, number>>) =>
  Object.entries(items).map(([item, amount]) => `${item} ${amount}`).join(' · ');

function CampNumberField({
  label, value, onChange, invalid = false, error = '0 이상의 정수를 입력하세요.', placeholder = '0', canBeNegative = false, physicalDie, disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  error?: string;
  placeholder?: string;
  canBeNegative?: boolean;
  physicalDie?: ReturnType<typeof usePlayRollField>;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {physicalDie && <PlayDieHint dice="D20" sides={20} />}
      <input
        id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder} inputMode={canBeNegative ? 'text' : 'numeric'} {...physicalDie}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      />
      {invalid && <span id={`${id}-error`} className="field-err">{error}</span>}
    </div>
  );
}

interface CampDraft {
  quantities: Partial<Record<CampActivityId, string>>;
  hasRation: boolean;
  sleep: boolean;
  bedroll: boolean;
  darkness: boolean;
  swapAmulets: boolean;
  other: string;
  die: string;
  lostToughness: string;
  sanityDie: string;
}

const INITIAL_CAMP: CampDraft = {
  quantities: {}, hasRation: true, sleep: false, bedroll: false, darkness: false,
  swapAmulets: false, other: '', die: '', lostToughness: '', sanityDie: '',
};

type CampBenefit = 'full' | 'half';

export interface CampReport {
  summary: string;
  sheet: PaperChange[];
  canCompleteRest?: boolean;
}

const EMPTY_REPORT: CampReport = { summary: '', sheet: [] };

interface CampProps {
  onEncounter?: (planKey: string) => void;
  encounterResolved?: boolean | string | readonly string[];
  domainDarkness?: boolean;
  attunementBlocked?: boolean;
  inventory?: GearItem[];
  onReport?: (report: CampReport) => void;
}

function recoveryAmounts(benefit: CampBenefit, lostToughness: string, sanityDie: string) {
  const lost = readInteger(lostToughness);
  const sanity = readOracleValue(sanityDie.trim(), 4);
  const factor = benefit === 'half' ? 2 : 1;
  const toughness = lostToughness.trim() && lost !== null
    ? `+${Math.floor(lost / factor)}`
    : benefit === 'half' ? '잃은 양의 절반(내림)' : '전부 회복';
  const sanityRecovery = sanity === null ? (benefit === 'half' ? 'D4 굴림의 절반(내림)' : 'D4') : `+${Math.floor(sanity / factor)}`;
  return { lost, sanity, toughness, sanityRecovery, exhaustion: benefit === 'half' ? '−5' : '−10' };
}

export function CampCalculator({ onEncounter, encounterResolved, domainDarkness, attunementBlocked, inventory, onReport }: CampProps = {}) {
  const id = useId();
  const [draft, setDraft] = usePlayDraftState('camp-plan', INITIAL_CAMP);
  const [manual, setManual] = useState<string | null>(null);
  const [invalidRoll, setInvalidRoll] = useState(false);
  const commitRoll = usePlayRoll();
  const { quantities, hasRation, sleep, bedroll, darkness, swapAmulets, other, die, lostToughness, sanityDie } = draft;
  const [encounterKey, setEncounterKey] = usePlayDraftState('camp-encounter-key', '');
  const [activitiesOpen, setActivitiesOpen] = usePlayDraftState('camp-activities-open', false);
  const [recoveryOpen, setRecoveryOpen] = usePlayDraftState('camp-recovery-open', false);
  const setField = <K extends keyof CampDraft>(key: K, value: CampDraft[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };
  const effectiveDarkness = darkness || domainDarkness === true;
  const roll = readOracleValue(die.trim(), 20);
  const campRollField = usePlayRollField('camp-check', '야영 판정', 'D20', roll !== null);
  const recordCampCheck = (value: number, source: 'manual' | 'app') => commitRoll(() => setField('die', String(value)), {
    label: '야영 판정', dice: 'D20', value: String(value), source, field: campRollField['data-play-roll-field'],
  });
  const extraCheck = readInteger(other, true);
  const { plan, result, rangeError, planKey } = useMemo(() => {
    const counts: CampQuantities = {};
    let validCounts = true;
    for (const { id: key } of [CAMP_BARRICADE, ...CAMP_ACTIVITIES]) {
      if (sleep && key !== CAMP_BARRICADE.id) continue;
      if (attunementBlocked && key === 'attune') continue;
      const value = readInteger(quantities[key] ?? '');
      if (value === null) validCounts = false;
      else counts[key] = value;
    }
    const totals = validCounts && extraCheck !== null ? campTotals({
      quantities: counts, hasRation, sleep, bedroll, darkness: effectiveDarkness, extraCheck,
    }) : null;
    const rangeError = totals && ![
      totals.check, totals.check + (roll ?? 0), totals.exhaustion, ...Object.values(totals.spent), ...Object.values(totals.produced),
    ].every(Number.isSafeInteger);
    const plan = rangeError ? null : totals;
    const result = plan && roll !== null ? resolveCampCheck(roll, plan.check, plan.ration !== 'missing') : null;
    const planKey = result ? JSON.stringify([counts, hasRation, sleep, swapAmulets && !sleep, bedroll, effectiveDarkness, extraCheck, roll]) : '';
    return { plan, result, rangeError, planKey };
  }, [quantities, hasRation, sleep, bedroll, swapAmulets, effectiveDarkness, attunementBlocked, extraCheck, roll]);
  const recordedEncounter = Array.isArray(encounterResolved)
    ? encounterResolved.includes(planKey) : planKey === (encounterResolved === true ? encounterKey : encounterResolved);
  const needsEncounter = !!(onEncounter && result && !result.passed && !recordedEncounter);
  const report = useMemo<CampReport>(() => {
    if (!plan || !result) return EMPTY_REPORT;
    const sheet: PaperChange[] = [
      ...Object.entries(plan.spent).map(([item, amount]) => ({ id: `camp:spend:${item}`, text: `${item} −${amount} (야영)`, gear: gearCount(item, -amount) })),
      ...Object.entries(plan.produced).map(([item, amount]) => ({ id: `camp:produce:${item}`, text: `${item} +${amount} (야영)`, gear: gearCount(item, amount) })),
    ];
    if (plan.exhaustion) sheet.push({ id: 'camp:activity-exhaustion', text: `Exhaustion ${signed(plan.exhaustion)} (야영 활동)` });
    if (plan.sleepHealth) sheet.push({ id: 'camp:sleep-health', text: `Health +${plan.sleepHealth} (취침)` });
    if (!needsEncounter && result.benefits !== 'unclear') {
      const amounts = recoveryAmounts(result.benefits, lostToughness, sanityDie);
      sheet.push({ id: 'camp:toughness', text: `Toughness ${amounts.toughness} (야영)` });
      if (result.benefits === 'full') sheet.push({ id: 'camp:health', text: 'Health +1 (야영)' });
      sheet.push({ id: 'camp:sanity', text: `Sanity ${amounts.sanityRecovery} (야영)` },
        { id: 'camp:exhaustion', text: `Exhaustion ${amounts.exhaustion} (야영 회복)` });
    }
    const outcome = result.passed ? '성공' : needsEncounter ? '실패 · 조우 대기' : '실패 · 조우 종료';
    return { summary: `야영 D20 ${roll} ${signed(plan.check)} = ${result.total} (${outcome})`, sheet, canCompleteRest: !needsEncounter };
  }, [plan, result, roll, needsEncounter, lostToughness, sanityDie]);
  useEffect(() => { onReport?.(report); }, [onReport, report]);
  const spend = plan ? materials(plan.spent) : '';
  const produce = plan ? materials(plan.produced) : '';

  const activityCount = CAMP_ACTIVITIES.filter(({ id: key }) => (readInteger(quantities[key] ?? '') ?? 0) > 0).length + (swapAmulets ? 1 : 0);
  const quantityField = (key: CampActivityId, label: string) => (
    <CampNumberField
      key={key} label={label} value={quantities[key] ?? ''}
      onChange={(value) => setDraft((previous) => ({ ...previous, quantities: { ...previous.quantities, [key]: value } }))}
      invalid={readInteger(quantities[key] ?? '') === null} disabled={attunementBlocked && key === 'attune'}
    />
  );

  return (
    <section className="camp-calc" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>야영 계산기</h2>
      <div className="camp-grid">
        <div className="field">
          <label htmlFor={`${id}-ration`}>Ration</label>
            <select id={`${id}-ration`} value={hasRation ? 'available' : 'missing'} onChange={(event) => setField('hasRation', event.target.value === 'available')}>
            <option value="available">보유분 1개 사용</option>
            <option value="missing">보유분 없음</option>
          </select>
        </div>
        {quantityField(CAMP_BARRICADE.id, CAMP_BARRICADE.label)}
      </div>
      <div className="camp-options">
        <label><input type="checkbox" checked={sleep} onChange={(event) => setField('sleep', event.target.checked)} /> 취침 (Sleep)</label>
        <label><input type="checkbox" checked={bedroll} onChange={(event) => setField('bedroll', event.target.checked)} /> 침낭 (Bedroll)</label>
        <label><input type="checkbox" checked={effectiveDarkness} disabled={domainDarkness} onChange={(event) => setField('darkness', event.target.checked)} /> 짙어지는 어둠 17–18</label>
      </div>
      {sleep && <p>취침 중에는 방어벽만 설치할 수 있습니다.</p>}
      <TogglePanel className="camp-activities" label="요리 · 제작 · 그 밖의 야영 활동" open={activitiesOpen} onOpenChange={setActivitiesOpen}
        badge={activityCount || undefined}>
        {attunementBlocked && <p>짙어지는 어둠 19–20 · 야영 중 아이템 조율 불가</p>}
        <fieldset className="camp-grid" disabled={sleep}>
          <legend className="sr-only">추가 야영 활동</legend>
          {CAMP_ACTIVITIES.map(({ id: key, label }) => quantityField(key, label))}
          <label className="camp-amulets">
            <input type="checkbox" checked={swapAmulets} onChange={(event) => setField('swapAmulets', event.target.checked)} /> Mastery Amulet 교체
          </label>
        </fieldset>
      </TogglePanel>
      {inventory && plan && roll === null && Object.keys(plan.spent).length > 0 && <CampStock spent={plan.spent} inventory={inventory} />}
      <div className="camp-grid">
        <CampNumberField label="기타 판정 보정" value={other} onChange={(value) => setField('other', value)} canBeNegative
          invalid={extraCheck === null} error="정수 보정을 입력하세요." />
        {onReport ? (
          <form className="camp-roll-form" data-play-roll noValidate onSubmit={(event) => {
            event.preventDefault();
            const number = readOracleValue((manual ?? die).trim(), 20);
            if (number === null) setInvalidRoll(true);
            else {
              recordCampCheck(number, 'manual');
              setManual(null);
              setInvalidRoll(false);
            }
          }}>
            <CampNumberField label="직접 굴린 D20" value={manual ?? die} onChange={(value) => { setManual(value); setInvalidRoll(false); }}
              placeholder="1–20" physicalDie={campRollField} invalid={invalidRoll} error="1–20 사이의 정수를 입력하세요." />
            <div className="camp-roll-actions">
              <button className="btn ghost" type="submit">야영 판정 확인</button>
              <button className="btn ghost" type="button" onClick={() => {
                recordCampCheck(rollDie(20), 'app');
                setManual(null);
                setInvalidRoll(false);
              }}>D20 굴리기</button>
            </div>
          </form>
        ) : (
          <CampNumberField label="직접 굴린 D20" value={die} onChange={(value) => setField('die', value)} placeholder="1–20"
            invalid={die.trim() !== '' && roll === null} error="1–20 사이의 정수를 입력하세요." />
        )}
      </div>
      {rangeError && <p className="field-err" role="alert">합계를 계산할 수 있도록 수량이나 보정을 줄여 주세요.</p>}
      {plan && (
        <dl className="camp-ledger" aria-label="야영 활동 합계">
          <div><dt>Camp Check 보정</dt><dd>{signed(plan.check)}</dd></div>
          <div><dt>활동 Exhaustion</dt><dd>{signed(plan.exhaustion)}</dd></div>
          {spend && <div><dt>소모</dt><dd>{spend}</dd></div>}
          {plan.ration === 'cooked' && <div><dt>식량</dt><dd>요리한 Ration 1개 즉시 사용</dd></div>}
          {produce && <div><dt>획득</dt><dd>{produce}</dd></div>}
          {plan.sleepHealth > 0 && <div><dt>취침 회복</dt><dd>Health +{plan.sleepHealth}</dd></div>}
          {!sleep && swapAmulets && <div><dt>Amulet 교체</dt><dd>비용 없음</dd></div>}
        </dl>
      )}
      {result && roll !== null && plan && (
        <>
          <div className="verdict camp-verdict" role="status">
            <b>{result.passed ? '야영 판정 성공' : '야영 판정 실패'}</b>
            <span>D20 {roll} {signed(plan.check)} = {result.total}</span>
            {!result.passed && <p>{onEncounter && !needsEncounter ? '전투를 마쳤습니다. 아래에서 야영 혜택을 확인하세요.' : '전투 조우를 해결한 뒤 야영 혜택을 적용하세요.'}</p>}
            {result.benefits === 'unclear' && <p>Ration 부족과 판정 실패가 겹쳤습니다. 두 절반 처리를 어떻게 합치는지는 룰북에 명시되어 있지 않습니다.</p>}
          </div>
          {!result.passed && (onEncounter ? needsEncounter && <button className="btn primary camp-encounter" type="button" onClick={() => {
            setEncounterKey(planKey);
            setDraft((previous) => ({ ...previous, lostToughness: '', sanityDie: '' }));
            onEncounter(planKey);
          }}>야영 중 조우로</button> : <XRef id="t-encounter-general">전투 조우 표 열기</XRef>)}
          {result.benefits !== 'unclear' && !needsEncounter && (
            <CampBenefits
              benefit={result.benefits}
              missingRation={plan.ration === 'missing'}
              lostToughness={lostToughness} setLostToughness={(value) => setField('lostToughness', value)}
              sanityDie={sanityDie} setSanityDie={(value) => setField('sanityDie', value)}
              open={recoveryOpen} onOpen={setRecoveryOpen} showRollControls={!!onReport}
            />
          )}
        </>
      )}
      <div className="camp-links">
        <XRef id="setting-camp">야영 규칙</XRef>
        <XRef id="camp-activities">야영 활동</XRef>
        {result && <XRef id="exhaustion">Exhaustion 규칙</XRef>}
      </div>
    </section>
  );
}

function CampStock({ spent, inventory }: { spent: ReturnType<typeof campTotals>['spent']; inventory: GearItem[] }) {
  return (
    <section className="camp-stock" aria-label="야영 전 보급 대조">
      <h3>야영 전 보급 대조</h3>
      <dl>
        {Object.entries(spent).map(([name, required]) => {
          const matches = inventory.filter((item) => gearKey(item.name) === gearKey(name) && item.integrity !== 'broken');
          const total = matches.reduce((sum, item) => sum + item.count, 0);
          const locations = Object.entries(GEAR_LOCATIONS).flatMap(([id, label]) => {
            const stored = matches.filter(({ location }) => location === id);
            return stored.length ? [`${label} ${stored.reduce((sum, { count }) => sum + count, 0)}개`] : [];
          });
          return (
            <div key={name}>
              <dt>{name}</dt>
              <dd>
                <span>필요 {required}개</span>
                <span>{locations.length ? locations.join(' · ') : '장부 미기록'}</span>
                {locations.length > 0 && total < required && <strong>장부 기준 {required - total}개 부족</strong>}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function CampBenefits({
  benefit, missingRation, lostToughness, setLostToughness, sanityDie, setSanityDie, open, onOpen, showRollControls,
}: {
  benefit: CampBenefit;
  missingRation: boolean;
  lostToughness: string;
  setLostToughness: (value: string) => void;
  sanityDie: string;
  setSanityDie: (value: string) => void;
  open: boolean;
  onOpen: (open: boolean) => void;
  showRollControls: boolean;
}) {
  const half = benefit === 'half';
  const { lost, sanity, toughness, sanityRecovery, exhaustion } = recoveryAmounts(benefit, lostToughness, sanityDie);

  return (
    <section className="camp-benefits" aria-label="야영 기본 혜택">
      <h3>야영 기본 혜택{half && ' 절반(내림)'}</h3>
      {missingRation && <p>먹을 Ration이 없습니다.</p>}
      <dl className="camp-ledger">
        <div><dt>Toughness</dt><dd>{toughness}</dd></div>
        <div><dt>Health</dt><dd>{half ? '0' : '+1'}</dd></div>
        <div><dt>Sanity</dt><dd>{sanityRecovery}</dd></div>
        <div><dt>Exhaustion</dt><dd>{exhaustion}</dd></div>
      </dl>
      <TogglePanel className="camp-activities" label="회복량 직접 계산" open={open} onOpenChange={onOpen}>
        <div className="camp-grid">
          <CampNumberField label="잃은 Toughness" value={lostToughness} onChange={setLostToughness} invalid={lost === null} />
          {!showRollControls && <CampNumberField label="Sanity D4 결과" value={sanityDie} onChange={setSanityDie} placeholder="1–4"
            invalid={sanityDie.trim() !== '' && sanity === null} error="1–4 사이의 정수를 입력하세요." />}
        </div>
        {showRollControls && <JournalRoll die="D4" label="야영 Sanity 회복" value={sanity}
          onValue={(value) => setSanityDie(String(value))} resultText={`Sanity ${sanityRecovery}`} />}
      </TogglePanel>
    </section>
  );
}
