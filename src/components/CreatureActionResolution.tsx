import type { Dispatch, SetStateAction } from 'react';
import type { ActionDamage, CreatureActionRule } from '../content/creature-action-rules';
import type { CreatureAction } from '../content/entries/creatures';
import { pooledDie, type RollResult } from '../lib/dice';
import type { DamageType } from '../lib/damage';
import { splitActionDamage, withDamageBonuses, type ActionDamagePool } from '../lib/damage-pool';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../lib/play-draft';
import { CreatureAreaTargets, type CreatureAreaRole, type SharedActionDamage } from './CreatureAreaTargets';
import { CreatureSummonRoll, type CombatSummonControls } from './CreatureSummonRoll';
import { DamageTypeGuide } from './DamageTypeGuide';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';
import { PhysicalSkillRoll, skillCheckSucceeded } from './PhysicalSkillRoll';
import { XRef } from './bits';

export function CreatureActionResolution({ action, rule, summons, damageBonuses = [] }: {
  action: CreatureAction;
  rule: CreatureActionRule;
  summons?: CombatSummonControls;
  /** Level Adaptation damage bonuses that apply at the current level, e.g. ['+D6']. */
  damageBonuses?: readonly string[];
}) {
  const [element, setElement] = usePlayDraftState<RollResult | undefined>('element', undefined);
  const revision = usePlayDraftState('resistance-run', 0);
  const [setupDuration, setSetupDuration] = usePlayDraftState<RollResult | undefined>('setup-duration', undefined);
  const clear = useClearPlayDraftScope();
  const alternate = action.tag === 'Magical' && !!rule.resistance && !['Spellward', 'Magic Resistance'].includes(rule.resistance);
  const elementType = !element ? undefined : element.total <= 2 ? 'Fire' : element.total <= 4 ? 'Lightning' : 'Force';
  const { damage, applied } = withDamageBonuses(elementType ? [[elementType, 'D6']] : rule.damage ?? [], damageBonuses);
  const renderTarget = (name?: string, shared?: SharedActionDamage, role?: CreatureAreaRole) => (
    <ActionTargetResolution rule={rule} damage={damage} target={name} shared={shared} role={role} summons={summons}
      elementRevision={rule.elemental ? revision : undefined} />
  );

  if (!(rule.resistance || damage.length || rule.after || rule.timing || rule.target || rule.duration
    || rule.setupDuration || rule.summons || rule.elemental)) return null;

  return (
    // Opens with the rolled action: its resistance check and effects are the next thing to resolve.
    <details className="fold creature-action-resolution" open>
      <summary>{rule.resistance ? `${rule.resistance} 판정과 행동 효과` : '행동 효과 처리'}</summary>
      <div className="creature-resolution-body">
        {(rule.target || rule.timing || rule.healthOnly) && <dl>
          {rule.target && <div><dt>대상</dt><dd>{rule.target}</dd></div>}
          {rule.timing && <div><dt>시점</dt><dd>{rule.timing}</dd></div>}
          {rule.healthOnly && <div><dt>피해 적용</dt><dd>Health에 직접 적용</dd></div>}
        </dl>}
        {rule.setupDuration && <PhysicalDiceRoll label="지속 라운드" dice={rule.setupDuration} value={setupDuration}
          onValue={setSetupDuration} resultText={({ total }) => `${total}라운드`} />}
        {rule.elemental && <PhysicalDiceRoll label="원소 결정" dice="D6" value={element}
          resultText={() => elementType} onValue={(value) => {
            clear(`rolls-${revision[0]}`);
            revision[1]((number) => number + 1);
            setElement(value);
          }} />}
        {applied.length > 0 && <p className="damage-note">피해에 레벨 적응 {applied.join(' ')} 포함 · 피해 풀에서 가장 높은 눈</p>}
        {alternate && <p className="damage-note">행동이 지정한 판정입니다. 일반 <XRef id="magical-attacks">Spellward 규칙</XRef>과 이 판정의 관계는 룰북에서 불명확합니다.</p>}
        {!rule.elemental && rule.targetScope && (rule.resistance || rule.after)
          ? <CreatureAreaTargets damage={damage} renderTarget={renderTarget} />
          : renderTarget()}
      </div>
    </details>
  );
}

function ActionTargetResolution({ rule, damage, target, shared, role = 'pc', summons, elementRevision }: {
  rule: CreatureActionRule;
  damage: readonly ActionDamage[];
  target?: string;
  shared?: SharedActionDamage;
  role?: CreatureAreaRole;
  summons?: CombatSummonControls;
  elementRevision?: [number, Dispatch<SetStateAction<number>>];
}) {
  const [resisted, setResisted] = usePlayDraftState<boolean | null>('resisted', null);
  const [fumbled, setFumbled] = usePlayDraftState('resist-fumble', false);
  const [extraResisted, setExtraResisted] = usePlayDraftState<boolean | null>('extra-resisted', null);
  const revisionState = usePlayDraftState('resistance-run', 0);
  const [revision, setRevision] = elementRevision ?? revisionState;
  const clear = useClearPlayDraftScope();
  const onResistance = (pass: boolean | null, fumble = false) => {
    clear(`extra-${revision}`);
    clear(`rolls-${revision}`);
    setRevision((version) => version + 1);
    setExtraResisted(null);
    setResisted(pass);
    setFumbled(fumble);
  };
  const susceptible = !rule.resistance || resisted === false;
  // Core pp.72–73: a Spellward or Dodge critical failure doubles the damage from what the PC tried to resist.
  const doubled = resisted === false && fumbled && role === 'pc' && (rule.resistance === 'Spellward' || rule.resistance === 'Dodge');
  const scale: DamageScale = doubled ? 'double' : resisted === true && rule.success === 'half' ? 'half' : 'normal';
  const halfDamage = scale === 'half';
  const additional = !!rule.after && susceptible;
  const withTarget = (label: string) => target ? `${label} · ${target}` : label;
  const context = role === 'pc' ? 'skill' : 'npc';

  return (
    <div className="creature-target-resolution">
        {rule.resistance && (
          <PhysicalSkillRoll label={withTarget(`${rule.resistance} 판정`)} skill={rule.resistance} context={context}
            onResult={(result) => onResistance(skillCheckSucceeded(result), result.outcome === 'fumble')} onClear={() => onResistance(null)} />
        )}
        {resisted !== null && (
          <p className="creature-resistance-outcome">
            {doubled ? `대실패 · 피해 2배${rule.resistance === 'Spellward' ? ' (피해가 없으면 지속 시간 2배)' : ''}`
              : susceptible ? '행동표의 실패 효과를 적용합니다.' : halfDamage ? '피해 절반 · 올림' : '저항 성공 · 이 판정의 실패 효과를 피했습니다.'}
          </p>
        )}
        {additional && (
          <PlayDraftScope name={`extra-${revision}`} key={`extra-${revision}`}>
            <PhysicalSkillRoll label={withTarget(`추가 ${rule.after} 판정`)} skill={rule.after!} context={context}
              onResult={(result) => setExtraResisted(skillCheckSucceeded(result))} onClear={() => setExtraResisted(null)} />
          </PlayDraftScope>
        )}
        {additional && extraResisted !== null && (
          <p className="creature-resistance-outcome">{extraResisted ? '추가 효과를 피했습니다.' : '행동표의 추가 효과를 확인하세요.'}</p>
        )}
        {rule.summons && <PlayDraftScope name={`rolls-${revision}`} key={`summon-${revision}`}>
          <CreatureSummonRoll summon={rule.summons} encounter={summons} />
        </PlayDraftScope>}
        {(susceptible || halfDamage) && (
          <PlayDraftScope name={`rolls-${revision}`} key={`rolls-${revision}`}>
            <ActionOutcomeRolls damage={damage} duration={susceptible ? rule.duration : undefined} scale={scale}
              target={target} shared={shared} />
          </PlayDraftScope>
        )}
    </div>
  );
}

type DamageScale = 'half' | 'normal' | 'double';

function ActionOutcomeRolls({ damage, duration, scale, target, shared }: {
  damage: readonly ActionDamage[];
  duration?: string;
  scale: DamageScale;
  target?: string;
  shared?: SharedActionDamage;
}) {
  const [durationRoll, setDurationRoll] = usePlayDraftState<RollResult | undefined>('duration', undefined);
  const { fixed, pool } = splitActionDamage(damage);
  return (
    <>
      {fixed.map(([type, amount], index) => <div className="creature-action-damage" key={index}>
        <p>{damageText(type, amount, scale)}</p>
        <DamageTypeGuide type={type} />
      </div>)}
      {pool && <PlayDraftScope name="damage-pool">
        <ActionDamageRoll pool={pool} scale={scale} target={target} shared={shared ? shared[0] ?? null : undefined} />
      </PlayDraftScope>}
      {duration && <PhysicalDiceRoll label={target ? `지속 라운드 · ${target}` : '지속 라운드'} dice={duration} value={durationRoll}
        onValue={setDurationRoll} resultText={({ total }) => `${total}라운드`} />}
    </>
  );
}

const scaled = (amount: number, scale: DamageScale) => scale === 'half' ? Math.ceil(amount / 2) : scale === 'double' ? amount * 2 : amount;
const damageText = (type: DamageType, amount: number, scale: DamageScale) =>
  `${type} 피해 ${scale === 'half' ? `${scaled(amount, scale)} (절반 · 올림)` : scale === 'double' ? `${scaled(amount, scale)} (대실패 2배)` : amount}`;

/** Core p.81: a creature uses one die from its Damage Pool. With mixed damage types the player picks the die. */
function ActionDamageRoll({ pool, scale, target, shared }: {
  pool: ActionDamagePool;
  scale: DamageScale;
  target?: string;
  shared?: RollResult | null;
}) {
  const [rolled, setRolled] = usePlayDraftState<RollResult | undefined>('roll', undefined);
  const typeLabel = [...new Set(pool.types)].join(' + ');
  const outcome = (roll: RollResult) => {
    const { index, amount } = pooledDie(roll);
    const note = pool.types.length > 1 && !pool.mixed ? ' · 가장 높은 눈' : '';
    return damageText(pool.types[index], amount, scale) + note;
  };
  return (
    <div className="creature-action-damage">
      {shared === undefined
        ? <PhysicalDiceRoll label={target ? `${typeLabel} 피해 · ${target}` : `${typeLabel} 피해`} dice={pool.dice}
            value={rolled} onValue={setRolled} resultText={outcome} pool={{
              choose: pool.mixed, labels: pool.types,
              preview: scale === 'normal' ? undefined : (amount) => `→ ${scale === 'half' ? '절반' : '2배'} ${scaled(amount, scale)}`,
            }} />
        : <p>{shared?.expr === pool.dice ? outcome(shared) : `공유 ${typeLabel} 피해 굴림 대기`}</p>}
      {[...new Set(pool.types)].map((type) => <DamageTypeGuide key={type} type={type} />)}
    </div>
  );
}
