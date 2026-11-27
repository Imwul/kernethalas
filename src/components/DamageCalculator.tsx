import type { creatureDefenses } from '../content/creature-defenses';
import { formatCombatDamage, isCombatDamageRecord, type CombatDamageRecord } from '../lib/combat-damage-records';
import {
  calculateDirectDamage, DAMAGE_TYPES, ignoresArmor, isPhysicalDamage, listedDamageReactions, splitPcDamage, UNTYPED_DAMAGE,
  type DamageChoice, type DamageReactions, type DamageType,
} from '../lib/damage';
import { formatAttackDamage, poolDieCount, type CreatureAttackPool } from '../lib/creature-combat';
import { pooledDie, type RollResult } from '../lib/dice';
import { usePlayDraft, usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { playAction } from '../lib/play-roll-history';
import { XRef } from './bits';
import { PerkNote } from './PerkNote';
import { TogglePanel } from './TogglePanel';
import { DamageTypeGuide } from './DamageTypeGuide';
import '../styles/damage-calculator.css';
import { ChoiceButtons } from './ChoiceButtons';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';

interface Impact {
  location: string;
  armor: number | null;
  weak: boolean;
}

type PaperTarget = { slot: string; target: string; source?: string; editable: boolean };
/** The creature action that hit the PC: its Damage Pool, type and Armor it ignores (Penetrating). */
export type IncomingAttack = CreatureAttackPool & { name: string; when?: string; armorIgnore: number };
type DamageCandidate = Omit<CombatDamageRecord, 'id' | 'target' | 'source'>;

const REACTION_LABELS = [
  ['vulnerable', '취약'], ['resistant', '저항'], ['immune', '면역'], ['restored', '회복'],
] as const satisfies readonly [keyof DamageReactions, string][];

function readInteger(text: string, min: number): number | null {
  const value = Number(text);
  return /^[+-]?\d+$/.test(text.trim()) && Number.isSafeInteger(value) && value >= min ? value : null;
}

export function DamageCalculator({ impact, unlocatedArmor, defenses, initialCritical, pc = false, confirmedFirst = false, paper, attack, fixed }: {
  impact?: Impact;
  unlocatedArmor: number | null;
  defenses?: ReturnType<typeof creatureDefenses>;
  initialCritical: boolean;
  pc?: boolean;
  confirmedFirst?: boolean;
  paper?: PaperTarget;
  attack?: IncomingAttack;
  /** Damage the exchange already set (both sides failed: 1), entered as confirmed damage that Armor does not reduce. */
  fixed?: number;
}) {
  const [rollText, setRollText] = usePlayDraftState('damage-roll', attack && !attack.dice ? String(attack.mod) : '');
  const [type, setType] = usePlayDraftState<DamageChoice | ''>('damage-type', attack?.type ?? '');
  const [modifierText, setModifierText] = usePlayDraftState('damage-modifier', attack?.dice && attack.mod ? String(attack.mod) : '');
  const [poolRoll, setPoolRoll] = usePlayDraftState<RollResult | undefined>('damage-pool-roll', undefined);
  const [critical, setCritical] = usePlayDraftState<1 | 2 | 3>('damage-critical', initialCritical ? 2 : 1);
  const [useImpact, setUseImpact] = usePlayDraftState('damage-use-impact', true);
  const [armorOverride, setArmorOverride] = usePlayDraftState<string | null>('damage-armor', null);
  const [ignoreText, setIgnoreText] = usePlayDraftState('damage-ignore', attack?.armorIgnore ? String(attack.armorIgnore) : '');
  const [reductionText, setReductionText] = usePlayDraftState('damage-reduction', '');
  const [magical, setMagical] = usePlayDraftState('damage-magical', false);
  const [reactionOverrides, setReactionOverrides] = usePlayDraftState<Partial<DamageReactions>>('damage-reactions', {});
  const [confirmed, setConfirmed] = usePlayDraftState('damage-confirmed', confirmedFirst || fixed !== undefined);
  const [confirmedText, setConfirmedText] = usePlayDraftState('damage-confirmed-amount', fixed === undefined ? '' : String(fixed));
  const [manualWeak, setManualWeak] = usePlayDraftState('damage-weak-spot', false);

  const activeImpact = useImpact ? impact : undefined;
  const currentArmor = activeImpact ? activeImpact.armor : unlocatedArmor;
  const armorText = armorOverride ?? (currentArmor === null ? '' : String(currentArmor));
  // '' is still unpicked. Untyped damage counts: Armor applies and no type rule changes it.
  const damageType = type === '' || type === UNTYPED_DAMAGE ? null : type;
  const typed = type !== '';
  const bypass = damageType !== null && ignoresArmor(damageType);
  const roll = readInteger(rollText, 1);
  const modifier = readInteger(modifierText || '0', -Infinity);
  const armor = readInteger(armorText, 0);
  const extraArmorIgnore = readInteger(ignoreText || '0', 0);
  const reduction = readInteger(reductionText || '0', 0);
  const reactions = { ...listedDamageReactions(damageType ?? '', magical, defenses), ...reactionOverrides };
  const weak = activeImpact?.weak ?? (pc && !impact && manualWeak);
  const result = typed && roll !== null && modifier !== null && (armor !== null || bypass) && extraArmorIgnore !== null && reduction !== null
    ? calculateDirectDamage({ roll, modifier, armor: armor ?? 0, extraArmorIgnore, reduction, critical, weak, reactions, type: damageType })
    : null;
  const overflow = !!result && (!Number.isSafeInteger(result.beforeArmor) || !Number.isSafeInteger(result.reacted));
  const invalid = (rollText !== '' && roll === null) || modifier === null || (!bypass && armorText !== '' && armor === null)
    || extraArmorIgnore === null || reduction === null || overflow;
  const fixedAmount = readInteger(confirmedText, 0);
  const incomingAmount = confirmed ? fixedAmount : !invalid && result && !result.restored ? result.amount : null;
  const damage: DamageCandidate | null = confirmed
    ? fixedAmount === null ? null : { amount: fixedAmount, type: damageType ?? undefined, location: activeImpact?.location }
    : !invalid && result ? {
      amount: result.amount, type: damageType ?? undefined, location: activeImpact?.location, ...(result.restored && { restored: true }),
    } : null;
  const changeType = (next: DamageChoice | '') => {
    setType(next);
    setReactionOverrides({});
  };
  const extraCount = [extraArmorIgnore, reduction].filter((value) => (value ?? 0) > 0).length + Object.keys(reactionOverrides).length;

  return (
    <section className="damage-calc" aria-label={pc ? 'PC 받는 피해 계산기' : '피해 계산기'}>
      {(pc || paper || confirmed) && (
        <div className="seg damage-entry-mode" role="group" aria-label={pc ? '받는 피해 입력 방식' : '피해 입력 방식'}>
          <button type="button" aria-pressed={!confirmed} onClick={() => setConfirmed(false)}>공격 피해</button>
          <button type="button" aria-pressed={confirmed} onClick={() => setConfirmed(true)}>확정 피해</button>
        </div>
      )}
      {confirmed && fixed !== undefined && (
        <p className="damage-note">양쪽 실패 · 방어자가 받는 {fixed} 피해는 Armor·저항으로 줄지 않습니다. <XRef id="q-both-fail">판정 규칙</XRef></p>
      )}
      {confirmed ? (
        <div className="damage-fields">
          <label className="field damage-confirmed"><span>확정 피해량</span>
            <input inputMode="numeric" value={confirmedText} onChange={(event) => setConfirmedText(event.target.value)}
              aria-invalid={confirmedText !== '' && fixedAmount === null || undefined} placeholder="예: 3" />
            {confirmedText !== '' && fixedAmount === null && <span className="field-err">0 이상의 정수를 입력하세요.</span>}
          </label>
          {paper && <label className="field"><span>피해 유형 (선택)</span>
            <select value={damageType ?? ''} onChange={(event) => changeType(event.target.value as DamageType | '')}>
              <option value="">유형 미지정</option>
              {DAMAGE_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>}
        </div>
      ) : (
        <>
          {impact ? (
            <label className="damage-check">
              <input type="checkbox" checked={useImpact} onChange={(event) => {
                setUseImpact(event.target.checked);
                setArmorOverride(null);
              }} />
              {impact.location} 명중 적용{impact.weak && ' · 약점'}
            </label>
          ) : <p className="damage-note">명중 부위 표에서 결과를 고르거나 Armor를 직접 입력하세요.</p>}
          {attack && <div className="damage-attack-source">
            <p><span>공격</span> <b lang="en">{attack.name}</b>{attack.when && ` · ${attack.when}`} · {formatAttackDamage(attack, attack.armorIgnore)}</p>
            {attack.dice && <PhysicalDiceRoll label={`${attack.name} 피해`} dice={attack.dice} value={poolRoll}
              resultText={() => poolDieCount(attack.dice) > 1 ? `${attack.type} · 가장 높은 눈` : attack.type}
              pool={{ choose: false }} onValue={(value) => {
                setPoolRoll(value);
                setRollText(String(pooledDie(value).face));
              }} />}
          </div>}
          <div className="damage-fields">
            <label className="field"><span>선택 주사위</span>
              <input inputMode="numeric" value={rollText} onChange={(event) => setRollText(event.target.value)}
                aria-invalid={rollText !== '' && roll === null || undefined} placeholder="예: 4" />
            </label>
            <label className="field"><span>피해 유형</span>
              <select value={type} onChange={(event) => changeType(event.target.value as DamageChoice | '')}>
                <option value="">유형 선택</option>
                <option value={UNTYPED_DAMAGE}>유형 없음</option>
                {DAMAGE_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field"><span>고정 피해 보정</span>
              <input value={modifierText} onChange={(event) => setModifierText(event.target.value)}
                aria-invalid={modifier === null || undefined} placeholder="0" />
            </label>
            <ChoiceButtons label="공격 판정" value={critical} onChange={setCritical} options={[
              { value: 1, label: '일반 명중' }, { value: 2, label: '치명타 ×2' }, { value: 3, label: '특수 치명타 ×3' },
            ]} />
            {!pc && critical > 1 && <PerkNote perk="Precision Striker">치명타 피해를 다시 굴릴 수 있습니다.</PerkNote>}
            <label className="field"><span>대상 부위 Armor</span>
              <input value={armorText} onChange={(event) => setArmorOverride(event.target.value)} disabled={bypass}
                inputMode="numeric" aria-invalid={!bypass && armorText !== '' && armor === null || undefined} placeholder="직접 입력" />
            </label>
            {pc && !impact && (
              <label className="damage-check"><input type="checkbox" checked={manualWeak}
                onChange={(event) => setManualWeak(event.target.checked)} />약점 명중</label>
            )}
            {defenses?.resistsNonMagicalPhysical && damageType && isPhysicalDamage(damageType) && (
              <label className="damage-check"><input type="checkbox" checked={magical} onChange={(event) => {
                setMagical(event.target.checked);
                setReactionOverrides({});
              }} />마법 피해</label>
            )}
          </div>
          {damageType && <DamageTypeGuide type={damageType} reactions={defenses || Object.keys(reactionOverrides).length ? reactions : undefined}
            immuneConditions={defenses?.immuneConditions} />}
          {type === UNTYPED_DAMAGE && <p className="damage-note">유형 없는 피해 · Armor를 그대로 빼고 유형 규칙은 적용하지 않습니다.</p>}
          <TogglePanel className="damage-extra" label="추가 피해 보정" badge={extraCount || undefined}>
            <div className="damage-fields">
              <label className="field"><span>추가로 무시할 Armor</span>
                <input inputMode="numeric" value={ignoreText} onChange={(event) => setIgnoreText(event.target.value)}
                  aria-invalid={extraArmorIgnore === null || undefined} placeholder="0" />
              </label>
              <label className="field"><span>유형별 피해 감소</span>
                <input inputMode="numeric" value={reductionText} onChange={(event) => setReductionText(event.target.value)}
                  aria-invalid={reduction === null || undefined} placeholder="0" />
              </label>
              {typed && (
                <fieldset className="damage-reactions">
                  <legend>{damageType ?? '유형 없는'} 피해 반응</legend>
                  {REACTION_LABELS.map(([key, label]) => (
                    <label className="damage-check" key={key}><input type="checkbox" checked={reactions[key]}
                      onChange={(event) => setReactionOverrides({ ...reactionOverrides, [key]: event.target.checked })} />{label}</label>
                  ))}
                </fieldset>
              )}
            </div>
          </TogglePanel>
          {invalid ? <p className="field-err" role="alert">주사위 값은 양의 정수로 입력하세요. Armor·무시·감소에는 0 이상의 정수를 사용하세요.</p>
            : result && (
              <DamageBreakdown result={result} armor={armor ?? 0} critical={critical} weak={weak}
                type={damageType} reactions={reactions} reduction={reduction ?? 0} pc={pc} />
            )}
          {typed && roll !== null && armorText === '' && !bypass && (
            <p className="damage-note">Armor를 입력하면 피해를 계산합니다.</p>
          )}
        </>
      )}
      {pc ? <PcDamageApplication amount={incomingAmount} paper={paper} damage={damage} />
        : paper && <DamageRecordButtons paper={paper} damage={damage} />}
      {(!confirmed || (pc && !confirmedFirst)) && (
        <div className="damage-refs">
          {!confirmed && <><XRef id="damage-pool" /><XRef id="damage-types" /><XRef id="vulnerability">피해 반응</XRef></>}
          {pc && !confirmedFirst && <XRef id="damage-to-pc" />}
        </div>
      )}
    </section>
  );
}

const lossText = (value: number) => value > 0 ? `−${value}` : '0';

function DamageRecordButtons({ paper, damage }: { paper: PaperTarget; damage: DamageCandidate | null }) {
  const draft = usePlayDraft();
  const commit = usePlayRoll();
  if (!draft) return null;
  const saved = draft.slots[paper.slot];
  const record = isCombatDamageRecord(saved) ? saved : null;
  if (!record && (!damage || !paper.editable)) return null;
  const candidate = damage && { target: paper.target, source: paper.source, ...damage };
  const text = candidate && formatCombatDamage(candidate);
  const recordedText = record && formatCombatDamage(record);
  const same = text !== null && text === recordedText;
  const save = () => {
    if (!paper.editable || !candidate || !text || same) return;
    commit(() => draft.write(draft.generation, paper.slot, { ...candidate, id: record?.id ?? crypto.randomUUID() }, null),
      playAction(`피해 기록 · ${text}`));
  };
  return (
    <div className="damage-paper">
      {record && <p>저널 · {recordedText}</p>}
      {paper.editable && <button className="btn ghost" type="button" onClick={save} disabled={!candidate || same}>
        {same ? '피해 기록됨' : record ? '피해 기록 수정' : '피해 기록'}
      </button>}
      {record && <button className="btn ghost" type="button" onClick={() => commit(
        () => draft.write(draft.generation, paper.slot, null, null),
        playAction(`피해 기록 취소 · ${recordedText}`),
      )}>피해 기록 취소</button>}
    </div>
  );
}

function PcDamageApplication({ amount, paper, damage }: { amount: number | null; paper?: PaperTarget; damage: DamageCandidate | null }) {
  const [toughnessText, setToughnessText] = usePlayDraftState('damage-toughness', '');
  const [directHealth, setDirectHealth] = usePlayDraftState('damage-direct-health', false);
  const toughness = readInteger(toughnessText, 0);
  const loss = amount !== null && (directHealth || toughness !== null)
    ? splitPcDamage(amount, toughness ?? 0, directHealth)
    : null;

  return (
    <section className="pc-damage-application" aria-label="PC 피해 적용">
      <h3>PC 피해 적용</h3>
      <div className="damage-fields">
        <label className="field"><span>현재 Toughness</span>
          <input inputMode="numeric" value={toughnessText} disabled={directHealth}
            aria-invalid={!directHealth && toughnessText !== '' && toughness === null || undefined}
            onChange={(event) => setToughnessText(event.target.value)} placeholder="예: 3" />
        </label>
        <label className="damage-check"><input type="checkbox" checked={directHealth}
          onChange={(event) => setDirectHealth(event.target.checked)} />Health 직접 적용</label>
      </div>
      {loss ? (
        <dl className="pc-damage-loss" aria-live="polite">
          <div><dt>Toughness</dt><dd>{lossText(loss.toughnessLoss)}</dd></div>
          <div><dt>Health</dt><dd>{lossText(loss.healthLoss)}</dd></div>
        </dl>
      ) : amount !== null && (
        <p className="damage-note">현재 Toughness를 0 이상의 정수로 입력하세요.</p>
      )}
      {paper && <DamageRecordButtons paper={paper} damage={damage && (damage.restored || loss)
        ? { ...damage, ...(loss && { loss: { toughness: loss.toughnessLoss, health: loss.healthLoss } }) } : null} />}
    </section>
  );
}

function DamageBreakdown({ result, armor, critical, weak, type, reactions, reduction, pc }: {
  result: ReturnType<typeof calculateDirectDamage>;
  armor: number;
  critical: number;
  weak: boolean;
  type: DamageType | null;
  reactions: DamageReactions;
  reduction: number;
  pc: boolean;
}) {
  const { base, multiplier, piercing, beforeArmor, armorIgnore, absorbed, afterArmor, slashing, reacted, reduced, amount, restored } = result;
  const modifierLabel = critical > 1 && weak ? '치명타·약점' : weak ? '약점' : '치명타';
  const bypass = type !== null && ignoresArmor(type);
  const reactionLabel = reactions.immune ? '면역' : reactions.vulnerable && reactions.resistant ? '취약·저항 상쇄'
    : reactions.vulnerable ? '취약 ×2' : reactions.resistant ? '저항 ½ · 올림' : '';
  return (
    <div className="damage-result">
      <dl>
        <div><dt>주사위 + 고정 보정</dt><dd>{base}</dd></div>
        {multiplier > 1 && <div><dt>{modifierLabel} ×{multiplier}</dt><dd>{base * multiplier}</dd></div>}
        {piercing > 0 && <div><dt>Piercing 치명타 +{piercing}</dt><dd>{beforeArmor}</dd></div>}
        {(armor > 0 || bypass) && (
          <div><dt>{bypass ? 'Armor 무시' : `Armor −${absorbed}`}{!bypass && armorIgnore > 0 && ` (${armorIgnore} 무시)`}</dt><dd>{afterArmor}</dd></div>
        )}
        {reactionLabel && <div><dt>{reactionLabel}</dt><dd>{reacted}</dd></div>}
        {reduction > 0 && <div><dt>유형별 피해 감소 −{reduction}</dt><dd>{reduced}</dd></div>}
        {slashing > 0 && <div><dt>Slashing 3 이하 +{slashing}</dt><dd>{amount}</dd></div>}
      </dl>
      <p role="status">{restored ? (pc ? 'Wounds 회복' : 'Health 회복') : '최종 피해'} <strong>{amount}</strong> <span>{type ?? '유형 없음'}</span></p>
      {type === 'Acid' && amount > 0 && !restored && (
        <p className="damage-note">Acid 피해를 입은 부위는 캠프 수리 전까지 Armor −1.</p>
      )}
    </div>
  );
}
