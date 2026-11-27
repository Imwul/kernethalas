import { useId, useRef, useState, type Ref } from 'react';
import { EdgeToggle } from './EdgeToggle';
import { AttackFollowUpRoll, AttackPendingEffects, useAttackFollowUps, type PendingAttackEffect } from './AttackFollowUps';
import { pcCheckModifiers } from '../lib/play-check-modifiers';
import { procById } from '../content';
import { d100FromValue, resolveCheck, resolveOpposed, type Edge } from '../lib/dice';
import { resolvePhysicalAttack, type AttackDefenseMode, type PhysicalAttackResult } from '../lib/attack-defense';
import { attackFollowUpModifier } from '../lib/attack-follow-ups';
import { readOracleValue } from '../lib/oracle';
import { usePlayCharacter } from '../lib/play-character';
import { usePlayDraft, usePlayDraftState, usePlayRoll, usePlayRollField } from '../lib/play-draft';
import { isSkillDouble } from '../lib/skill-criticals';
import { isGrowthSkill, useRecordSkillCritical } from '../lib/skill-growth';
import { formatSkillBreakdown, skillBreakdown, type SkillModifier, type SkillTerm } from '../lib/play-skill';
import { CopyButton, XRef } from './bits';
import { PlayDieHint, PlayZeroKey } from './play/PlayDieHints';
import { SkillAdjustments } from './play/SkillAdjustments';
import { TogglePanel } from './TogglePanel';
import { ChoiceButtons } from './ChoiceButtons';

interface SideState {
  skill: string;
  rollv: string;
  edge: Edge;
  growthSkill?: string;
  growthRecorded?: boolean;
  modifiers?: SkillModifier[];
  attackSkillKind?: 'base' | 'adjusted';
}

interface CreatureAttack {
  name: string;
  combatSkill: number | null;
  attacking: boolean;
  onChangeAttacker: (attacking: boolean) => void;
  onHitLocation: (critical: boolean, pc: boolean, exchangeId?: string) => void;
  /** Both sides failed: the defender takes 1 damage that nothing reduces. `pc` is true when the PC defends. */
  onBothFailed?: (pc: boolean, exchangeId?: string) => void;
  onNextAttack: (enemyAttacks: boolean) => void;
}

type SideId = 'a' | 'b' | 'pc-attack' | 'pc-defense' | 'enemy-attack' | 'enemy-defense';
type ConfirmedExchange = { id: string; attacker: string; defender: string; result?: PhysicalAttackResult; breakdown?: string };

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

function Side({ label, s, set, disabled, rollRef, field, editableSkill, fixed, onLoadPreset, canSavePreset }: {
  label: string;
  s: SideState;
  set: (v: Partial<SideState>) => void;
  disabled: boolean;
  rollRef?: Ref<HTMLInputElement>;
  field: ReturnType<typeof usePlayRollField>;
  editableSkill?: boolean;
  fixed?: SkillTerm[];
  onLoadPreset?: (value: string) => void;
  canSavePreset?: boolean;
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
          <label htmlFor={`${id}-skill`}><span className="sr-only">{label} </span>수치</label>
          <input id={`${id}-skill`} value={s.skill} placeholder="예: 50"
            aria-invalid={invalidSkill || undefined} aria-describedby={invalidSkill ? `${id}-skill-error` : undefined}
            onChange={(e) => set({ skill: e.target.value })} />
          {invalidSkill && <p className="field-err" id={`${id}-skill-error`}>보정한 Skill을 정수로 입력하세요.</p>}
        </div>
        <EdgeToggle label={<><span className="sr-only">{label} </span>유불리</>} value={s.edge} onChange={(edge) => set({ edge })} />
        <div className="field">
          <label htmlFor={`${id}-roll`}><span className="sr-only">{label} </span>D100</label>
          <PlayDieHint dice="D100" sides={100} />
          <input id={`${id}-roll`} ref={rollRef} inputMode="numeric" value={s.rollv} placeholder="1–100" {...field}
            aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-roll-error` : undefined}
            onChange={(e) => changeRoll(e.target.value)} />
          <PlayZeroKey onInput={() => changeRoll('00')} />
          {invalid && <p className="field-err" id={`${id}-roll-error`}>1–100 사이의 정수 또는 00을 입력하세요.</p>}
        </div>
      </div>
      {editableSkill && <SkillAdjustments label={label} skill={s.growthSkill} base={s.skill} modifiers={s.modifiers ?? []}
        fixed={fixed} disabled={disabled} onBase={(skill) => set({ skill })} onModifiers={(modifiers) => set({ modifiers })}
        onLoadPreset={onLoadPreset} canSavePreset={canSavePreset} />}
    </fieldset>
  );
}

function HitLocation({ enemyAttacks, onHitLocation }: { enemyAttacks: boolean; onHitLocation?: () => void }) {
  if (onHitLocation) return (
    <button type="button" className="btn primary" data-checkcalc-forward="" onClick={onHitLocation}>{enemyAttacks ? 'PC 명중 부위 D20' : '적 명중 부위 보기'}</button>
  );
  if (enemyAttacks) return (
    <><XRef id="t-hit-humanoid">PC 명중 부위 D20</XRef><XRef id="damage-to-pc">PC 받는 피해 계산</XRef></>
  );
  const tables = procById.get('p-attack')?.nodes.find(({ id }) => id === 'loc')?.tables ?? [];
  return (
    <TogglePanel className="checkcalc-hit-tables" label="적 명중 부위 표 선택">
      <div className="checkcalc-follow-ups">{tables.map((id) => <XRef key={id} id={id} />)}</div>
    </TogglePanel>
  );
}

export function CheckCalculator({ attackOnly = false, creature }: { attackOnly?: boolean; creature?: CreatureAttack }) {
  const play = usePlayDraft();
  const pcCharacter = usePlayCharacter();
  const commit = usePlayRoll();
  const record = useRecordSkillCritical();
  const [mode, setMode] = useState<'single' | 'attack' | 'opposed'>('attack');
  const [enemy, setEnemy] = useState(false);
  const [inputs, setInputs] = usePlayDraftState<Partial<Record<SideId, Partial<SideState>>>>('attack-inputs', {});
  const [pcConfirmed, setPcConfirmed] = usePlayDraftState<ConfirmedExchange | null>('attack-confirmed-pc', null);
  const [enemyConfirmed, setEnemyConfirmed] = usePlayDraftState<ConfirmedExchange | null>('attack-confirmed-enemy', null);
  const [pcDefenseMode, setPcDefenseMode] = usePlayDraftState<AttackDefenseMode>('attack-defense-mode-pc', 'opposed');
  const [enemyDefenseMode, setEnemyDefenseMode] = usePlayDraftState<AttackDefenseMode>('attack-defense-mode-enemy', 'opposed');
  const followUps = useAttackFollowUps();
  const [selectedEffects, setSelectedEffects] = useState<string[]>([]);
  const attackerRoll = useRef<HTMLInputElement>(null);
  const section = useRef<HTMLElement>(null);
  const defenseModeSelect = useRef<HTMLButtonElement>(null);
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
  const pcSheet = creature ? pcCharacter : null;
  const aSkillName = inputs[aKey]?.growthSkill ?? pcSheet?.character.weapon;
  const bSkillName = inputs[bKey]?.growthSkill ?? pcSheet?.character.defense;
  const aRules = pcCheckModifiers(enemyAttacks ? null : pcSheet, aSkillName || '무기 Skill');
  const bRules = pcCheckModifiers(enemyAttacks ? pcSheet : null, bSkillName || 'Dodge');
  const a = { ...noRoll, skill: creature && enemyAttacks ? importedSkill : pcSheet ? pcSheet.attackSkill : attackOnly ? '' : '60',
    ...(pcSheet && !enemyAttacks && aSkillName ? { growthSkill: aSkillName } : {}), ...inputs[aKey], edge: inputs[aKey]?.edge ?? aRules.edge };
  const b = { ...noRoll, skill: creature && !enemyAttacks ? importedSkill : pcSheet ? pcSheet.defenseSkill : attackOnly ? '' : '50',
    ...(pcSheet && enemyAttacks && bSkillName ? { growthSkill: bSkillName } : {}), ...inputs[bKey], edge: inputs[bKey]?.edge ?? bRules.edge };
  const setSide = (key: SideId, patch: Partial<SideState>) =>
    setInputs((current) => ({ ...current, [key]: { ...current[key], ...patch } }));
  // Before this marker was introduced, manually entered attack scores were already adjusted.
  const scoreKind = inputs[aKey]?.attackSkillKind ?? (inputs[aKey]?.skill !== undefined || confirmed ? 'adjusted' : 'base');
  const pcAttack = trackExchange && !enemyAttacks && attackingRolls;
  const setAttacker = (patch: Partial<SideState>) => setSide(aKey, pcAttack && patch.skill !== undefined
    ? { ...patch, attackSkillKind: scoreKind } : patch);
  const aRoll = readOracleValue(a.rollv.trim(), 100);
  const bRoll = readOracleValue(b.rollv.trim(), 100);
  const attackField = usePlayRollField(`attack:${aKey}`, attack ? '공격자' : 'A', 'D100', aRoll !== null, true);
  const defenseField = usePlayRollField(`attack:${bKey}`, attack ? '방어자' : 'B', 'D100', bRoll !== null, true);
  const pending: PendingAttackEffect[] = (followUps?.readOnly ? [] : followUps?.effects ?? []).flatMap((effect) => {
    if (effect.status) return [];
    const modifier = attackFollowUpModifier(effect);
    // The PC's modifiers travel with the PC. A creature's modifiers belong to that specific creature.
    const sameFighter = modifier?.actor === 'pc' || effect.targetId === followUps?.targetId;
    if (!sameFighter && modifier) return [];
    const side = !confirmed && modifier
      ? modifier.check === 'attack' && attackingRolls && (modifier.actor === 'enemy') === enemyAttacks ? 'attacker'
        : modifier.check === 'defense' && defendingRolls && (modifier.actor === 'pc') === enemyAttacks ? 'defender'
          : undefined
      : undefined;
    const edge = side === 'attacker' ? a.edge : b.edge;
    const blocked = !!side && !!modifier && 'advantage' in modifier && edge === 'disadvantage';
    return [{ effect, side, blocked, selected: !!side && !blocked && selectedEffects.includes(effect.slot) }];
  });
  const selected = pending.filter(({ selected }) => selected);
  const appliedModifier = (side: PendingAttackEffect['side']) => selected.filter((entry) => entry.side === side)
    .flatMap(({ effect }) => {
      const modifier = attackFollowUpModifier(effect);
      return modifier ? [{ table: effect.kind.endsWith('fumble') ? '펌블' : '방어 동작', modifier }] : [];
    });
  const aApplied = appliedModifier('attacker');
  const bApplied = appliedModifier('defender');
  const effectTerms = (applied: typeof aApplied) => applied.flatMap(({ table, modifier }) =>
    'skill' in modifier ? [{ label: table, value: modifier.skill }] : []);
  const aFixed = [...(pcAttack && scoreKind === 'base' ? [{ label: '공격 기본', value: 10 }] : []), ...effectTerms(aApplied)];
  const bFixed = effectTerms(bApplied);
  const aAdjustments = trackExchange ? skillBreakdown(a.skill, enemyAttacks ? [] : a.modifiers, aFixed) : null;
  const bAdjustments = trackExchange ? skillBreakdown(b.skill, enemyAttacks ? b.modifiers : [], bFixed) : null;
  const aSkill = trackExchange ? aAdjustments?.total ?? null : readAdjustedSkill(a.skill);
  const bSkill = trackExchange ? bAdjustments?.total ?? null : readAdjustedSkill(b.skill);
  const aEdge = aApplied.some(({ modifier }) => 'advantage' in modifier) ? 'advantage' : a.edge;
  const bEdge = bApplied.some(({ modifier }) => 'advantage' in modifier) ? 'advantage' : b.edge;
  const ca = aRoll === null || aSkill === null ? null : resolveCheck(d100FromValue(aRoll), aSkill, aEdge);
  const cb = bRoll === null || bSkill === null ? null : resolveCheck(d100FromValue(bRoll), bSkill, bEdge);
  const result = attack ? confirmed?.result ?? resolvePhysicalAttack(defenseMode, ca, cb) : null;
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
  const adjustments = [
    ...(attackingRolls && aAdjustments && (!enemyAttacks || aApplied.length) ? [`공격자 ${formatSkillBreakdown(aAdjustments)}${aEdge !== a.edge ? ' · 유리' : ''}`] : []),
    ...(defendingRolls && bAdjustments && (enemyAttacks || bApplied.length) ? [`방어자 ${formatSkillBreakdown(bAdjustments)}${bEdge !== b.edge ? ' · 유리' : ''}`] : []),
  ].join(' / ');
  const confirm = (continueAttack?: (exchangeId?: string) => void) => {
    if (confirmed || !trackExchange || !result) {
      continueAttack?.(confirmed?.id);
      return;
    }
    const attacker = attackingRolls ? a.rollv.trim() : '';
    const defender = defendingRolls ? b.rollv.trim() : '';
    const exchangeId = crypto.randomUUID();
    commit(() => {
      if (attackingRolls) setSide(aKey, { edge: aEdge, ...(pcAttack && { attackSkillKind: scoreKind }) });
      if (defendingRolls) setSide(bKey, { edge: bEdge });
      selected.forEach(({ effect }) => followUps?.settle(effect, 'used'));
      setConfirmed({ id: exchangeId, attacker, defender, result, breakdown: adjustments || undefined });
      continueAttack?.(exchangeId);
      // Move on to the next step (hit location), never onto "다음 공격", which would clear this exchange.
      if (!continueAttack) requestAnimationFrame(() => section.current?.querySelector<HTMLElement>(
        '[data-checkcalc-forward], input[data-play-roll-field*="attack-follow-up:"]',
      )?.focus());
    }, {
      label: `공격 교환 · ${matchup}`,
      dice,
      value: attacker ? `${summarizeRolls(attacker, defender)} · ${exchangeOutcome}` : summarizeRolls(attacker, defender),
      source: 'manual',
      field: attackField['data-play-roll-field'],
      breakdown: adjustments || undefined,
    });
    setSelectedEffects([]);
  };
  const nextAttack = () => {
    const clearRoll = (side: Partial<SideState> | undefined): Partial<SideState> => ({
      ...side, rollv: '', edge: undefined, growthRecorded: false, modifiers: [],
    });
    setInputs((previous) => ({ ...previous, [aKey]: clearRoll(previous[aKey]), [bKey]: clearRoll(previous[bKey]) }));
    setConfirmed(null);
    setDefenseMode('opposed');
    setSelectedEffects([]);
    creature?.onNextAttack(enemyAttacks);
    requestAnimationFrame(() => (attackerRoll.current ?? defenseModeSelect.current)?.focus());
  };
  return (
    <section className="roller checkcalc" ref={section} aria-label={attackOnly ? '공격 판정 해석기' : '판정 해석기'}>
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
        <ChoiceButtons label="방어 방식" value={defenseMode} disabled={!!confirmed} focusRef={defenseModeSelect}
          groupData={{ 'data-play-attack-field': attackField['data-play-roll-field'] }} onChange={setDefenseMode} options={[
            { value: 'opposed', label: '공격·방어 대항' },
            { value: 'unopposed', label: '능동 방어 불가 · 공격만 굴림' },
            { value: 'automatic', label: '자동 명중 · 굴림 없음' },
          ]} />
        {defenseMode === 'unopposed' && <p className="checkcalc-note"><XRef id="stunned">기절</XRef>처럼 능동 방어가 불가능한 경우에 적용합니다.</p>}
        {defenseMode === 'automatic' && <p className="checkcalc-note"><XRef id="unconscious-target">의식 없음·수면·마비</XRef>라면 공격과 방어 굴림 없이 명중합니다.</p>}
      </div>}
      {creature && importedSkill && attackingRolls && (enemyAttacks || defendingRolls) && (
        <p className="checkcalc-note">적 기본 입력값 {importedSkill}{enemyAttacks && ` (CS ${enemySkill} + 공격 기본 10)`}. 추가 보정은 직접 반영하세요.</p>
      )}
      {pcAttack && <label className="checkcalc-score-kind">
        <input type="checkbox" checked={scoreKind === 'adjusted'} disabled={!!confirmed}
          onChange={(event) => setSide(aKey, { attackSkillKind: event.target.checked ? 'adjusted' : 'base' })} />
        공격 기본 +10이 이미 포함된 수치
      </label>}
      {attackingRolls && <Side label={attack ? '공격자' : 'A'} s={a} set={setAttacker}
        disabled={!!confirmed} rollRef={attackerRoll} field={attackField} editableSkill={trackExchange && !enemyAttacks} fixed={aFixed}
        onLoadPreset={pcAttack ? (skill) => setSide(aKey, { skill, attackSkillKind: 'base' }) : undefined}
        canSavePreset={!pcAttack || scoreKind === 'base'} />}
      {mode !== 'single' && defendingRolls && <Side label={attack ? '방어자' : 'B'} s={b} set={(patch) => setSide(bKey, patch)}
        disabled={!!confirmed} field={defenseField} editableSkill={trackExchange && enemyAttacks} fixed={bFixed} />}
      {!confirmed && attackingRolls && aAdjustments && (aFixed.length > 0 || aEdge !== a.edge) &&
        <p className="checkcalc-note" aria-label="공격자 계산 수치">공격자 {formatSkillBreakdown(aAdjustments)}{aEdge !== a.edge && ' · 유리'}</p>}
      {!confirmed && defendingRolls && bAdjustments && (bFixed.length > 0 || bEdge !== b.edge) &&
        <p className="checkcalc-note" aria-label="방어자 계산 수치">방어자 {formatSkillBreakdown(bAdjustments)}{bEdge !== b.edge && ' · 유리'}</p>}
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
        {confirmed && verdict && <p className="checkcalc-note">확정 · {dice} · {summarizeRolls(confirmed.attacker, confirmed.defender)}
          {confirmed.breakdown && <><br />{confirmed.breakdown}</>}</p>}
        <div className="checkcalc-follow-ups">
          {confirmed ? <>
            <button key="next" type="button" className="btn ghost" onClick={nextAttack}>다음 공격</button>
            {exchangeOutcome && <CopyButton text={`${matchup} · ${dice} · ${summarizeRolls(confirmed.attacker, confirmed.defender)} · ${exchangeOutcome}`}
              label="공격 결과 복사" />}
          </> : <button key="confirm" type="button" className="btn primary" disabled={!result} data-play-next={result ? '' : undefined}
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
      {result && (result.outcome === 'hit' || result.outcome === 'critical-hit' || result.outcome === 'defended' || result.attackerFumble
        || (result.outcome === 'both-failed' && creature?.onBothFailed)) && (
        <div className="checkcalc-follow-ups">
          {result.outcome === 'both-failed' && creature?.onBothFailed && (
            <button type="button" className="btn primary" data-checkcalc-forward=""
              onClick={() => confirm((exchangeId) => creature.onBothFailed?.(enemyAttacks, exchangeId))}>
              {enemyAttacks ? 'PC' : '적'} 1 피해 적용
            </button>
          )}
          {(result.outcome === 'hit' || result.outcome === 'critical-hit') && (
            <HitLocation enemyAttacks={enemyAttacks}
              onHitLocation={creature && (() => confirm((exchangeId) => creature.onHitLocation(result.outcome === 'critical-hit', enemyAttacks, exchangeId)))} />
          )}
          {result.outcome === 'critical-hit' && <XRef id="critical-strike">치명타 피해</XRef>}
          {result.outcome === 'defended' && (!confirmed || !followUps) && (
            <XRef id={enemyAttacks ? 't-defensive-move-pc' : 't-defensive-move-npc'}>{enemyAttacks ? 'PC' : '적'} 방어 동작</XRef>
          )}
          {result.attackerFumble && (!confirmed || !followUps) && (
            <XRef id={enemyAttacks ? 't-fumble-npc' : 't-fumble-pc'}>{enemyAttacks ? '적' : 'PC'} 공격자 펌블</XRef>
          )}
        </div>
      )}
      {confirmed && creature && result?.outcome === 'defended' &&
        <AttackFollowUpRoll kind={enemyAttacks ? 'pc-defense' : 'enemy-defense'} exchangeId={confirmed.id}
          side={enemyAttacks ? 'enemy' : 'pc'} targetName={creature.name} />}
      {confirmed && creature && result?.attackerFumble &&
        <AttackFollowUpRoll kind={enemyAttacks ? 'enemy-fumble' : 'pc-fumble'} exchangeId={confirmed.id}
          side={enemyAttacks ? 'enemy' : 'pc'} targetName={creature.name} />}
      <AttackPendingEffects entries={pending} onToggle={(slot) => setSelectedEffects((previous) =>
        previous.includes(slot) ? previous.filter((id) => id !== slot) : [...previous, slot])} />
    </section>
  );
}
