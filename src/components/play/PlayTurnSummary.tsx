import { creatureDefenses } from '../../content/creature-defenses';
import type { CreatureRecord } from '../../content/entries/creatures';
import { masteryCatalog } from '../../content/entries/masteries';
import { goalByName } from '../../lib/character-creation';
import { goalCounts } from '../../lib/character-progress';
import { damageReactionText, listedDamageReactions } from '../../lib/damage';
import { describeMasteryAbility } from '../../lib/mastery-play';
import { usePlayCharacter } from '../../lib/play-character';
import { usePlayOngoingEffects } from '../../lib/play-effects';
import type { GearItem } from '../../lib/play-inventory';
import { USE_ABILITY_EVENT, type PlayAbilityRequest } from './PlayCharacter';
import '../../styles/play-combat-tools.css';

type Target = { id: string; label: string; creature: CreatureRecord };

function EncounterOptions({ target, onMastery }: {
  target: Target;
  onMastery: () => void;
}) {
  const pc = usePlayCharacter();
  const { current } = usePlayOngoingEffects();
  if (!pc) return null;

  const { masteries = [], amulet } = pc.character;
  const learned = new Map<string, number>();
  for (const { id, tier } of [...masteries, ...(amulet ? [amulet] : [])]) {
    learned.set(id, Math.max(tier, learned.get(id) ?? 0));
  }
  const defenses = creatureDefenses(target.creature);
  const abilities = masteryCatalog.flatMap((mastery) => {
    const tier = learned.get(mastery.id) ?? 0;
    return mastery.abilities.filter((ability) => ability.tier <= tier).flatMap((ability) => {
      if (current.abilities.some(({ id, used, reserved }) => id === ability.id && (used || reserved))) return [];
      const { roll, magical, targets } = describeMasteryAbility(ability);
      const effect = targets !== 'self' && roll?.mode === 'damage' && roll.type
        ? listedDamageReactions(roll.type, magical, defenses) : null;
      const detail = effect && (effect.vulnerable || effect.resistant || effect.restored) ? damageReactionText(effect) : '';
      return [{ ability, masteryId: mastery.id, tier, detail, priority: effect?.restored ? 2 : effect?.vulnerable ? 0 : 1 }];
    });
  }).sort((first, second) => first.priority - second.priority);
  const gains = goalCounts({ defeated: [{ types: target.creature.types, overseer: target.creature.group === 'overseer' }], sheet: [], darkness: 0 });
  const goals = pc.goals.filter(({ name, progress }) => gains[name] && progress < (goalByName.get(name)?.target ?? 0));
  if (!goals.length && !abilities.length) return null;

  return <div className="play-turn-context">
    {goals.length > 0 && <ul aria-label="선택한 적의 개인 목표">
      {goals.map(({ name, progress }) => <li key={name}><strong>{name} {progress}/{goalByName.get(name)?.target}</strong> · 처치 시 +{gains[name]}</li>)}
    </ul>}
    {abilities.length > 0 && <div className="play-turn-shortcuts" role="group" aria-label="배운 Mastery 바로 쓰기">
      {abilities.slice(0, 3).map(({ ability, masteryId, tier, detail }) => <button className="btn ghost" type="button" key={ability.id}
        onClick={() => {
          document.dispatchEvent(new CustomEvent<PlayAbilityRequest>(USE_ABILITY_EVENT, { detail: {
            masteryId, tier, abilityId: ability.id, targetId: target.id,
          } }));
          onMastery();
        }}>
        <span lang="en">{ability.name}</span><small>{ability.use}{detail && ` · ${target.label} ${detail}`}</small>
      </button>)}
    </div>}
  </div>;
}

/** The fight at a glance: shortcuts into the combat card and the PC's best options against the selected enemy. */
export function PlayTurnSummary({ selected, belt, onAttack, onEnemyAction, onBelt, onMastery, onFlee }: {
  selected?: Target;
  belt: readonly GearItem[];
  onAttack: () => void;
  onEnemyAction?: () => void;
  onBelt?: () => void;
  onMastery: () => void;
  onFlee: () => void;
}) {
  const beltLabel = belt.slice(0, 3).map(({ name, count }) => `${name} ×${count}`).join(' · ');

  return <section className="play-turn-summary" aria-label="전투 바로가기">
    <div className="play-turn-shortcuts" role="group" aria-label="전투 바로가기">
      {selected && onEnemyAction && <button className="btn ghost" type="button" onClick={onEnemyAction}>
        적 행동 {selected.creature.actionDice ?? 'D6'}</button>}
      {selected && <button className="btn ghost" type="button" onClick={onAttack}>PC 공격</button>}
      <button className="btn ghost" type="button" onClick={onMastery}>Mastery 열기</button>
      {onBelt && <button className="btn ghost" type="button" onClick={onBelt}>벨트 확인{belt.length > 0 && ` (${belt.length})`}</button>}
      <button className="btn ghost" type="button" onClick={onFlee}>전투 도주 열기</button>
    </div>
    {beltLabel && <p className="play-turn-belt">벨트 · {beltLabel}{belt.length > 3 && ` 외 ${belt.length - 3}종`}</p>}
    {selected && <EncounterOptions target={selected} onMastery={onMastery} />}
  </section>;
}
