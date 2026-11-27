import { useContext, useId, useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import { tableById, titleOf } from '../content';
import { creatureActionRule } from '../content/creature-action-rules';
import { creatureDefenses } from '../content/creature-defenses';
import { armorKo, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import type { Entry } from '../content/schema';
import { isCombatDamageRecord } from '../lib/combat-damage-records';
import { calculateCreatureAdaptation, readCreatureLevel } from '../lib/creature-adaptation';
import { DAMAGE_TYPES, isPhysicalDamage, listedDamageReactions, type DamageType } from '../lib/damage';
import { creatureActionTable, creatureHitImpact, creatureHitTable, creatureSpoilsTables } from '../lib/creature-combat';
import { creatureActionSource } from '../lib/overlay';
import { usePlayCharacter } from '../lib/play-character';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraft, usePlayDraftScope, usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { playAction } from '../lib/play-roll-history';
import { OracleBody } from '../views/Oracle';
import { TogglePanel } from './TogglePanel';
import { XRef } from './bits';
import { CheckCalculator } from './CheckCalculator';
import { CreatureAdaptation } from './CreatureAdaptation';
import { CreatureActionResolution } from './CreatureActionResolution';
import { CreatureTraitSummary } from './CreatureTraitSummary';
import type { CombatSummonControls } from './CreatureSummonRoll';
import { DamageCalculator } from './DamageCalculator';
import { DamageTypeGuide } from './DamageTypeGuide';
import { EncounterStart } from './EncounterStart';
import { ApplyConditions } from './play/PlayLingering';
import { PlayDiscoveryMode } from './play/PlayDiscovery';
import '../styles/creature-combat.css';

const PC_HIT_TABLE = tableById.get('t-hit-humanoid')!;
type DamageSeed = { attempt: number; critical: boolean; exchangeId?: string };

export type CreatureCombatHandle = { openPcAttack: () => void };

export function CreatureCombatCard({ creature, entry, targetName, summons, showEncounterStart = true, showAftermath = true, allowApplyingConditions = true, ref }: {
  creature: CreatureRecord;
  entry: Entry;
  targetName?: string;
  summons?: CombatSummonControls;
  showEncounterStart?: boolean;
  /** Play mode handles the end of a fight in its wrap-up stage. */
  showAftermath?: boolean;
  allowApplyingConditions?: boolean;
  ref?: Ref<CreatureCombatHandle>;
}) {
  const checkPane = useId();
  const actionPane = `${checkPane}-action`;
  const discovery = useContext(PlayDiscoveryMode) && !showAftermath;
  const [actionsRevealed, setActionsRevealed] = usePlayDraftState('creature-actions-revealed', false);
  const [typedLevel, setLevelText] = usePlayDraftState('creature-level', '');
  const player = usePlayCharacter();
  const sheetLevel = player?.level ?? '';
  const levelText = typedLevel || sheetLevel;
  const [mode, setMode] = usePlayDraftState<'action' | 'hit' | 'check' | 'damage'>('creature-mode', 'action');
  const [enemyAttacking, setEnemyAttacking] = usePlayDraftState('creature-attacking', false);
  const [actionValue, setActionValue] = usePlayDraftState<number | null>('creature-action', null);
  const [actionRevision, setActionRevision] = usePlayDraftState('creature-action-revision', 0);
  const clearScope = useClearPlayDraftScope();
  const [hitValue, setHitValue] = usePlayDraftState<number | null>('creature-hit', null);
  const [pcTarget, setPcTarget] = usePlayDraftState('creature-is-pc-target', false);
  const [pcHitValue, setPcHitValue] = usePlayDraftState<number | null>('creature-pc-hit', null);
  const [damageSeed, setDamageSeed] = usePlayDraftState<DamageSeed>('creature-damage-seed', { attempt: 0, critical: false });
  const [pcDamageSeed, setPcDamageSeed] = usePlayDraftState<DamageSeed>('creature-pc-damage-seed', { attempt: 0, critical: false });
  const draft = usePlayDraft();
  const scope = usePlayDraftScope();
  const commit = usePlayRoll();
  const hitTab = useRef<HTMLButtonElement>(null);
  const hitPanel = useRef<HTMLDivElement>(null);
  const focusHitInput = useRef(false);
  const checkTab = useRef<HTMLButtonElement>(null);
  const checkPanel = useRef<HTMLDivElement>(null);
  const damageTab = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({ openPcAttack() {
    setEnemyAttacking(false);
    setMode('check');
    requestAnimationFrame(() => {
      const input = checkPanel.current?.querySelector<HTMLInputElement>('input[data-play-roll-field]:enabled');
      const focus = input ?? checkTab.current;
      focus?.focus({ preventScroll: true });
      focus?.scrollIntoView({ block: 'center' });
    });
  } }), [setEnemyAttacking, setMode]);
  const adjustment = calculateCreatureAdaptation(creature, readCreatureLevel(levelText));
  const { value: combatSkill, unknown: unknownCS } = adjustment.stats.combatSkill;
  const action = creatureActionTable(creature, entry);
  const selectedAction = actionValue === null ? undefined : creature.actions.find(({ min, max }) => min <= actionValue && actionValue <= max);
  const selectedActionText = actionValue === null ? undefined : action.rows.find(({ min, max }) => min <= actionValue && actionValue <= max)?.ko;
  const actionScope = `action-follow-up-${actionRevision}`;
  const hit = creatureHitTable(creature, entry, adjustment.armorBonuses);
  const hitDie = (pcTarget ? PC_HIT_TABLE : hit)?.dice;
  const hitRow = hitValue === null ? undefined : hit?.rows.find(({ min, max }) => min <= hitValue && hitValue <= max);
  const impact = hitRow ? { location: hitRow.ko, ...creatureHitImpact(creature, hitRow.label ?? '', adjustment.armorBonuses) }
    : !hit ? { location: '몸통', ...creatureHitImpact(creature, 'Body', adjustment.armorBonuses) } : undefined;
  const unlocatedArmor = creatureHitImpact(creature, null, adjustment.armorBonuses).armor;
  const pcHit = pcHitValue === null ? undefined : PC_HIT_TABLE.rows.find(({ min, max }) => min <= pcHitValue && pcHitValue <= max);
  const pcImpact = pcHit ? { location: pcHit.ko, armor: null, weak: pcHit.label === 'Head' } : undefined;
  const damageKey = `outgoing-${damageSeed.attempt}-${impact?.location ?? ''}`;
  const pcDamageKey = `incoming-${pcDamageSeed.attempt}-${pcImpact?.location ?? ''}`;
  const damageSlot = `${scope}damage-record:enemy:${damageSeed.exchangeId ?? damageSeed.attempt}`;
  const pcDamageSlot = `${scope}damage-record:pc:${pcDamageSeed.exchangeId ?? pcDamageSeed.attempt}`;
  const combatName = targetName ?? creature.name;
  const recordHit = (roll: number | null, pc: boolean) => {
    const slot = pc ? pcDamageSlot : damageSlot;
    const previous = pc ? pcHitValue : hitValue;
    const setHit = pc ? setPcHitValue : setHitValue;
    if (draft && !showAftermath && allowApplyingConditions && roll !== previous && isCombatDamageRecord(draft.slots[slot])) {
      commit(() => {
        draft.write(draft.generation, slot, null, null);
        setHit(roll);
      }, playAction('명중 부위와 피해 기록 수정'));
    } else setHit(roll);
  };
  const spoils = creatureSpoilsTables(creature);
  const kind = creature.group === 'overseer' ? 'Overseer' : creature.group === 'overseer-summon' ? 'Overseer 소환수' : creature.group === 'minion' ? 'Mastery 소환수' : '일반 생물';
  const ruthlessness = creature.traits.map((trait) => /^Ruthlessness \((\d+)\)$/i.exec(trait)).find(Boolean);
  const defenses = creatureDefenses(creature);

  useLayoutEffect(() => {
    if (mode !== 'hit' || !focusHitInput.current) return;
    const frame = requestAnimationFrame(() => {
      focusHitInput.current = false;
      const target = hitPanel.current?.querySelector<HTMLInputElement>(':scope > :not([hidden]) input[data-play-dice]') ?? hitTab.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [mode, pcTarget]);

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
        <div className="seg" role="group" aria-label="전투 도구">
          <button type="button" aria-controls={actionPane} aria-pressed={mode === 'action'} onClick={() => setMode('action')}>행동 {action.dice}</button>
          <button type="button" ref={hitTab} aria-pressed={mode === 'hit'} onClick={() => setMode('hit')}>명중 부위{hitDie ? ` ${hitDie}` : ''}</button>
          <button type="button" ref={checkTab} aria-controls={checkPane} aria-pressed={mode === 'check'} onClick={() => setMode('check')}>공격 판정</button>
          <button type="button" ref={damageTab} aria-pressed={mode === 'damage'} onClick={() => setMode('damage')}>피해 계산</button>
        </div>
        {(mode === 'hit' || mode === 'damage') && (
          <div className="creature-target">
            <span aria-hidden="true">피해를 받는 쪽</span>
            <div className="seg" role="group" aria-label="피해를 받는 쪽">
              <button type="button" aria-pressed={!pcTarget} onClick={() => setPcTarget(false)}>몬스터</button>
              <button type="button" aria-pressed={pcTarget} onClick={() => setPcTarget(true)}>PC</button>
            </div>
          </div>
        )}
        <div id={actionPane} hidden={mode !== 'action'}>
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
            setActionValue(value);
          }} compact collapseTableBeforeRoll
            tableDisclosure={discovery ? actionsRevealed ? 'revealed' : 'hidden' : undefined}
            rollLabel={`${action.dice} 굴리기`} sourceForRow={(row) => row.label ? creatureActionSource(creature.id, row.label) : undefined} />
          {selectedAction?.tag === 'Physical' && (
            <button type="button" className="btn ghost creature-action-check" onClick={() => {
              setEnemyAttacking(true);
              setMode('check');
              checkTab.current?.focus();
            }}>적 공격 판정</button>
          )}
          {selectedAction && (
            <PlayDraftScope name={actionScope} key={actionScope}>
              {allowApplyingConditions && selectedActionText && <ApplyConditions text={selectedActionText} />}
              {selectedAction.tag !== 'Physical' && <CreatureActionResolution action={selectedAction} rule={creatureActionRule(creature, selectedAction)} summons={summons} />}
            </PlayDraftScope>
          )}
        </div>
        <div ref={hitPanel} hidden={mode !== 'hit'}>
          <div hidden={pcTarget}>
            {hit ? <OracleBody t={hit} value={hitValue} onValue={(roll) => recordHit(roll, false)} compact collapseTableBeforeRoll rollLabel={`${hit.dice} 굴리기`} />
              : <p className="creature-fixed-hit">{entry.stats?.['Hit Location']}</p>}
          </div>
          <div hidden={!pcTarget}>
            <OracleBody t={PC_HIT_TABLE} value={pcHitValue} onValue={(roll) => recordHit(roll, true)} compact collapseTableBeforeRoll rollLabel="D20 굴리기" />
          </div>
          {(pcTarget ? pcImpact : impact) && (
            <button type="button" className="btn ghost creature-action-check" onClick={() => {
              setMode('damage');
              damageTab.current?.focus();
            }}>이 부위로 피해 계산</button>
          )}
        </div>
        <div id={checkPane} ref={checkPanel} hidden={mode !== 'check'}>
          <CheckCalculator attackOnly creature={{
            name: combatName,
            combatSkill: unknownCS ? null : combatSkill,
            attacking: enemyAttacking,
            onChangeAttacker: setEnemyAttacking,
            onNextAttack: (pc) => {
              if (pc) {
                setPcHitValue(null);
                setPcDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical: false }));
              } else {
                setHitValue(null);
                setDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical: false }));
              }
            },
            onHitLocation: (critical, pc, exchangeId) => {
              setPcTarget(pc);
              const seed = pc ? pcDamageSeed : damageSeed;
              const replay = exchangeId && seed.exchangeId === exchangeId;
              if (pc) {
                if (!replay) {
                  setPcDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical, exchangeId }));
                  setPcHitValue(null);
                }
              } else {
                if (!replay) {
                  setDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical, exchangeId }));
                  setHitValue(null);
                }
              }
              focusHitInput.current = true;
              setMode('hit');
            },
          }} />
        </div>
        <div hidden={mode !== 'damage' || pcTarget}>
          <PlayDraftScope name={damageKey} key={damageKey}>
            <DamageCalculator impact={impact} unlocatedArmor={unlocatedArmor} defenses={defenses} initialCritical={damageSeed.critical}
              paper={!showAftermath ? { slot: damageSlot, target: combatName, editable: allowApplyingConditions } : undefined} />
          </PlayDraftScope>
        </div>
        <div hidden={mode !== 'damage' || !pcTarget}>
          <PlayDraftScope name={pcDamageKey} key={pcDamageKey}>
            <DamageCalculator impact={pcImpact} unlocatedArmor={null} initialCritical={pcDamageSeed.critical} pc
              paper={!showAftermath ? { slot: pcDamageSlot, target: player?.character.name || 'PC', source: combatName, editable: allowApplyingConditions } : undefined} />
          </PlayDraftScope>
        </div>
      </div>
      <section className="creature-reactions" aria-label="방어 동작과 펌블">
        <h3>방어 동작과 펌블</h3>
        <div className="creature-reaction-links">
          <XRef id="t-defensive-move-pc">PC 방어 동작</XRef>
          <XRef id="t-defensive-move-npc">적 방어 동작</XRef>
          <XRef id="t-fumble-pc">PC 공격자 펌블</XRef>
          <XRef id="t-fumble-npc">적 공격자 펌블</XRef>
        </div>
      </section>
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
