import { useId, useRef, useState, type Ref } from 'react';
import { procById } from '../content';
import { d100FromValue, resolveCheck, resolveOpposed, type Edge } from '../lib/dice';
import { resolvePhysicalAttack, type AttackDefenseMode } from '../lib/attack-defense';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraft, usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import { isSkillDouble } from '../lib/skill-criticals';
import { isGrowthSkill, useRecordSkillCritical } from '../lib/skill-growth';
import { formatSkillBreakdown, skillBreakdown, type SkillModifier } from '../lib/play-skill';
import { CopyButton, XRef } from './bits';
import { PlayDieHint, PlayZeroKey } from './play/PlayDieHints';
import { SkillAdjustments } from './play/SkillAdjustments';

interface SideState {
  skill: string;
  rollv: string;
  edge: Edge;
  growthSkill?: string;
  growthRecorded?: boolean;
  modifiers?: SkillModifier[];
}

interface CreatureAttack {
  name: string;
  combatSkill: number | null;
  attacking: boolean;
  onChangeAttacker: (attacking: boolean) => void;
  onHitLocation: (critical: boolean, pc: boolean) => void;
  onNextAttack: (enemyAttacks: boolean) => void;
}

type SideId = 'a' | 'b' | 'pc-attack' | 'pc-defense' | 'enemy-attack' | 'enemy-defense';
type ConfirmedExchange = { id: string; attacker: string; defender: string };

const CHECK_LABELS = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패(펌블)' } as const;
const WEAPON_SKILLS = ['Bladed Weapons', 'Bludgeoning Weapons', 'Shafted Weapons', 'Unarmed Combat & Fist Weapons'] as const;
const DEFENSE_SKILLS = ['Dodge', ...WEAPON_SKILLS] as const;
const ATTACK_LABELS = {
  hit: '공격자 명중',
  'critical-hit': 'Critical Strike',
  miss: '빗나감',
  defended: '방어 성공 → Defensive Move',
  'both-failed': '양쪽 실패 → 방어자 1 피해',
  reroll: '다시 굴림',
} as const;

function readAdjustedSkill(raw: string): number | null {
  const value = raw.trim();
  const parsed = Number(value);
  return /^[+-]?\d+$/.test(value) && Number.isSafeInteger(parsed) ? parsed : null;
}

function Side({ label, s, set, disabled, rollRef, field, editableSkill }: {
  label: string;
  s: SideState;
  set: (v: Partial<SideState>) => void;
  disabled: boolean;
  rollRef?: Ref<HTMLInputElement>;
  field: ReturnType<typeof usePlayRollField>;
  editableSkill?: boolean;
}) {
  const id = useId();
  const invalidSkill = s.skill !== '' && readAdjustedSkill(s.skill) === null;
  const invalid = s.rollv !== '' && readOracleValue(s.rollv.trim(), 100) === null;
  const changeRoll = (rollv: string) => {
    const sameRoll = readOracleValue(rollv.trim(), 100) === readOracleValue(s.rollv.trim(), 100);
    set({ rollv, growthRecorded: sameRoll && s.growthRecorded });
  };
  return (
    <fieldset className="checkcalc-side" disabled={disabled}>
      <legend>{label}</legend>
      <div className="row">
        <div className="field">
          <label htmlFor={`${id}-skill`}><span className="sr-only">{label} </span>보정 Skill</label>
          <input id={`${id}-skill`} value={s.skill} placeholder="예: 50"
            aria-invalid={invalidSkill || undefined} aria-describedby={invalidSkill ? `${id}-skill-error` : undefined}
            onChange={(e) => set({ skill: e.target.value })} />
          {invalidSkill && <p className="field-err" id={`${id}-skill-error`}>보정한 Skill을 정수로 입력하세요.</p>}
        </div>
        <div className="field">
          <label htmlFor={`${id}-roll`}><span className="sr-only">{label} </span>D100</label>
          <PlayDieHint dice="D100" sides={100} />
          <input id={`${id}-roll`} ref={rollRef} inputMode="numeric" value={s.rollv} placeholder="1–100/00" {...field}
            aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-roll-error` : undefined}
            onChange={(e) => changeRoll(e.target.value)} />
          <PlayZeroKey onInput={() => changeRoll('00')} />
          {invalid && <p className="field-err" id={`${id}-roll-error`}>1–100 사이의 정수 또는 00을 입력하세요.</p>}
        </div>
        <div className="field">
          <label htmlFor={`${id}-edge`}><span className="sr-only">{label} </span>이점</label>
          <select id={`${id}-edge`} value={s.edge} onChange={(e) => set({ edge: e.target.value as Edge })}>
            <option value="none">없음</option>
            <option value="advantage">Advantage</option>
            <option value="disadvantage">Disadvantage</option>
          </select>
        </div>
      </div>
      {editableSkill && <SkillAdjustments label={label} skill={s.growthSkill} base={s.skill} modifiers={s.modifiers ?? []}
        disabled={disabled} onBase={(skill) => set({ skill })} onModifiers={(modifiers) => set({ modifiers })} />}
    </fieldset>
  );
}

function HitLocation({ enemyAttacks, onHitLocation }: { enemyAttacks: boolean; onHitLocation?: () => void }) {
  if (onHitLocation) return (
    <button type="button" className="btn ghost" onClick={onHitLocation}>{enemyAttacks ? 'PC 명중 부위 D20' : '적 명중 부위 보기'}</button>
  );
  if (enemyAttacks) return (
    <><XRef id="t-hit-humanoid">PC 명중 부위 D20</XRef><XRef id="damage-to-pc">PC 받는 피해 계산</XRef></>
  );
  const tables = procById.get('p-attack')?.nodes.find(({ id }) => id === 'loc')?.tables ?? [];
  return (
    <details className="checkcalc-hit-tables">
      <summary>적 명중 부위 표 선택</summary>
      <div className="checkcalc-follow-ups">{tables.map((id) => <XRef key={id} id={id} />)}</div>
    </details>
  );
}

export function CheckCalculator({ attackOnly = false, creature }: { attackOnly?: boolean; creature?: CreatureAttack }) {
  const play = usePlayDraft();
  const commit = usePlayRoll();
  const record = useRecordSkillCritical();
  const [mode, setMode] = useState<'single' | 'attack' | 'opposed'>('attack');
  const [enemy, setEnemy] = useState(false);
  const [inputs, setInputs] = usePlayDraftState<Partial<Record<SideId, Partial<SideState>>>>('attack-inputs', {});
  const [pcConfirmed, setPcConfirmed] = usePlayDraftState<ConfirmedExchange | null>('attack-confirmed-pc', null);
  const [enemyConfirmed, setEnemyConfirmed] = usePlayDraftState<ConfirmedExchange | null>('attack-confirmed-enemy', null);
  const [pcDefenseMode, setPcDefenseMode] = usePlayDraftState<AttackDefenseMode>('attack-defense-mode-pc', 'opposed');
  const [enemyDefenseMode, setEnemyDefenseMode] = usePlayDraftState<AttackDefenseMode>('attack-defense-mode-enemy', 'opposed');
  const attackerRoll = useRef<HTMLInputElement>(null);
  const defenseModeSelect = useRef<HTMLSelectElement>(null);
  const enemyAttacks = creature?.attacking ?? enemy;
  const trackExchange = !!play && !!creature;
  const confirmed = trackExchange ? (enemyAttacks ? enemyConfirmed : pcConfirmed) : null;
  const setConfirmed = enemyAttacks ? setEnemyConfirmed : setPcConfirmed;
  const attack = mode === 'attack';
  const defenseMode = attack ? enemyAttacks ? enemyDefenseMode : pcDefenseMode : 'opposed';
  const setDefenseMode = enemyAttacks ? setEnemyDefenseMode : setPcDefenseMode;
  const attackingRolls = defenseMode !== 'automatic';
  const defendingRolls = defenseMode === 'opposed';
  const aKey = creature ? (enemyAttacks ? 'enemy-attack' : 'pc-attack') : 'a';
  const bKey = creature ? (enemyAttacks ? 'pc-defense' : 'enemy-defense') : 'b';
  const enemySkill = creature?.combatSkill;
  const importedSkill = enemySkill == null ? '' : String(enemySkill + (enemyAttacks ? 10 : 0));
  const noRoll = { rollv: '', edge: 'none' as const };
  const a = { ...noRoll, skill: creature && enemyAttacks ? importedSkill : attackOnly ? '' : '60', ...inputs[aKey] };
  const b = { ...noRoll, skill: creature && !enemyAttacks ? importedSkill : attackOnly ? '' : '50', ...inputs[bKey] };
  const setSide = (key: SideId, patch: Partial<SideState>) =>
    setInputs((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  const aRoll = readOracleValue(a.rollv.trim(), 100);
  const bRoll = readOracleValue(b.rollv.trim(), 100);
  const attackField = usePlayRollField(`attack:${aKey}`, attack ? '공격자' : 'A', 'D100', aRoll !== null, true);
  const defenseField = usePlayRollField(`attack:${bKey}`, attack ? '방어자' : 'B', 'D100', bRoll !== null, true);
  const aAdjustments = !enemyAttacks && trackExchange ? skillBreakdown(a.skill, a.modifiers) : null;
  const bAdjustments = enemyAttacks && trackExchange ? skillBreakdown(b.skill, b.modifiers) : null;
  const aSkill = !enemyAttacks && trackExchange ? aAdjustments?.total ?? null : readAdjustedSkill(a.skill);
  const bSkill = enemyAttacks && trackExchange ? bAdjustments?.total ?? null : readAdjustedSkill(b.skill);
  const ca = aRoll === null || aSkill === null ? null : resolveCheck(d100FromValue(aRoll), aSkill, a.edge);
  const cb = bRoll === null || bSkill === null ? null : resolveCheck(d100FromValue(bRoll), bSkill, b.edge);
  const result = attack ? resolvePhysicalAttack(defenseMode, ca, cb) : null;
  const pc = enemyAttacks ? b : a;
  const pcKey = enemyAttacks ? bKey : aKey;
  const pcCheck = enemyAttacks ? defendingRolls ? cb : null : attackingRolls ? ca : null;
  const pcDouble = result && pcCheck && isSkillDouble(pcCheck.outcome) ? pcCheck.outcome : null;
  const growthSkill = pc.growthSkill ?? '';
  let verdict: { t: string; d: string } | null = null;
  if (mode === 'single' && ca) verdict = { t: CHECK_LABELS[ca.outcome], d: `읽은 값 ${ca.read.value}${ca.flippedRead ? ' (뒤집음)' : ''} / Skill ${ca.skill}` };
  if (result) verdict = { t: ATTACK_LABELS[result.outcome], d: result.reason };
  if (mode === 'opposed' && ca && cb) {
    const r = resolveOpposed(ca, cb);
    verdict = { t: r.winner === 'A' ? 'A 승리' : r.winner === 'B' ? 'B 승리' : r.winner === 'reroll' ? '다시 굴림' : '규칙 미정', d: r.reason };
  }
  const matchup = creature && (enemyAttacks ? `${creature.name} → PC` : `PC → ${creature.name}`);
  const exchangeOutcome = result && `${ATTACK_LABELS[result.outcome]}${result.attackerFumble ? ' · 공격자 펌블' : ''}`;
  const dice = !attackingRolls ? '판정 없음' : defendingRolls ? 'D100 × 2' : 'D100';
  const summarizeRolls = (attacker: string, defender: string) => !attacker ? '자동 명중'
    : defender ? `공격 ${attacker} / 방어 ${defender}` : `공격 ${attacker} · 능동 방어 불가`;
  const adjustments = enemyAttacks ? defendingRolls && bAdjustments : attackingRolls && aAdjustments;
  const confirm = (continueAttack?: () => void) => {
    if (confirmed || !trackExchange || !result) {
      continueAttack?.();
      return;
    }
    const attacker = attackingRolls ? a.rollv.trim() : '';
    const defender = defendingRolls ? b.rollv.trim() : '';
    commit(() => {
      setConfirmed({ id: crypto.randomUUID(), attacker, defender });
      continueAttack?.();
    }, {
      label: `공격 교환 · ${matchup}`,
      dice,
      value: attacker ? `${summarizeRolls(attacker, defender)} · ${exchangeOutcome}` : summarizeRolls(attacker, defender),
      source: 'manual',
      field: attackField['data-play-roll-field'],
      breakdown: adjustments ? formatSkillBreakdown(adjustments) : undefined,
    });
  };
  const nextAttack = () => {
    const clearRoll = (side: Partial<SideState> | undefined): Partial<SideState> => ({
      ...side, rollv: '', edge: 'none', growthRecorded: false, modifiers: [],
    });
    setInputs((previous) => ({ ...previous, [aKey]: clearRoll(previous[aKey]), [bKey]: clearRoll(previous[bKey]) }));
    setConfirmed(null);
    setDefenseMode('opposed');
    creature?.onNextAttack(enemyAttacks);
    requestAnimationFrame(() => (attackerRoll.current ?? defenseModeSelect.current)?.focus());
  };
  return (
    <section className="roller checkcalc" aria-label={attackOnly ? '공격 판정 해석기' : '판정 해석기'}>
      {!attackOnly && <span className="kicker">판정 해석기</span>}
      {!attackOnly && <div className="seg" role="group" aria-label="판정 종류">
        {(
          [
            ['single', '단일 판정'],
            ['attack', '공격 판정'],
            ['opposed', '대항 판정'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>
            {l}
          </button>
        ))}
      </div>}
      {attack && (
        <div className="seg" role="group" aria-label="공격하는 쪽">
          <button type="button" aria-pressed={!enemyAttacks} data-play-attack-side={creature ? 'pc-attack' : undefined}
            onClick={() => (creature?.onChangeAttacker ?? setEnemy)(false)}>PC가 공격</button>
          <button type="button" aria-pressed={enemyAttacks} data-play-attack-side={creature ? 'enemy-attack' : undefined}
            onClick={() => (creature?.onChangeAttacker ?? setEnemy)(true)}>적이 공격</button>
        </div>
      )}
      {attack && <div className="checkcalc-defense-mode">
        <label className="field"><span>방어 방식</span>
          <select ref={defenseModeSelect} value={defenseMode} disabled={!!confirmed}
            data-play-attack-field={attackField['data-play-roll-field']}
            onChange={(event) => setDefenseMode(event.target.value as AttackDefenseMode)}>
            <option value="opposed">공격·방어 대항</option>
            <option value="unopposed">능동 방어 불가 · 공격만 굴림</option>
            <option value="automatic">자동 명중 · 굴림 없음</option>
          </select>
        </label>
        {defenseMode === 'unopposed' && <p className="checkcalc-note"><XRef id="stunned">기절</XRef>처럼 능동 방어가 불가능한 경우에 적용합니다.</p>}
        {defenseMode === 'automatic' && <p className="checkcalc-note"><XRef id="unconscious-target">의식 없음·수면·마비</XRef>라면 공격과 방어 굴림 없이 명중합니다.</p>}
      </div>}
      {creature && importedSkill && attackingRolls && (enemyAttacks || defendingRolls) && (
        <p className="checkcalc-note">적 기본 입력값 {importedSkill}{enemyAttacks && ` (CS ${enemySkill} + 공격 기본 10)`}. 추가 보정은 직접 반영하세요.</p>
      )}
      {attackingRolls && <Side label={attack ? '공격자' : 'A'} s={a} set={(patch) => setSide(aKey, patch)}
        disabled={!!confirmed} rollRef={attackerRoll} field={attackField} editableSkill={trackExchange && !enemyAttacks} />}
      {mode !== 'single' && defendingRolls && <Side label={attack ? '방어자' : 'B'} s={b} set={(patch) => setSide(bKey, patch)}
        disabled={!!confirmed} field={defenseField} editableSkill={trackExchange && enemyAttacks} />}
      <div className="verdict" role="status" aria-label={attack ? '공격 판정 결과' : '판정 결과'}>
        {verdict ? (
          <>
            <b>{verdict.t}</b>
            {verdict.d}
          </>
        ) : (
          <span className="muted">{defenseMode === 'unopposed' ? '공격자만 D100을 굴리고 결과를 입력하세요.'
            : '직접 굴린 D100을 입력하세요. 공격 기본 +10, Speed와 그 밖의 보정을 확인하세요.'}</span>
        )}
      </div>
      {trackExchange && (<div className="checkcalc-exchange">
        {confirmed && verdict && <p className="checkcalc-note">확정 · {dice} · {summarizeRolls(confirmed.attacker, confirmed.defender)}</p>}
        <div className="checkcalc-follow-ups">
          {confirmed ? <>
            <button type="button" className="btn primary" onClick={nextAttack}>다음 공격</button>
            {exchangeOutcome && <CopyButton text={`${matchup} · ${dice} · ${summarizeRolls(confirmed.attacker, confirmed.defender)} · ${exchangeOutcome}`}
              label="공격 결과 복사" />}
          </> : <button type="button" className="btn primary" disabled={!result} data-play-next={result ? '' : undefined}
            onClick={() => confirm()}>공격 교환 확정</button>}
        </div>
      </div>)}
      {pcDouble && <p className="checkcalc-note">PC {enemyAttacks ? '방어' : '공격'} · {pcDouble === 'critical' ? '대성공' : '대실패'}</p>}
      {play && pcDouble && pcCheck && (
        <div className="checkcalc-follow-ups" style={{ alignItems: 'end' }}>
          <label className="field"><span>PC {enemyAttacks ? '방어' : '공격'}에 사용한 기술</span>
            <select value={growthSkill} disabled={pc.growthRecorded}
              onChange={(event) => setSide(pcKey, { growthSkill: event.target.value })}>
              <option value="">기술 선택</option>
              {(enemyAttacks ? DEFENSE_SKILLS : WEAPON_SKILLS).map((skill) => (
                <option key={skill} value={skill}>{skill === 'Unarmed Combat & Fist Weapons' ? 'Unarmed / Fist Weapons' : skill}</option>
              ))}
            </select>
          </label>
          <button className="btn ghost" type="button" disabled={!isGrowthSkill(growthSkill) || pc.growthRecorded}
            onClick={() => commit(() => {
              setSide(pcKey, { growthRecorded: true });
              record(growthSkill, pcCheck, null);
            })}>
            야영 성장 {pc.growthRecorded ? '표시됨' : '표시'}
          </button>
        </div>
      )}
      {result && (result.outcome === 'hit' || result.outcome === 'critical-hit' || result.outcome === 'defended' || result.attackerFumble) && (
        <div className="checkcalc-follow-ups">
          {(result.outcome === 'hit' || result.outcome === 'critical-hit') && (
            <HitLocation enemyAttacks={enemyAttacks}
              onHitLocation={creature && (() => confirm(() => creature.onHitLocation(result.outcome === 'critical-hit', enemyAttacks)))} />
          )}
          {result.outcome === 'critical-hit' && <XRef id="critical-strike">치명타 피해</XRef>}
          {result.outcome === 'defended' && (
            <XRef id={enemyAttacks ? 't-defensive-move-pc' : 't-defensive-move-npc'}>{enemyAttacks ? 'PC' : '적'} 방어 동작</XRef>
          )}
          {result.attackerFumble && (
            <XRef id={enemyAttacks ? 't-fumble-npc' : 't-fumble-pc'}>{enemyAttacks ? '적' : 'PC'} 공격자 펌블</XRef>
          )}
        </div>
      )}
    </section>
  );
}
