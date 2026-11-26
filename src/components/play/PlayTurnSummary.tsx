import { creatureDefenses } from '../../content/creature-defenses';
import type { CreatureRecord } from '../../content/entries/creatures';
import { masteryCatalog } from '../../content/entries/masteries';
import { goalByName } from '../../lib/character-creation';
import { goalCounts } from '../../lib/character-progress';
import { damageReactionText, listedDamageReactions } from '../../lib/damage';
import { describeMasteryAbility } from '../../lib/mastery-play';
import { usePlayCharacter } from '../../lib/play-character';
import { useCombatPosition } from '../../lib/play-combat-timing';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { usePlayOngoingEffects } from '../../lib/play-effects';
import type { GearItem } from '../../lib/play-inventory';
import { playAction } from '../../lib/play-roll-history';
import { XRef } from '../bits';
import { USE_ABILITY_EVENT, type PlayAbilityRequest } from './PlayCharacter';

type RoundActions = { round: number; standard: boolean; free: boolean; reactions: number };
type Target = { id: string; label: string; creature: CreatureRecord };

function EncounterOptions({ target, enemyTurn, actions, onMastery }: {
  target: Target;
  enemyTurn: boolean;
  actions: RoundActions;
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
      const [action] = ability.use.split(' · ');
      const available = enemyTurn ? action === '반응' : action === '자유 행동' ? !actions.free
        : !actions.standard && (action === '표준 행동 1' || action === '표준 행동 2');
      if (!available) return [];
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

export function PlayTurnSummary({ targets, selected, belt, initiative, onAttack, onBelt, onMastery, onRound, onFlee }: {
  targets: readonly Target[];
  selected?: Target;
  belt: readonly GearItem[];
  initiative?: string;
  onAttack: () => void;
  onBelt?: () => void;
  onMastery: () => void;
  onRound: () => void;
  onFlee: () => void;
}) {
  const [position, setPosition] = useCombatPosition();
  const [stored, setActions] = usePlayDraftState<RoundActions | null>('round-actions', null);
  const commit = usePlayRoll();
  const actions = stored?.round === position.round ? stored : { round: position.round, standard: false, free: false, reactions: 0 };
  const pcTurn = position.timing === 'start' && position.actor === 'pc';
  const enemyTurn = position.timing === 'start' && position.actor !== null && position.actor !== 'pc';
  const actor = position.actor === 'pc' ? 'PC' : targets.find(({ id }) => id === position.actor)?.label;
  const note = (patch: Partial<RoundActions>, label: string) => commit(() => setActions({ ...actions, ...patch }), playAction(label));
  const beltLabel = belt.slice(0, 3).map(({ name, count }) => `${name} ×${count}`).join(' · ');

  return <section className="play-turn-summary" aria-label="현재 전투 턴">
    <div className="play-turn-heading">
      <div className="play-round-status" role="status">
        <strong>{position.round}라운드</strong>
        <span>{position.timing === 'round' ? initiative ?? '라운드 시작' : actor ? `${actor} 턴 ${position.timing === 'start' ? '진행 중' : '종료'}` : '턴 대상 선택'}</span>
      </div>
      <div className="play-turn-shortcuts">
        <button className="btn ghost" type="button" onClick={() => {
          commit(() => setPosition({ ...position, actor: 'pc', timing: pcTurn ? 'end' : 'start' }), playAction(pcTurn ? 'PC 턴 종료' : 'PC 턴 시작'));
        }}>{pcTurn ? 'PC 턴 종료' : 'PC 턴 시작'}</button>
        <button className="btn ghost" type="button" onClick={onRound}>턴·라운드 열기</button>
      </div>
    </div>
    <div className="play-turn-usage" role="group" aria-label="이번 라운드 PC 행동 기록">
      <label><input type="checkbox" checked={actions.standard} onChange={({ target }) => note({ standard: target.checked }, 'PC 표준 행동 표시')} />
        <span>표준 행동 사용</span></label>
      <label><input type="checkbox" checked={actions.free} onChange={({ target }) => note({ free: target.checked }, 'PC 자유 행동 표시')} />
        <span>자유 행동 사용</span></label>
      <div className="play-turn-reactions">
        <XRef id="defense-reaction-penalty">다음 반응 {actions.reactions ? `−${actions.reactions * 20}` : '0'}</XRef>
        <button className="btn ghost" type="button" disabled={actions.reactions >= 99}
          onClick={() => note({ reactions: actions.reactions + 1 }, 'PC 반응 사용')}>반응 +1</button>
        <button className="btn ghost" type="button" aria-label="반응 사용 1회 빼기" disabled={!actions.reactions}
          onClick={() => note({ reactions: actions.reactions - 1 }, 'PC 반응 사용 정정')}>−1</button>
      </div>
    </div>
    <div className="play-turn-shortcuts" role="group" aria-label="전투 바로가기">
      {selected && <button className="btn ghost" type="button" onClick={onAttack}>PC 공격 입력</button>}
      <button className="btn ghost" type="button" onClick={onMastery}>Mastery 열기</button>
      {onBelt && <button className="btn ghost" type="button" onClick={onBelt}>벨트 확인{belt.length > 0 && ` (${belt.length})`}</button>}
      <button className="btn ghost" type="button" onClick={onFlee}>전투 도주 열기</button>
    </div>
    {beltLabel && <p className="play-turn-belt">벨트 · {beltLabel}{belt.length > 3 && ` 외 ${belt.length - 3}종`}</p>}
    {selected && <EncounterOptions target={selected} enemyTurn={enemyTurn} actions={actions} onMastery={onMastery} />}
  </section>;
}
