import type { Dispatch, SetStateAction } from 'react';
import type { ActionDamage, CreatureActionRule } from '../content/creature-action-rules';
import type { CreatureAction } from '../content/entries/creatures';
import type { RollResult } from '../lib/dice';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../lib/play-draft';
import { CreatureAreaTargets, type SharedActionDamage } from './CreatureAreaTargets';
import { CreatureSummonRoll, type CombatSummonControls } from './CreatureSummonRoll';
import { DamageTypeGuide } from './DamageTypeGuide';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';
import { PhysicalSkillRoll, skillCheckSucceeded } from './PhysicalSkillRoll';
import { XRef } from './bits';

export function CreatureActionResolution({ action, rule, summons }: {
  action: CreatureAction;
  rule: CreatureActionRule;
  summons?: CombatSummonControls;
}) {
  const [element, setElement] = usePlayDraftState<RollResult | undefined>('element', undefined);
  const revision = usePlayDraftState('resistance-run', 0);
  const [setupDuration, setSetupDuration] = usePlayDraftState<RollResult | undefined>('setup-duration', undefined);
  const clear = useClearPlayDraftScope();
  const alternate = action.tag === 'Magical' && !!rule.resistance && !['Spellward', 'Magic Resistance'].includes(rule.resistance);
  const elementType = !element ? undefined : element.total <= 2 ? 'Fire' : element.total <= 4 ? 'Lightning' : 'Force';
  const damage: readonly ActionDamage[] = elementType ? [[elementType, 'D6']] : rule.damage ?? [];
  const renderTarget = (name?: string, shared?: SharedActionDamage) => (
    <ActionTargetResolution rule={rule} damage={damage} target={name} shared={shared} summons={summons}
      elementRevision={rule.elemental ? revision : undefined} />
  );

  if (!(rule.resistance || damage.length || rule.after || rule.timing || rule.target || rule.duration
    || rule.setupDuration || rule.summons || rule.elemental)) return null;

  return (
    <details className="fold creature-action-resolution">
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
        {alternate && <p className="damage-note">행동이 지정한 판정입니다. 일반 <XRef id="magical-attacks">Spellward 규칙</XRef>과 이 판정의 관계는 룰북에서 불명확합니다.</p>}
        {!rule.elemental && rule.targetScope && (rule.resistance || rule.after)
          ? <CreatureAreaTargets damage={damage} renderTarget={renderTarget} />
          : renderTarget()}
      </div>
    </details>
  );
}

function ActionTargetResolution({ rule, damage, target, shared, summons, elementRevision }: {
  rule: CreatureActionRule;
  damage: readonly ActionDamage[];
  target?: string;
  shared?: SharedActionDamage;
  summons?: CombatSummonControls;
  elementRevision?: [number, Dispatch<SetStateAction<number>>];
}) {
  const [resisted, setResisted] = usePlayDraftState<boolean | null>('resisted', null);
  const [extraResisted, setExtraResisted] = usePlayDraftState<boolean | null>('extra-resisted', null);
  const revisionState = usePlayDraftState('resistance-run', 0);
  const [revision, setRevision] = elementRevision ?? revisionState;
  const clear = useClearPlayDraftScope();
  const onResistance = (pass: boolean | null) => {
    clear(`extra-${revision}`);
    clear(`rolls-${revision}`);
    setRevision((version) => version + 1);
    setExtraResisted(null);
    setResisted(pass);
  };
  const susceptible = !rule.resistance || resisted === false;
  const halfDamage = resisted === true && rule.success === 'half';
  const additional = !!rule.after && susceptible;
  const withTarget = (label: string) => target ? `${label} · ${target}` : label;

  return (
    <div className="creature-target-resolution">
        {rule.resistance && (
          <PhysicalSkillRoll label={withTarget(`${rule.resistance} 판정`)} skill={rule.resistance}
            onResult={(result) => onResistance(skillCheckSucceeded(result))} onClear={() => onResistance(null)} />
        )}
        {resisted !== null && (
          <p className="creature-resistance-outcome">
            {susceptible ? '행동표의 실패 효과를 적용합니다.' : halfDamage ? '피해 절반 · 올림' : '저항 성공 · 이 판정의 실패 효과를 피했습니다.'}
          </p>
        )}
        {additional && (
          <PlayDraftScope name={`extra-${revision}`} key={`extra-${revision}`}>
            <PhysicalSkillRoll label={withTarget(`추가 ${rule.after} 판정`)} skill={rule.after!}
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
            <ActionOutcomeRolls damage={damage} duration={susceptible ? rule.duration : undefined} halfDamage={halfDamage}
              target={target} shared={shared} />
          </PlayDraftScope>
        )}
    </div>
  );
}

function ActionOutcomeRolls({ damage, duration, halfDamage, target, shared }: {
  damage: readonly ActionDamage[];
  duration?: string;
  halfDamage: boolean;
  target?: string;
  shared?: SharedActionDamage;
}) {
  const [durationRoll, setDurationRoll] = usePlayDraftState<RollResult | undefined>('duration', undefined);
  return (
    <>
      {damage.map((effect, index) => (
        <PlayDraftScope key={index} name={`damage-${index}`}>
          <ActionDamageRoll effect={effect} halfDamage={halfDamage} target={target} shared={shared ? shared[index] ?? null : undefined} />
        </PlayDraftScope>
      ))}
      {duration && <PhysicalDiceRoll label={target ? `지속 라운드 · ${target}` : '지속 라운드'} dice={duration} value={durationRoll}
        onValue={setDurationRoll} resultText={({ total }) => `${total}라운드`} />}
    </>
  );
}

function ActionDamageRoll({ effect: [type, amount], halfDamage, target, shared }: {
  effect: ActionDamage;
  halfDamage: boolean;
  target?: string;
  shared?: RollResult | null;
}) {
  const [rolled, setRolled] = usePlayDraftState<RollResult | undefined>('roll', undefined);
  const text = (total: number) => `${type} 피해 ${halfDamage ? `${Math.ceil(total / 2)} (절반 · 올림)` : total}`;
  return (
    <div className="creature-action-damage">
      {typeof amount === 'number' ? <p>{text(amount)}</p> : shared === undefined
        ? <PhysicalDiceRoll label={target ? `${type} 피해 · ${target}` : `${type} 피해`} dice={amount}
            value={rolled} onValue={setRolled} resultText={({ total }) => text(total)} />
        : <p>{shared?.expr === amount ? text(shared.total) : `공유 ${type} 피해 굴림 대기`}</p>}
      <DamageTypeGuide type={type} />
    </div>
  );
}
