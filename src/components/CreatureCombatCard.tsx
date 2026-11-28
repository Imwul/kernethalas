import { useContext, useId, useImperativeHandle, useRef, type Ref } from 'react';
import { tableById, titleOf } from '../content';
import { creatureActionRule } from '../content/creature-action-rules';
import { creatureDefenses } from '../content/creature-defenses';
import { armorKo, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import type { Entry, OracleTable } from '../content/schema';
import { calculateCreatureAdaptation, readCreatureLevel } from '../lib/creature-adaptation';
import { DAMAGE_TYPES, isPhysicalDamage, listedDamageReactions, type DamageType } from '../lib/damage';
import {
  creatureActionTable, creatureAttackDamage, creatureAttackPool, creatureHitImpact, creatureHitTable, creaturePenetration,
  creatureSpoilsTables, formatAttackDamage,
} from '../lib/creature-combat';
import { creatureActionSource } from '../lib/overlay';
import { usePlayCharacter } from '../lib/play-character';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../lib/play-draft';
import type { PhysicalAttackResult } from '../lib/attack-defense';
import { attackWeapon, type PcWeapon } from '../lib/play-weapons';
import { OracleBody } from '../views/Oracle';
import { TogglePanel } from './TogglePanel';
import { AttackFollowUpRoll } from './AttackFollowUps';
import { XRef } from './bits';
import { CheckCalculator } from './CheckCalculator';
import { ChoiceButtons } from './ChoiceButtons';
import { CreatureAdaptation } from './CreatureAdaptation';
import { CreatureActionResolution } from './CreatureActionResolution';
import { CreatureTraitSummary } from './CreatureTraitSummary';
import type { CombatSummonControls } from './CreatureSummonRoll';
import { DamageCalculator, type IncomingAttack } from './DamageCalculator';
import { DamageTypeGuide } from './DamageTypeGuide';
import { EncounterStart } from './EncounterStart';
import { ApplyConditions } from './play/PlayLingering';
import { PlayDiscoveryMode } from './play/PlayDiscovery';
import '../styles/creature-combat.css';

const PC_HIT_TABLE = tableById.get('t-hit-humanoid')!;
/** Core p.79: when both sides fail, the defender takes 1 damage that nothing reduces. */
const BOTH_FAILED_DAMAGE = 1;
type CombatSide = 'pc' | 'enemy';

export type CreatureCombatHandle = { openPcAttack: () => void; openEnemyAction: () => void };

const NO_WEAPONS: readonly PcWeapon[] = [];

export function CreatureCombatCard({ creature, entry, targetName, summons, showEncounterStart = true, showAftermath = true, allowApplyingConditions = true, weapons = NO_WEAPONS, ref }: {
  creature: CreatureRecord;
  /** Weapons the PC carries (gear ledger): the PC's attack takes damage type, Speed and traits from one of them. */
  weapons?: readonly PcWeapon[];
  entry: Entry;
  targetName?: string;
  summons?: CombatSummonControls;
  showEncounterStart?: boolean;
  /** Play mode handles the end of a fight in its wrap-up stage. */
  showAftermath?: boolean;
  allowApplyingConditions?: boolean;
  ref?: Ref<CreatureCombatHandle>;
}) {
  const panes = useId();
  const pcPane = `${panes}-pc`;
  const enemyPane = `${panes}-enemy`;
  const discovery = useContext(PlayDiscoveryMode) && !showAftermath;
  const [actionsRevealed, setActionsRevealed] = usePlayDraftState('creature-actions-revealed', false);
  const [typedLevel, setLevelText] = usePlayDraftState('creature-level', '');
  const player = usePlayCharacter();
  const sheetLevel = player?.level ?? '';
  const levelText = typedLevel || sheetLevel;
  // Two flows instead of separate tools: the PC attacks, or the enemy acts (its action roll decides how).
  const [side, setSide] = usePlayDraftState<CombatSide>('creature-side', 'enemy');
  const [actionValue, setActionValue] = usePlayDraftState<number | null>('creature-action', null);
  const [actionRevision, setActionRevision] = usePlayDraftState('creature-action-revision', 0);
  const [attackChoice, setAttackChoice] = usePlayDraftState('creature-attack-choice', 0);
  const [weaponName, setWeaponName] = usePlayDraftState('pc-weapon', '');
  const clearScope = useClearPlayDraftScope();
  const pcPanel = useRef<HTMLDivElement>(null);
  const enemyPanel = useRef<HTMLDivElement>(null);
  const open = (next: CombatSide) => {
    setSide(next);
    requestAnimationFrame(() => {
      const panel = next === 'pc' ? pcPanel.current : enemyPanel.current;
      const input = panel?.querySelector<HTMLInputElement>(next === 'pc' ? 'input[data-play-roll-field]:enabled' : 'input:enabled');
      input?.focus({ preventScroll: true });
      (input ?? panel)?.scrollIntoView({ block: 'center' });
    });
  };
  useImperativeHandle(ref, () => ({ openEnemyAction: () => open('enemy'), openPcAttack: () => open('pc') }));
  const adjustment = calculateCreatureAdaptation(creature, readCreatureLevel(levelText));
  const { value: combatSkill, unknown: unknownCS } = adjustment.stats.combatSkill;
  const action = creatureActionTable(creature, entry);
  const selectedAction = actionValue === null ? undefined : creature.actions.find(({ min, max }) => min <= actionValue && actionValue <= max);
  const selectedActionText = actionValue === null ? undefined : action.rows.find(({ min, max }) => min <= actionValue && actionValue <= max)?.ko;
  const actionScope = `action-follow-up-${actionRevision}`;
  // The rolled action decides how the creature attacks: its damage dice and type carry into the PC's damage.
  const attackOptions = selectedAction ? creatureAttackDamage(creature, selectedAction) : [];
  const chosenAttack = attackOptions[Math.min(attackChoice, attackOptions.length - 1)];
  const penetration = creaturePenetration(creature);
  const incoming: IncomingAttack | undefined = selectedAction && chosenAttack && {
    name: selectedAction.name, when: chosenAttack.when, armorIgnore: penetration,
    ...creatureAttackPool(chosenAttack, adjustment.damageBonuses),
  };
  // The PC's attack: the weapon carried for the main weapon Skill, or bare hands for Unarmed Combat (Core p.81).
  const weapon = attackWeapon(weapons, weaponName, player?.character.weapon);
  const outgoing: IncomingAttack | undefined = weapon ? {
    name: weapon.name, when: weapon.damageNotes.join(' · ') || undefined, armorIgnore: 0, bonuses: [],
    dice: weapon.damageBonus ? `D6+${weapon.damageBonus}` : 'D6', mod: weapon.damageBonus, type: weapon.type,
  } : player?.character.weapon === 'Unarmed Combat & Fist Weapons'
    ? { name: '맨손', armorIgnore: 0, bonuses: [], dice: 'D4', mod: 0, type: 'Bludgeoning' } : undefined;
  const hitTable = creatureHitTable(creature, entry, adjustment.armorBonuses);
  const unlocatedArmor = creatureHitImpact(creature, null, adjustment.armorBonuses).armor;
  const combatName = targetName ?? creature.name;
  const spoils = creatureSpoilsTables(creature);
  const kind = creature.group === 'overseer' ? 'Overseer' : creature.group === 'overseer-summon' ? 'Overseer 소환수' : creature.group === 'minion' ? 'Mastery 소환수' : '일반 생물';
  const ruthlessness = creature.traits.map((trait) => /^Ruthlessness \((\d+)\)$/i.exec(trait)).find(Boolean);
  const defenses = creatureDefenses(creature);
  const outcome = (enemyAttacks: boolean) => ({ result, exchangeId }: { result: PhysicalAttackResult; exchangeId: string }) => (
    <PlayDraftScope name={`exchange-${exchangeId}`} key={exchangeId}>
      <AttackOutcome result={result} exchangeId={exchangeId} enemyAttacks={enemyAttacks} targetName={combatName}
        hitTable={enemyAttacks ? PC_HIT_TABLE : hitTable} fixedHit={entry.stats?.['Hit Location']}
        hitImpact={(label) => creatureHitImpact(creature, label, adjustment.armorBonuses)}
        unlocatedArmor={unlocatedArmor} defenses={defenses} attack={enemyAttacks ? incoming : outgoing} />
    </PlayDraftScope>
  );
  const attacker = { name: combatName, combatSkill: unknownCS ? null : combatSkill };

  return (
    <section className="creature-combat" aria-label="전투 카드">
      <header className="creature-combat-head">
        <h2>전투 카드</h2>
        <span>{kind} · {creature.types.map((type) => TYPE_KO[type] ?? type).join(' · ')}</span>
        {discovery && <XRef id={entry.id}>도감 전체 보기</XRef>}
      </header>
      <CreatureAdaptation creature={creature} levelText={levelText} onLevelChange={setLevelText} />
      <dl className="creature-combat-meta">
        <div><dt>개체 수</dt><dd>{creature.number}</dd></div>
        <div><dt>Armor</dt><dd>{armorKo(creature.armor)}</dd></div>
        <div><dt>명중 부위</dt><dd>{entry.stats?.['Hit Location']}</dd></div>
        {ruthlessness && <div><dt>라운드당 턴</dt><dd>{Number(ruthlessness[1]) + 1} <XRef id="ruthlessness">{ruthlessness[0]}</XRef></dd></div>}
      </dl>
      <CreatureDefenseSummary defenses={defenses} />
      <CreatureDamageGuide defenses={defenses} />
      <CreatureTraitSummary traits={ruthlessness ? [...defenses.otherTraits, ruthlessness[0]] : defenses.otherTraits} />
      {showEncounterStart && <TogglePanel className="creature-encounter" label="조우 시작">
        <EncounterStart creature={creature} />
      </TogglePanel>}
      <div className="creature-roll-tools">
        <div className="seg creature-side" role="group" aria-label="공격하는 쪽">
          <button type="button" aria-controls={enemyPane} aria-pressed={side === 'enemy'} data-play-attack-side="enemy-attack"
            onClick={() => setSide('enemy')}>적 행동 {action.dice}</button>
          <button type="button" aria-controls={pcPane} aria-pressed={side === 'pc'} data-play-attack-side="pc-attack"
            onClick={() => setSide('pc')}>PC 공격</button>
        </div>
        <div id={enemyPane} ref={enemyPanel} className="creature-flow" hidden={side !== 'enemy'}>
          {discovery && <div className="creature-action-discovery">
            {!actionsRevealed && <p>주사위를 굴리면 해당 행동과 필요한 판정이 열립니다.</p>}
            <button className="btn ghost" type="button" aria-expanded={actionsRevealed}
              onClick={() => setActionsRevealed(!actionsRevealed)}>
              {actionsRevealed ? '행동표 숨기기' : '전체 행동표 공개'}
            </button>
          </div>}
          <OracleBody t={action} value={actionValue} onValue={(value) => {
            clearScope(actionScope);
            setActionRevision((revision) => revision + 1);
            setAttackChoice(0);
            setActionValue(value);
          }} compact collapseTableBeforeRoll
            tableDisclosure={discovery ? actionsRevealed ? 'revealed' : 'hidden' : undefined}
            rollLabel={`${action.dice} 굴리기`} sourceForRow={(row) => row.label ? creatureActionSource(creature.id, row.label) : undefined} />
          {selectedAction && (
            <PlayDraftScope name={actionScope} key={actionScope}>
              {allowApplyingConditions && selectedActionText && <ApplyConditions text={selectedActionText} />}
              {selectedAction.tag !== 'Physical' && <CreatureActionResolution action={selectedAction} rule={creatureActionRule(creature, selectedAction)} summons={summons}
                damageBonuses={adjustment.damageBonuses} />}
              {incoming && <section className="creature-enemy-attack" aria-label="적 공격">
                {attackOptions.length > 1 && <ChoiceButtons label="공격 방식" value={Math.min(attackChoice, attackOptions.length - 1)}
                  onChange={setAttackChoice} options={attackOptions.map((option, index) => ({
                    value: index, label: `${option.when} · ${formatAttackDamage(creatureAttackPool(option, adjustment.damageBonuses))}`,
                  }))} />}
                <p className="creature-attack-line"><span>공격</span> <b lang="en">{incoming.name}</b>
                  {incoming.when && attackOptions.length === 1 && ` · ${incoming.when}`} · {formatAttackDamage(incoming, penetration)}</p>
                <PlayDraftScope name={`attack-${attackChoice}`} key={attackChoice}>
                  <CheckCalculator attackOnly creature={{ ...attacker, attacking: true, renderOutcome: outcome(true) }} />
                </PlayDraftScope>
              </section>}
            </PlayDraftScope>
          )}
        </div>
        <div id={pcPane} ref={pcPanel} className="creature-flow" hidden={side !== 'pc'}>
          {weapons.length > 1 && <ChoiceButtons label="무기" value={weapon?.name} onChange={setWeaponName}
            options={weapons.map(({ name }) => ({ value: name, label: name }))} />}
          {outgoing && <p className="creature-attack-line"><span>공격</span> <b lang="en">{outgoing.name}</b> · {formatAttackDamage(outgoing)}
            {outgoing.when && ` · ${outgoing.when}`}{weapon?.speed ? ` · Speed ${weapon.speed}` : ''}</p>}
          <PlayDraftScope name="pc-attack">
            <CheckCalculator attackOnly creature={{ ...attacker, attacking: false, renderOutcome: outcome(false),
              weapon: weapon && { name: weapon.name, speed: weapon.speed, attackBonus: weapon.attackBonus, skill: weapon.skill } }} />
          </PlayDraftScope>
        </div>
      </div>
      {/* In play the defensive move and fumble rolls open under the attack itself; the reference page keeps the links. */}
      {showAftermath && <section className="creature-reactions" aria-label="방어 동작과 펌블">
        <h3>방어 동작과 펌블</h3>
        <div className="creature-reaction-links">
          <XRef id="t-defensive-move-pc">PC 방어 동작</XRef>
          <XRef id="t-defensive-move-npc">적 방어 동작</XRef>
          <XRef id="t-fumble-pc">PC 공격자 펌블</XRef>
          <XRef id="t-fumble-npc">적 공격자 펌블</XRef>
        </div>
      </section>}
      {showAftermath && <CreatureAftermath creature={creature} spoils={spoils} />}
      <TogglePanel className="creature-other-stats" label="기타 능력치와 레벨 적응">
        <dl className="creature-combat-meta">
          <div><dt>Mind</dt><dd>{creature.mind}</dd></div>
          <div><dt>Body</dt><dd>{creature.body}</dd></div>
          <div><dt>Endurance</dt><dd>{creature.endurance}</dd></div>
        </dl>
        {creature.levelAdaptation && (
          <div className="creature-adaptation-source">
            <h3>레벨 적응 기준</h3>
            <ul>
              {creature.levelAdaptation.split(/(?=After level \d+:)/i).map((part) => <li key={part}>{part.trim()}</li>)}
            </ul>
          </div>
        )}
      </TogglePanel>
    </section>
  );
}

type HitImpact = { armor: number | null; weak: boolean };

/** What follows one attack exchange, right under its result: hit location and damage, or the defense/fumble roll. */
function AttackOutcome({ result, exchangeId, enemyAttacks, targetName, hitTable, fixedHit, hitImpact, unlocatedArmor, defenses, attack }: {
  result: PhysicalAttackResult;
  exchangeId: string;
  enemyAttacks: boolean;
  targetName: string;
  hitTable?: OracleTable;
  fixedHit?: string;
  hitImpact: (label: string) => HitImpact;
  unlocatedArmor: number | null;
  defenses: ReturnType<typeof creatureDefenses>;
  /** The attack that landed: the creature's action, or the PC's weapon. */
  attack?: IncomingAttack;
}) {
  const [hitValue, setHitValue] = usePlayDraftState<number | null>('hit', null);
  const landed = result.outcome === 'hit' || result.outcome === 'critical-hit';
  const row = hitValue === null ? undefined : hitTable?.rows.find(({ min, max }) => min <= hitValue && hitValue <= max);
  // The PC's armor comes from the paper sheet; a creature's comes from its stat block.
  const impact = enemyAttacks
    ? row && { location: row.ko, armor: null, weak: row.label === 'Head' }
    : row ? { location: row.ko, ...hitImpact(row.label ?? '') } : !hitTable ? { location: '몸통', ...hitImpact('Body') } : undefined;
  const side = enemyAttacks ? 'enemy' : 'pc';
  return (
    <div className="creature-attack-outcome">
      {landed && <>
        <section className="creature-hit-location" aria-label={enemyAttacks ? 'PC 명중 부위' : '적 명중 부위'}>
          <h4>{enemyAttacks ? 'PC' : '적'} 명중 부위{hitTable ? ` ${hitTable.dice}` : ''}</h4>
          {hitTable ? <OracleBody t={hitTable} value={hitValue} onValue={setHitValue} compact collapseTableBeforeRoll play rollLabel={`${hitTable.dice} 굴리기`} />
            : <p className="creature-fixed-hit">{fixedHit}</p>}
        </section>
        <DamageCalculator impact={impact} unlocatedArmor={enemyAttacks ? null : unlocatedArmor} defenses={enemyAttacks ? undefined : defenses}
          initialCritical={result.outcome === 'critical-hit'} pc={enemyAttacks} attack={attack} />
      </>}
      {result.outcome === 'both-failed' && (
        <DamageCalculator unlocatedArmor={null} defenses={enemyAttacks ? undefined : defenses} initialCritical={false}
          pc={enemyAttacks} fixed={BOTH_FAILED_DAMAGE} />
      )}
      {result.outcome === 'defended' && <div className="creature-attack-follow-up">
        <AttackFollowUpRoll kind={enemyAttacks ? 'pc-defense' : 'enemy-defense'} exchangeId={exchangeId} side={side} targetName={targetName} />
        <XRef id={enemyAttacks ? 't-defensive-move-pc' : 't-defensive-move-npc'}>{enemyAttacks ? 'PC' : '적'} 방어 동작</XRef>
      </div>}
      {result.attackerFumble && <div className="creature-attack-follow-up">
        <AttackFollowUpRoll kind={enemyAttacks ? 'enemy-fumble' : 'pc-fumble'} exchangeId={exchangeId} side={side} targetName={targetName} />
        <XRef id={enemyAttacks ? 't-fumble-npc' : 't-fumble-pc'}>{enemyAttacks ? '적' : 'PC'} 공격자 펌블</XRef>
      </div>}
    </div>
  );
}

function CreatureDamageGuide({ defenses }: { defenses: ReturnType<typeof creatureDefenses> }) {
  const [type, setType] = usePlayDraftState<DamageType | ''>('creature-damage-preview', '');
  const [magical, setMagical] = usePlayDraftState('creature-damage-preview-magical', false);
  return (
    <TogglePanel className="creature-damage-guide" label="피해 유형과 대상 반응" badge={type || undefined}>
      <div className="creature-resolution-body">
        <div className="creature-guide-controls">
          <label className="field"><span>공격 전 피해 유형</span>
            <select value={type} onChange={(event) => setType(event.target.value as DamageType | '')}>
              <option value="">유형 선택</option>
              {DAMAGE_TYPES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {defenses.resistsNonMagicalPhysical && type && isPhysicalDamage(type) && (
            <label className="damage-check"><input type="checkbox" checked={magical}
              onChange={(event) => setMagical(event.target.checked)} />마법 피해</label>
          )}
        </div>
        {type && <DamageTypeGuide type={type} reactions={listedDamageReactions(type, magical, defenses)}
          immuneConditions={defenses.immuneConditions} />}
      </div>
    </TogglePanel>
  );
}

function CreatureDefenseSummary({ defenses }: { defenses: ReturnType<typeof creatureDefenses> }) {
  const rows = [
    { key: 'vulnerable', label: '취약 ×2', items: defenses.vulnerable },
    { key: 'resistant', label: '저항 ½', items: defenses.resistsNonMagicalPhysical ? ['비마법 물리 피해'] : [] },
    { key: 'restored', label: '회복', items: defenses.restored },
    { key: 'immune', label: '상태 면역', items: defenses.immuneConditions.map((condition) => titleOf(condition.toLowerCase()).ko) },
  ].filter(({ items }) => items.length > 0);
  if (!rows.length) return null;

  return (
    <section className="creature-defenses" aria-label="피해 반응과 상태 면역">
      <h3><XRef id="vulnerability">피해 반응</XRef></h3>
      <dl>
        {rows.map(({ key, label, items }) => <div key={key} className={key}><dt>{label}</dt><dd>{items.join(' · ')}</dd></div>)}
      </dl>
    </section>
  );
}

function CreatureAftermath({ creature, spoils }: { creature: CreatureRecord; spoils: string[] }) {
  const overseer = creature.group === 'overseer';
  const hasSpoils = spoils.length > 0 || (creature.spoils && !/^[–—-]$/.test(creature.spoils));

  return (
    <section className="creature-aftermath" aria-label="전투 종료">
      <h3>전투 종료</h3>
      <dl className="creature-aftermath-list">
        <div><dt><XRef id="combat-end">회복</XRef></dt><dd>전투가 끝나면 Toughness D4 회복</dd></div>
        <div><dt><XRef id="armor-integrity">방어구 내구도</XRef></dt><dd>이번 전투에서 사용한 방어구의 Integrity 굴림</dd></div>
        <div><dt><XRef id="lingering-damage">지속 피해</XRef></dt><dd>출혈·화상·중독이 남으면 상태마다 방당 Health 1 피해</dd></div>
        {(overseer || creature.group === 'creature') && <div>
          <dt><XRef id={overseer ? 'overseers' : 'leveling-up'}>경험치</XRef></dt>
          <dd>{overseer ? 'Overseer 처치 시 XP +200, Sanity D4 회복' : '일반 전투 조우에서 승리하면 XP +50'}</dd>
        </div>}
      </dl>
      {hasSpoils && (
        <section className="creature-spoils" aria-label="처치 보상">
          <h4>처치 보상</h4>
          {spoils.length > 0 ? (
            <div className="creature-spoils-links">
              {spoils.map((id) => <XRef key={id} id={id} showKind />)}
              {overseer && <XRef id="overseers">Overseer 처치 효과</XRef>}
            </div>
          ) : <p>{creature.spoils}</p>}
        </section>
      )}
    </section>
  );
}
