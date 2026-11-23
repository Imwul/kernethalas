import { titleOf } from '../../content';
import { creatureDefenses } from '../../content/creature-defenses';
import type { CreatureRecord } from '../../content/entries/creatures';
import { damageReactionsWithEffects, temporaryDamageEffects } from '../../lib/combat-preview-reactions';
import { DAMAGE_TYPES, damageReactionText, isPhysicalDamage, listedDamageReactions, type DamageType } from '../../lib/damage';
import { usePlayDraftState } from '../../lib/play-draft';
import { XRef } from '../bits';
import '../../styles/play-combat-tools.css';

type ComparisonTarget = { id: string; label: string; creature: CreatureRecord };

const RELATED_CONDITION = {
  Cold: 'Freezing',
  Fire: 'Burning',
  Poison: 'Poisoned',
} as const satisfies Partial<Record<DamageType, string>>;

export function PlayDamageComparison({ targets }: { targets: readonly ComparisonTarget[] }) {
  const [open, setOpen] = usePlayDraftState('comparison-open', false);
  const [type, setType] = usePlayDraftState<DamageType>('comparison-type', 'Slashing');
  const [magical, setMagical] = usePlayDraftState('comparison-magical', false);
  const [activeEffects, setActiveEffects] = usePlayDraftState<Record<string, string[]>>('comparison-effects', {});
  const comparisons = targets.map(({ id, label, creature }) => ({
    id, label, defenses: creatureDefenses(creature), effects: temporaryDamageEffects(creature),
  }));
  const showMagical = comparisons.some(({ defenses, effects }) =>
    (isPhysicalDamage(type) && defenses.resistsNonMagicalPhysical) || effects.some(({ modifiers }) =>
      modifiers.some(({ nonMagical }) => nonMagical)));
  const condition = type === 'Cold' || type === 'Fire' || type === 'Poison' ? RELATED_CONDITION[type] : undefined;

  return (
    <details className="fold play-combat-tools" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>피해 유형 비교</summary>
      <section className="play-combat-tool-body" aria-label="조우 피해 유형 비교">
        <div className="play-combat-tool-controls">
          <label className="field">
            <span>비교할 피해 유형</span>
            <select value={type} onChange={(event) => setType(event.target.value as DamageType)}>
              {DAMAGE_TYPES.map((damage) => <option key={damage}>{damage}</option>)}
            </select>
          </label>
          {showMagical && <label className="play-combat-tool-check">
            <input type="checkbox" checked={magical} onChange={(event) => setMagical(event.target.checked)} />
            마법 피해
          </label>}
          <XRef id="vulnerability">피해 반응 규칙</XRef>
        </div>
        <table className="play-damage-comparison">
          <caption>생물 유형·특성과 표시한 임시 효과</caption>
          <thead><tr><th scope="col">대상</th><th scope="col">{type} 반응</th></tr></thead>
          <tbody>
            {comparisons.map(({ id, label, defenses, effects }) => {
              const active = activeEffects[id] ?? [];
              const modifiers = effects.filter(({ name }) => active.includes(name)).flatMap(({ modifiers }) => modifiers);
              const reaction = damageReactionsWithEffects(listedDamageReactions(type, magical, defenses), modifiers, type, magical);
              const appearance = reaction.immune || reaction.restored || reaction.resistant ? 'guard'
                : reaction.vulnerable ? 'vulnerable' : 'neutral';
              return (
                <tr key={id}>
                  <th scope="row" lang="en">{label}</th>
                  <td>
                    <span className="play-damage-response" data-reaction={appearance}>{damageReactionText(reaction)}</span>
                    {condition && defenses.immuneConditions.includes(condition) &&
                      <span className="play-damage-immunity">{titleOf(condition.toLowerCase()).ko} 상태 면역</span>}
                    {effects.length > 0 && <details className="fold play-damage-actions">
                      <summary>임시 효과{active.length > 0 && ` ${active.length}개 적용 중`}</summary>
                      {effects.map(({ name, description }) => (
                        <label className="play-combat-tool-check" key={name}>
                          <input type="checkbox" checked={active.includes(name)} onChange={(event) => {
                            const enabled = event.target.checked;
                            setActiveEffects((previous) => {
                              const current = previous[id] ?? [];
                              return { ...previous, [id]: enabled ? [...current, name] : current.filter((effect) => effect !== name) };
                            });
                          }} />
                          <span><b lang="en">{name}</b><span>{description.replaceAll('·', ' · ')}</span></span>
                        </label>
                      ))}
                    </details>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </details>
  );
}
