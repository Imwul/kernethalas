import { useId, useState } from 'react';
import { procById } from '../content';
import { d100FromValue, resolveAttack, resolveCheck, resolveOpposed, type AttackResult, type Edge } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { usePlayDraftState } from '../lib/play-draft';
import { XRef } from './bits';

interface SideState {
  skill: string;
  rollv: string;
  edge: Edge;
}

interface CreatureAttack {
  combatSkill: number | null;
  attacking: boolean;
  onChangeAttacker: (attacking: boolean) => void;
  onHitLocation: (critical: boolean, pc: boolean) => void;
}

type SideId = 'a' | 'b' | 'pc-attack' | 'pc-defense' | 'enemy-attack' | 'enemy-defense';

const CHECK_LABELS = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패(펌블)' } as const;
const ATTACK_LABELS = {
  hit: '공격자 명중',
  'critical-hit': 'Critical Strike',
  defended: '방어 성공 → Defensive Move',
  'both-failed': '양쪽 실패 → 방어자 1 피해',
  reroll: '다시 굴림',
} as const;

function readAdjustedSkill(raw: string): number | null {
  const value = raw.trim();
  const parsed = Number(value);
  return /^[+-]?\d+$/.test(value) && Number.isSafeInteger(parsed) ? parsed : null;
}

function Side({ label, s, set }: { label: string; s: SideState; set: (v: Partial<SideState>) => void }) {
  const id = useId();
  const invalidSkill = s.skill !== '' && readAdjustedSkill(s.skill) === null;
  const invalid = s.rollv !== '' && readOracleValue(s.rollv.trim(), 100) === null;
  return (
    <fieldset className="checkcalc-side">
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
          <input id={`${id}-roll`} inputMode="numeric" value={s.rollv} placeholder="1–100 / 00"
            aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-roll-error` : undefined}
            onChange={(e) => set({ rollv: e.target.value })} />
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
  const [mode, setMode] = useState<'single' | 'attack' | 'opposed'>('attack');
  const [enemy, setEnemy] = useState(false);
  const [inputs, setInputs] = usePlayDraftState<Partial<Record<SideId, Partial<SideState>>>>('attack-inputs', {});
  const enemyAttacks = creature?.attacking ?? enemy;
  const attack = mode === 'attack';
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
  const aSkill = readAdjustedSkill(a.skill);
  const bSkill = readAdjustedSkill(b.skill);
  const ca = aRoll === null || aSkill === null ? null : resolveCheck(d100FromValue(aRoll), aSkill, a.edge);
  const cb = bRoll === null || bSkill === null ? null : resolveCheck(d100FromValue(bRoll), bSkill, b.edge);
  const result: AttackResult | null = attack && ca && cb ? resolveAttack(ca, cb) : null;
  let verdict: { t: string; d: string } | null = null;
  if (mode === 'single' && ca) verdict = { t: CHECK_LABELS[ca.outcome], d: `읽은 값 ${ca.read.value}${ca.flippedRead ? ' (뒤집음)' : ''} / Skill ${ca.skill}` };
  if (result) verdict = { t: ATTACK_LABELS[result.outcome], d: result.reason };
  if (mode === 'opposed' && ca && cb) {
    const r = resolveOpposed(ca, cb);
    verdict = { t: r.winner === 'A' ? 'A 승리' : r.winner === 'B' ? 'B 승리' : r.winner === 'reroll' ? '다시 굴림' : '규칙 미정', d: r.reason };
  }
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
          <button type="button" aria-pressed={!enemyAttacks} onClick={() => (creature?.onChangeAttacker ?? setEnemy)(false)}>PC가 공격</button>
          <button type="button" aria-pressed={enemyAttacks} onClick={() => (creature?.onChangeAttacker ?? setEnemy)(true)}>적이 공격</button>
        </div>
      )}
      {creature && importedSkill && (
        <p className="checkcalc-note">적 기본 입력값 {importedSkill}{enemyAttacks && ` (CS ${enemySkill} + 공격 기본 10)`}. 추가 보정은 직접 반영하세요.</p>
      )}
      <Side label={attack ? '공격자' : 'A'} s={a} set={(patch) => setSide(aKey, patch)} />
      {mode !== 'single' && <Side label={attack ? '방어자' : 'B'} s={b} set={(patch) => setSide(bKey, patch)} />}
      <div className="verdict" role="status">
        {verdict ? (
          <>
            <b>{verdict.t}</b>
            {verdict.d}
          </>
        ) : (
          <span className="muted">직접 굴린 D100을 입력하세요. 공격 기본 +10, Speed와 그 밖의 보정을 확인하세요.</span>
        )}
      </div>
      {result && (result.outcome === 'hit' || result.outcome === 'critical-hit' || result.outcome === 'defended' || result.attackerFumble) && (
        <div className="checkcalc-follow-ups">
          {(result.outcome === 'hit' || result.outcome === 'critical-hit') && (
            <HitLocation enemyAttacks={enemyAttacks}
              onHitLocation={creature && (() => creature.onHitLocation(result.outcome === 'critical-hit', enemyAttacks))} />
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
