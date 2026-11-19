import type { creatureDefenses } from '../content/creature-defenses';
import { calculateDirectDamage, DAMAGE_TYPES, ignoresArmor, isPhysicalDamage, listedDamageReactions, splitPcDamage, type DamageReactions, type DamageType } from '../lib/damage';
import { usePlayDraftState } from '../lib/play-draft';
import { XRef } from './bits';
import { DamageTypeGuide } from './DamageTypeGuide';
import '../styles/damage-calculator.css';

interface Impact {
  location: string;
  armor: number | null;
  weak: boolean;
}

const REACTION_LABELS = [
  ['vulnerable', '취약'], ['resistant', '저항'], ['immune', '면역'], ['restored', '회복'],
] as const satisfies readonly [keyof DamageReactions, string][];

function readInteger(text: string, min: number): number | null {
  const value = Number(text);
  return /^[+-]?\d+$/.test(text.trim()) && Number.isSafeInteger(value) && value >= min ? value : null;
}

export function DamageCalculator({ impact, unlocatedArmor, defenses, initialCritical, pc = false, confirmedFirst = false }: {
  impact?: Impact;
  unlocatedArmor: number | null;
  defenses?: ReturnType<typeof creatureDefenses>;
  initialCritical: boolean;
  pc?: boolean;
  confirmedFirst?: boolean;
}) {
  const [rollText, setRollText] = usePlayDraftState('damage-roll', '');
  const [type, setType] = usePlayDraftState<DamageType | ''>('damage-type', '');
  const [modifierText, setModifierText] = usePlayDraftState('damage-modifier', '');
  const [critical, setCritical] = usePlayDraftState<1 | 2 | 3>('damage-critical', initialCritical ? 2 : 1);
  const [useImpact, setUseImpact] = usePlayDraftState('damage-use-impact', true);
  const [armorOverride, setArmorOverride] = usePlayDraftState<string | null>('damage-armor', null);
  const [ignoreText, setIgnoreText] = usePlayDraftState('damage-ignore', '');
  const [reductionText, setReductionText] = usePlayDraftState('damage-reduction', '');
  const [magical, setMagical] = usePlayDraftState('damage-magical', false);
  const [reactionOverrides, setReactionOverrides] = usePlayDraftState<Partial<DamageReactions>>('damage-reactions', {});
  const [confirmed, setConfirmed] = usePlayDraftState('damage-confirmed', confirmedFirst);
  const [confirmedText, setConfirmedText] = usePlayDraftState('damage-confirmed-amount', '');
  const [manualWeak, setManualWeak] = usePlayDraftState('damage-weak-spot', false);

  const activeImpact = useImpact ? impact : undefined;
  const currentArmor = activeImpact ? activeImpact.armor : unlocatedArmor;
  const armorText = armorOverride ?? (currentArmor === null ? '' : String(currentArmor));
  const bypass = type !== '' && ignoresArmor(type);
  const roll = readInteger(rollText, 1);
  const modifier = readInteger(modifierText || '0', -Infinity);
  const armor = readInteger(armorText, 0);
  const extraArmorIgnore = readInteger(ignoreText || '0', 0);
  const reduction = readInteger(reductionText || '0', 0);
  const reactions = { ...listedDamageReactions(type, magical, defenses), ...reactionOverrides };
  const weak = activeImpact?.weak ?? (pc && !impact && manualWeak);
  const result = type && roll !== null && modifier !== null && (armor !== null || bypass) && extraArmorIgnore !== null && reduction !== null
    ? calculateDirectDamage({ roll, modifier, armor: armor ?? 0, extraArmorIgnore, reduction, critical, weak, reactions, type })
    : null;
  const overflow = !!result && (!Number.isSafeInteger(result.beforeArmor) || !Number.isSafeInteger(result.reacted));
  const invalid = (rollText !== '' && roll === null) || modifier === null || (!bypass && armorText !== '' && armor === null)
    || extraArmorIgnore === null || reduction === null || overflow;
  const fixedAmount = readInteger(confirmedText, 0);
  const incomingAmount = confirmed ? fixedAmount : !invalid && result && !result.restored ? result.amount : null;

  return (
    <section className="damage-calc" aria-label={pc ? 'PC 받는 피해 계산기' : '피해 계산기'}>
      {pc && (
        <div className="seg damage-entry-mode" role="group" aria-label="받는 피해 입력 방식">
          <button type="button" aria-pressed={!confirmed} onClick={() => setConfirmed(false)}>공격 피해</button>
          <button type="button" aria-pressed={confirmed} onClick={() => setConfirmed(true)}>확정 피해</button>
        </div>
      )}
      {confirmed ? (
        <label className="field damage-confirmed"><span>확정 피해량</span>
          <input inputMode="numeric" value={confirmedText} onChange={(event) => setConfirmedText(event.target.value)}
            aria-invalid={confirmedText !== '' && fixedAmount === null || undefined} placeholder="예: 3" />
          {confirmedText !== '' && fixedAmount === null && <span className="field-err">0 이상의 정수를 입력하세요.</span>}
        </label>
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
          <div className="damage-fields">
            <label className="field"><span>선택 주사위</span>
              <input inputMode="numeric" value={rollText} onChange={(event) => setRollText(event.target.value)}
                aria-invalid={rollText !== '' && roll === null || undefined} placeholder="예: 4" />
            </label>
            <label className="field"><span>피해 유형</span>
              <select value={type} onChange={(event) => {
                setType(event.target.value as DamageType | '');
                setReactionOverrides({});
              }}>
                <option value="">유형 선택</option>
                {DAMAGE_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="field"><span>고정 피해 보정</span>
              <input value={modifierText} onChange={(event) => setModifierText(event.target.value)}
                aria-invalid={modifier === null || undefined} placeholder="0" />
            </label>
            <label className="field"><span>공격 판정</span>
              <select value={critical} onChange={(event) => setCritical(Number(event.target.value) as 1 | 2 | 3)}>
                <option value={1}>일반 명중</option>
                <option value={2}>치명타 ×2</option>
                <option value={3}>특수 치명타 ×3</option>
              </select>
            </label>
            <label className="field"><span>대상 부위 Armor</span>
              <input value={armorText} onChange={(event) => setArmorOverride(event.target.value)} disabled={bypass}
                inputMode="numeric" aria-invalid={!bypass && armorText !== '' && armor === null || undefined} placeholder="직접 입력" />
            </label>
            {pc && !impact && (
              <label className="damage-check"><input type="checkbox" checked={manualWeak}
                onChange={(event) => setManualWeak(event.target.checked)} />약점 명중</label>
            )}
            {defenses?.resistsNonMagicalPhysical && type && isPhysicalDamage(type) && (
              <label className="damage-check"><input type="checkbox" checked={magical} onChange={(event) => {
                setMagical(event.target.checked);
                setReactionOverrides({});
              }} />마법 피해</label>
            )}
          </div>
          {type && <DamageTypeGuide type={type} reactions={defenses || Object.keys(reactionOverrides).length ? reactions : undefined}
            immuneConditions={defenses?.immuneConditions} />}
          <details className="fold damage-extra">
            <summary>추가 피해 보정</summary>
            <div className="damage-fields">
              <label className="field"><span>추가로 무시할 Armor</span>
                <input inputMode="numeric" value={ignoreText} onChange={(event) => setIgnoreText(event.target.value)}
                  aria-invalid={extraArmorIgnore === null || undefined} placeholder="0" />
              </label>
              <label className="field"><span>유형별 피해 감소</span>
                <input inputMode="numeric" value={reductionText} onChange={(event) => setReductionText(event.target.value)}
                  aria-invalid={reduction === null || undefined} placeholder="0" />
              </label>
              {type && (
                <fieldset className="damage-reactions">
                  <legend>{type} 피해 반응</legend>
                  {REACTION_LABELS.map(([key, label]) => (
                    <label className="damage-check" key={key}><input type="checkbox" checked={reactions[key]}
                      onChange={(event) => setReactionOverrides({ ...reactionOverrides, [key]: event.target.checked })} />{label}</label>
                  ))}
                </fieldset>
              )}
            </div>
          </details>
          {invalid ? <p className="field-err" role="alert">주사위 값은 양의 정수로 입력하세요. Armor·무시·감소에는 0 이상의 정수를 사용하세요.</p>
            : result && type && (
              <DamageBreakdown result={result} armor={armor ?? 0} critical={critical} weak={weak}
                type={type} reactions={reactions} reduction={reduction ?? 0} pc={pc} />
            )}
          {type && roll !== null && armorText === '' && !bypass && (
            <p className="damage-note">Armor를 입력하면 피해를 계산합니다.</p>
          )}
        </>
      )}
      {pc && <PcDamageApplication amount={incomingAmount} />}
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

function PcDamageApplication({ amount }: { amount: number | null }) {
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
    </section>
  );
}

function DamageBreakdown({ result, armor, critical, weak, type, reactions, reduction, pc }: {
  result: ReturnType<typeof calculateDirectDamage>;
  armor: number;
  critical: number;
  weak: boolean;
  type: DamageType;
  reactions: DamageReactions;
  reduction: number;
  pc: boolean;
}) {
  const { base, multiplier, piercing, beforeArmor, armorIgnore, absorbed, afterArmor, slashing, afterType, reacted, amount, restored } = result;
  const modifierLabel = critical > 1 && weak ? '치명타·약점' : weak ? '약점' : '치명타';
  const reactionLabel = reactions.immune ? '면역' : reactions.vulnerable && reactions.resistant ? '취약·저항 상쇄'
    : reactions.vulnerable ? '취약 ×2' : reactions.resistant ? '저항 ½ · 올림' : '';
  return (
    <div className="damage-result">
      <dl>
        <div><dt>주사위 + 고정 보정</dt><dd>{base}</dd></div>
        {multiplier > 1 && <div><dt>{modifierLabel} ×{multiplier}</dt><dd>{base * multiplier}</dd></div>}
        {piercing > 0 && <div><dt>Piercing 치명타 +{piercing}</dt><dd>{beforeArmor}</dd></div>}
        {(armor > 0 || ignoresArmor(type)) && (
          <div><dt>{ignoresArmor(type) ? 'Armor 무시' : `Armor −${absorbed}`}{!ignoresArmor(type) && armorIgnore > 0 && ` (${armorIgnore} 무시)`}</dt><dd>{afterArmor}</dd></div>
        )}
        {slashing > 0 && <div><dt>Slashing +{slashing}</dt><dd>{afterType}</dd></div>}
        {reactionLabel && <div><dt>{reactionLabel}</dt><dd>{reacted}</dd></div>}
        {reduction > 0 && <div><dt>유형별 피해 감소 −{reduction}</dt><dd>{amount}</dd></div>}
      </dl>
      <p role="status">{restored ? (pc ? 'Health 회복' : 'Wounds 회복') : '최종 피해'} <strong>{amount}</strong> <span>{type}</span></p>
      {type === 'Acid' && amount > 0 && !restored && (
        <p className="damage-note">Acid 피해를 입은 부위는 캠프 수리 전까지 Armor −1.</p>
      )}
    </div>
  );
}
