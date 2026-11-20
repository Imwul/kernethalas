import { useId, useRef } from 'react';
import { tableById, titleOf } from '../content';
import { creatureActionRule } from '../content/creature-action-rules';
import { creatureDefenses } from '../content/creature-defenses';
import { armorKo, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import type { Entry } from '../content/schema';
import { calculateCreatureAdaptation, readCreatureLevel } from '../lib/creature-adaptation';
import { DAMAGE_TYPES, isPhysicalDamage, listedDamageReactions, type DamageType } from '../lib/damage';
import { creatureActionTable, creatureHitImpact, creatureHitTable, creatureSpoilsTables } from '../lib/creature-combat';
import { creatureActionSource } from '../lib/overlay';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../lib/play-draft';
import { OracleBody } from '../views/Oracle';
import { XRef } from './bits';
import { CheckCalculator } from './CheckCalculator';
import { CreatureAdaptation } from './CreatureAdaptation';
import { CreatureActionResolution } from './CreatureActionResolution';
import { CreatureTraitSummary } from './CreatureTraitSummary';
import type { CombatSummonControls } from './CreatureSummonRoll';
import { DamageCalculator } from './DamageCalculator';
import { DamageTypeGuide } from './DamageTypeGuide';
import { EncounterStart } from './EncounterStart';
import '../styles/creature-combat.css';

const PC_HIT_TABLE = tableById.get('t-hit-humanoid')!;

export function CreatureCombatCard({ creature, entry, targetName, summons, showEncounterStart = true }: {
  creature: CreatureRecord;
  entry: Entry;
  targetName?: string;
  summons?: CombatSummonControls;
  showEncounterStart?: boolean;
}) {
  const checkPane = useId();
  const [levelText, setLevelText] = usePlayDraftState('creature-level', '');
  const [mode, setMode] = usePlayDraftState<'action' | 'hit' | 'check' | 'damage'>('creature-mode', 'action');
  const [enemyAttacking, setEnemyAttacking] = usePlayDraftState('creature-attacking', false);
  const [actionValue, setActionValue] = usePlayDraftState<number | null>('creature-action', null);
  const [actionRevision, setActionRevision] = usePlayDraftState('creature-action-revision', 0);
  const clearScope = useClearPlayDraftScope();
  const [hitValue, setHitValue] = usePlayDraftState<number | null>('creature-hit', null);
  const [pcTarget, setPcTarget] = usePlayDraftState('creature-is-pc-target', false);
  const [pcHitValue, setPcHitValue] = usePlayDraftState<number | null>('creature-pc-hit', null);
  const [damageSeed, setDamageSeed] = usePlayDraftState('creature-damage-seed', { attempt: 0, critical: false });
  const [pcDamageSeed, setPcDamageSeed] = usePlayDraftState('creature-pc-damage-seed', { attempt: 0, critical: false });
  const hitTab = useRef<HTMLButtonElement>(null);
  const checkTab = useRef<HTMLButtonElement>(null);
  const damageTab = useRef<HTMLButtonElement>(null);
  const adjustment = calculateCreatureAdaptation(creature, readCreatureLevel(levelText));
  const { value: combatSkill, unknown: unknownCS } = adjustment.stats.combatSkill;
  const action = creatureActionTable(creature, entry);
  const selectedAction = actionValue === null ? undefined : creature.actions.find(({ min, max }) => min <= actionValue && actionValue <= max);
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
  const spoils = creatureSpoilsTables(creature);
  const kind = creature.group === 'overseer' ? 'Overseer' : creature.group === 'overseer-summon' ? 'Overseer 소환수' : creature.group === 'minion' ? 'Mastery 소환수' : '일반 생물';
  const ruthlessness = creature.traits.map((trait) => /^Ruthlessness \((\d+)\)$/i.exec(trait)).find(Boolean);
  const defenses = creatureDefenses(creature);

  return (
    <section className="creature-combat" aria-label="전투 카드">
      <header className="creature-combat-head">
        <h2>전투 카드</h2>
        <span>{kind} · {creature.types.map((type) => TYPE_KO[type] ?? type).join(' · ')}</span>
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
      {showEncounterStart && <details className="fold creature-encounter">
        <summary>조우 시작</summary>
        <EncounterStart creature={creature} />
      </details>}
      <div className="creature-roll-tools">
        <div className="seg" role="group" aria-label="전투 도구">
          <button type="button" aria-pressed={mode === 'action'} onClick={() => setMode('action')}>행동 {action.dice}</button>
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
        <div hidden={mode !== 'action'}>
          <OracleBody t={action} value={actionValue} onValue={(value) => {
            clearScope(actionScope);
            setActionRevision((revision) => revision + 1);
            setActionValue(value);
          }} compact collapseTableBeforeRoll
            rollLabel={`${action.dice} 굴리기`} sourceForRow={(row) => row.label ? creatureActionSource(creature.id, row.label) : undefined} />
          {selectedAction?.tag === 'Physical' && (
            <button type="button" className="btn ghost creature-action-check" onClick={() => {
              setEnemyAttacking(true);
              setMode('check');
              checkTab.current?.focus();
            }}>적 공격 판정</button>
          )}
          {selectedAction && selectedAction.tag !== 'Physical' && (
            <PlayDraftScope name={actionScope} key={actionScope}>
              <CreatureActionResolution action={selectedAction} rule={creatureActionRule(creature, selectedAction)} summons={summons} />
            </PlayDraftScope>
          )}
        </div>
        <div hidden={mode !== 'hit'}>
          <div hidden={pcTarget}>
            {hit ? <OracleBody t={hit} value={hitValue} onValue={setHitValue} compact collapseTableBeforeRoll rollLabel={`${hit.dice} 굴리기`} />
              : <p className="creature-fixed-hit">{entry.stats?.['Hit Location']}</p>}
          </div>
          <div hidden={!pcTarget}>
            <OracleBody t={PC_HIT_TABLE} value={pcHitValue} onValue={setPcHitValue} compact collapseTableBeforeRoll rollLabel="D20 굴리기" />
          </div>
          {(pcTarget ? pcImpact : impact) && (
            <button type="button" className="btn ghost creature-action-check" onClick={() => {
              setMode('damage');
              damageTab.current?.focus();
            }}>이 부위로 피해 계산</button>
          )}
        </div>
        <div id={checkPane} hidden={mode !== 'check'}>
          <CheckCalculator attackOnly creature={{
            name: targetName ?? creature.name,
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
            onHitLocation: (critical, pc) => {
              setPcTarget(pc);
              if (pc) {
                setPcDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical }));
                setPcHitValue(null);
              } else {
                setDamageSeed(({ attempt }) => ({ attempt: attempt + 1, critical }));
                setHitValue(null);
              }
              setMode('hit');
              hitTab.current?.focus();
            },
          }} />
        </div>
        <div hidden={mode !== 'damage' || pcTarget}>
          <PlayDraftScope name={damageKey} key={damageKey}>
            <DamageCalculator impact={impact} unlocatedArmor={unlocatedArmor} defenses={defenses} initialCritical={damageSeed.critical} />
          </PlayDraftScope>
        </div>
        <div hidden={mode !== 'damage' || !pcTarget}>
          <PlayDraftScope name={pcDamageKey} key={pcDamageKey}>
            <DamageCalculator impact={pcImpact} unlocatedArmor={null} initialCritical={pcDamageSeed.critical} pc />
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
      <CreatureAftermath creature={creature} spoils={spoils} />
      <details className="fold creature-other-stats">
        <summary>기타 능력치와 레벨 적응</summary>
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
      </details>
    </section>
  );
}

function CreatureDamageGuide({ defenses }: { defenses: ReturnType<typeof creatureDefenses> }) {
  const [type, setType] = usePlayDraftState<DamageType | ''>('creature-damage-preview', '');
  const [magical, setMagical] = usePlayDraftState('creature-damage-preview-magical', false);
  return (
    <details className="fold creature-damage-guide">
      <summary>피해 유형과 대상 반응</summary>
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
    </details>
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
