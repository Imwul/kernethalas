import { useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { entryById, tableById } from '../../content';
import { creatureById, type CreatureRecord } from '../../content/entries/creatures';
import type { OracleTable } from '../../content/schema';
import type { EncounterSet } from '../../lib/custom-encounters';
import { rollDie, tableSides } from '../../lib/dice';
import { encounterInteger } from '../../lib/encounter-start';
import { automaticRollSides, readOracleValue, rollTable } from '../../lib/oracle';
import { combatToolsScope } from '../../lib/play-combat-timing';
import { PlayDraftScope, usePlayDraftState, usePlayRoll, usePlayRollField, usePlayRollInput } from '../../lib/play-draft';
import { USE_ABILITY_EVENT } from './PlayCharacter';
import { CombatLingeringAlert } from './PlayLingering';
import type { GearItem, PaperChange } from '../../lib/play-inventory';
import type { PcWeapon } from '../../lib/play-weapons';
import { AttackFollowUpProvider } from '../AttackFollowUps';
import { CreatureCombatCard, type CreatureCombatHandle } from '../CreatureCombatCard';
import { EncounterStart } from '../EncounterStart';
import { XRef } from '../bits';
import { PlayCreatureSearch } from './PlayCreatureSearch';
import { PlayBestiaryAdd } from './PlayBestiaryAdd';
import { EncounterLibraryControls, PlayCustomEncounterEditor } from './PlayCustomEncounter';
import { PlayDamageComparison } from './PlayDamageComparison';
import { PlayDiscoveryMode } from './PlayDiscovery';
import { PlayFlee } from './PlayFlee';
import { PlayMastery } from './PlayMastery';
import { PlayStrip, PlayStripPane, stripPaneId, type StripItem } from './PlayPanels';
import { PlayTargetAllocation } from './PlayTargetAllocation';
import { PlayTurnSummary } from './PlayTurnSummary';
import '../../styles/play-combat.css';
import { RollButton } from '../RollButton';
import { ChoiceButtons, type Choice } from '../ChoiceButtons';

type EncounterTable = 't-encounter-a' | 't-encounter-b' | 't-overseer';
type EncounterMethod = 'encounter' | EncounterTable | 'search' | 'custom';
type CombatTargetStatus = 'defeated' | 'left';
type CombatTool = 'start' | 'allocation' | 'compare' | 'flee' | 'mastery';

interface Target {
  id: string;
  creatureId: string;
  source: string;
  ordinal?: number;
  status?: CombatTargetStatus;
}

export type DefeatedCombatTarget = { creatureId: string; label: string };
export type FinishedCombatOutcome = 'victory' | 'ended';
type CombatRewards = { xp: number; lootRolls: number; sanityRolls: number };
export type CombatOutcomePreview = { before: CombatRewards; after: CombatRewards; affected: { text: string; posted: boolean }[] };

interface CombatLineup {
  targets: Target[];
  activeId: string | null;
  encounterId: string | null;
}

const ENCOUNTER_TABLES = {
  't-encounter-a': '조우 표 A',
  't-encounter-b': '조우 표 B',
  't-overseer': 'Overseer',
} as const satisfies Record<EncounterTable, string>;
const TABLE_CHOICE = tableById.get('t-encounter-general')!;
const EMPTY_LINEUP: CombatLineup = { targets: [], activeId: null, encounterId: null };

function isEncounterTable(id: string): id is EncounterTable {
  return Object.hasOwn(ENCOUNTER_TABLES, id);
}

function newTarget(creatureId: string, source: string): Target {
  return { id: crypto.randomUUID(), creatureId, source };
}

function resultRow(table: OracleTable, roll: number) {
  return table.rows.find(({ min, max }) => min <= roll && roll <= max);
}

function appendTarget(lineup: CombatLineup, target: Target): CombatLineup {
  const sameSpecies = lineup.targets.filter(({ creatureId }) => creatureId === target.creatureId);
  const ordinal = sameSpecies.length ? Math.max(...sameSpecies.map((member) => member.ordinal ?? 1)) + 1 : undefined;
  const targets = lineup.targets.map((current) => current.creatureId === target.creatureId && current.ordinal === undefined
    ? { ...current, ordinal: 1 } : current);
  return {
    targets: [...targets, { ...target, ordinal }],
    activeId: target.id,
    encounterId: lineup.encounterId ?? target.id,
  };
}

interface EncounterRollProps {
  table?: OracleTable;
  customSetId?: string;
  completed?: boolean;
  submitLabel: string;
  onResult: (value: number) => (() => void) | null;
}

const ENCOUNTER_METHODS: readonly Choice<EncounterMethod>[] = [
  { value: 'encounter', label: '일반 조우 · D6로 A/B' },
  { value: 't-encounter-a', label: '조우 표 A · D20' },
  { value: 't-encounter-b', label: '조우 표 B · D20' },
  { value: 't-overseer', label: 'Overseer · D10' },
  { value: 'search', label: '생물 이름으로 찾기' },
  { value: 'custom', label: '사용자 지정 조우표 · D20' },
];

function EncounterRoll({ table, customSetId, completed = false, submitLabel, onResult }: EncounterRollProps) {
  const inputId = useId();
  const fieldKey = `encounter-roll-${table?.id ?? customSetId}`;
  const [manual, setManual] = usePlayRollInput(fieldKey);
  const [error, setError] = useState('');
  const commitRoll = usePlayRoll();
  const dice = table?.dice ?? 'D20';
  const sides = tableSides(dice);
  const label = table?.ko ?? '사용자 지정 조우표';
  const field = usePlayRollField(fieldKey, label, dice, completed && !manual);

  const apply = (value: number | null, source: 'manual' | 'app') => {
    if (value === null) {
      setError(`1에서 ${sides} 사이의 정수를 입력하세요.`);
      return;
    }
    const commit = onResult(value);
    if (!commit) {
      setError('이 값에 해당하는 결과를 표에서 확인하세요.');
      return;
    }
    commitRoll(commit, { label, dice, value: String(value), source, field: field['data-play-roll-field'] });
    setError('');
    setManual('');
  };

  return (
    <form className="play-combat-roll" data-play-roll noValidate onSubmit={(event) => {
      event.preventDefault();
      apply(readOracleValue(manual.trim(), sides), 'manual');
    }}>
      <div className="field">
        <label htmlFor={inputId}>{dice} 결과</label>
        <input id={inputId} {...field} inputMode="numeric" autoComplete="off" placeholder={`1–${sides}`}
          value={manual} onChange={(event) => {
            setManual(event.target.value);
            if (error) setError('');
          }} aria-invalid={!!error || undefined} aria-describedby={error ? `${inputId}-error` : undefined} />
      </div>
      <button type="submit" className="btn ghost">{submitLabel}</button>
      {(!table || automaticRollSides(table) !== null) && (
        <RollButton onClick={() => apply(table ? rollTable(table) : rollDie(20), 'app')}>{dice} 굴리기</RollButton>
      )}
      {error && <p className="field-err" id={`${inputId}-error`} role="alert">{error}</p>}
    </form>
  );
}

interface PlayCombatProps {
  initialKind?: 'encounter' | 'overseer';
  domainOverseer?: CreatureRecord | null;
  domainOverseerKnown?: boolean;
  onRevealDomainOverseer?: () => void;
  onCreatureChange: (creature: CreatureRecord | null) => void;
  onTargetsChange?: (names: string[]) => void;
  onBattleEnd: (creature: CreatureRecord, outcome: FinishedCombatOutcome, creatures: CreatureRecord[], defeated?: DefeatedCombatTarget[], edit?: boolean) => void;
  currentOutcome?: FinishedCombatOutcome;
  onPreviewBattleEnd?: (outcome: FinishedCombatOutcome, creatures: CreatureRecord[], defeated?: DefeatedCombatTarget[]) => CombatOutcomePreview;
  onNewEncounter?: () => void;
  onFlee: (remaining: CreatureRecord[], allParticipants?: CreatureRecord[]) => void;
  fled?: boolean;
  finished?: boolean;
  seed?: EncounterSeed;
  bestiaryCreatureId?: string | null;
  onCloseBestiaryRequest: () => void;
  customSets: EncounterSet[];
  customSetId?: string;
  onCustomSetSelect: (id: string) => void;
  onCustomSetsChange: (sets: EncounterSet[]) => void;
  onMasterySheetChange?: (items: PaperChange[]) => void;
  onMasteryJournalChange?: (line: string) => void;
  belt?: readonly GearItem[];
  onOpenBelt?: () => void;
  /** Weapons in the gear ledger: the PC's attack takes its damage type, Speed and traits from one of them. */
  weapons?: readonly PcWeapon[];
}

export type EncounterSeed = { creatureIds: string[]; description: string };

function restoredLineup(seed: EncounterSeed | undefined) {
  if (!seed) return EMPTY_LINEUP;
  return seed.creatureIds.reduce((lineup, creatureId, index) => appendTarget(lineup, {
    id: `initial-${index + 1}`, creatureId, source: seed.description,
  }), EMPTY_LINEUP);
}

export function PlayCombat({ initialKind = 'encounter', domainOverseer, domainOverseerKnown, onRevealDomainOverseer, onCreatureChange, onTargetsChange, onBattleEnd, onFlee, fled, finished,
  seed, bestiaryCreatureId, onCloseBestiaryRequest, customSets, customSetId, onCustomSetSelect, onCustomSetsChange, onMasterySheetChange,
  onMasteryJournalChange, currentOutcome, onPreviewBattleEnd, onNewEncounter, belt = [], onOpenBelt, weapons = [] }: PlayCombatProps) {
  const discovery = useContext(PlayDiscoveryMode);
  const addTargetId = useId();
  const [method, setMethod] = usePlayDraftState<EncounterMethod>('method', initialKind === 'overseer' ? 't-overseer' : 'encounter');
  const [choice, setChoice] = usePlayDraftState<{ table: EncounterTable; roll: number } | null>('table-choice', null);
  const [lineup, setLineup] = usePlayDraftState('lineup', restoredLineup(seed));
  const [customGap, setCustomGap] = usePlayDraftState<number | null>('custom-gap', null);
  const [addingTarget, setAddingTarget] = useState(false);
  const [toolPanes, setToolPanes] = usePlayDraftState<Record<string, CombatTool | null>>('tool-panes', {});
  const [startOrder, setStartOrder] = usePlayDraftState<Record<string, string>>('start-order', {});
  const toolStrip = useId();
  const selectedCard = useRef<CreatureCombatHandle>(null);
  const methodInput = useRef<HTMLButtonElement>(null);
  const combatHeading = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<'method' | 'target' | null>(null);
  const tableId = method === 'encounter' ? choice?.table : isEncounterTable(method) ? method : undefined;
  const table = tableId ? tableById.get(tableId) : undefined;
  const customSet = customSets.find(({ id }) => id === customSetId) ?? customSets[0];
  const requestedCreature = bestiaryCreatureId ? creatureById.get(bestiaryCreatureId) : undefined;

  const targets = useMemo(() => lineup.targets.flatMap((target) => {
    const creature = creatureById.get(target.creatureId);
    if (!creature) return [];
    const label = target.ordinal ? `${creature.name} ${target.ordinal}` : creature.name;
    return [{ ...target, creature, label }];
  }), [lineup.targets]);
  const primary = targets[0]?.creature ?? null;
  const selected = targets.find(({ id }) => id === lineup.activeId) ?? targets[0];
  const activeTargets = targets.filter(({ status }) => !status);
  const tracksDefeats = activeTargets.length < targets.length;
  const defeatedTargets = tracksDefeats ? targets.flatMap(({ status, creatureId, label }) =>
    status === 'defeated' ? [{ creatureId, label }] : []) : undefined;
  const targetIds = targets.map(({ id }) => id).join('/');
  const names = useMemo(() => targets.map(({ label }) => label), [targets]);
  const profile = primary && {
    ...targets.reduce((highest, { creature }) => (encounterInteger(creature.mind) ?? -Infinity) > (encounterInteger(highest.mind) ?? -Infinity)
      ? creature : highest, primary),
    traits: [...new Set(targets.flatMap(({ creature }) => creature.traits))],
  };

  // Each encounter opens on its start step (initiative or surprise); later choices are remembered per encounter.
  const toolKey = selected ? lineup.encounterId ?? 'encounter' : 'lookup';
  const roundScope = combatToolsScope(lineup.encounterId);
  const tool: CombatTool | null = Object.hasOwn(toolPanes, toolKey) ? toolPanes[toolKey] : selected ? 'start' : null;
  const setTool = (next: CombatTool | null) => setToolPanes((previous) => ({ ...previous, [toolKey]: next }));
  const openTool = (next: CombatTool) => {
    setTool(next);
    requestAnimationFrame(() => {
      const pane = document.getElementById(stripPaneId(toolStrip, next));
      const first = [...(pane?.querySelectorAll<HTMLElement>('button:enabled, select:enabled, input:enabled, a[href]') ?? [])]
        .find((control) => control.getClientRects().length > 0);
      first?.focus({ preventScroll: true });
      (first ?? pane)?.scrollIntoView({ block: 'center' });
    });
  };
  useEffect(() => {
    // "전투에서 쓰기" on the character tab's tree opens this fight's Mastery pane.
    const open = () => setToolPanes((previous) => ({ ...previous, [toolKey]: 'mastery' }));
    document.addEventListener(USE_ABILITY_EVENT, open);
    return () => document.removeEventListener(USE_ABILITY_EVENT, open);
  }, [setToolPanes, toolKey]);
  const order = startOrder[toolKey];
  // Once the turn order is settled the start step folds away (once per encounter), so the enemy card's turn tools sit right under the lineup.
  const settleStart = useCallback((summary: string | null, fold: boolean) => {
    setStartOrder((previous) => {
      if ((previous[toolKey] ?? null) === summary) return previous;
      const next = { ...previous };
      if (summary) next[toolKey] = summary;
      else delete next[toolKey];
      return next;
    });
    if (summary && fold) setToolPanes((previous) => previous[`${toolKey}:settled`] ? previous
      : { ...previous, [`${toolKey}:settled`]: 'start', ...((previous[toolKey] ?? 'start') === 'start' ? { [toolKey]: null } : {}) });
  }, [setStartOrder, setToolPanes, toolKey]);
  const fighting = !finished && !fled && activeTargets.length > 0;
  const toolItems: StripItem<CombatTool>[] = selected ? [
    { id: 'start', label: '조우 시작', badge: order },
    { id: 'allocation', label: '적 배분' },
    ...(activeTargets.length > 1 ? [{ id: 'compare' as const, label: '피해 비교' }] : []),
    { id: 'mastery', label: 'Mastery·마법' },
    ...(fighting ? [{ id: 'flee' as const, label: '도주' }] : []),
  ] : [{ id: 'mastery', label: 'Mastery·마법' }];
  const masteryPane = (
    <PlayStripPane prefix={toolStrip} id="mastery" open={tool === 'mastery'}>
      <PlayDraftScope name="mastery">
        <PlayMastery targets={selected && !selected.status ? [selected, ...activeTargets.filter((target) => target.id !== selected.id)] : activeTargets}
          onSheetChange={onMasterySheetChange} onJournalChange={onMasteryJournalChange} />
      </PlayDraftScope>
    </PlayStripPane>
  );

  useEffect(() => { onCreatureChange(primary); }, [primary, onCreatureChange]);
  useEffect(() => { onTargetsChange?.(names); }, [names, onTargetsChange]);
  useLayoutEffect(() => {
    if (pendingFocus.current === 'target' && selected) {
      combatHeading.current?.focus();
      pendingFocus.current = null;
    } else if (pendingFocus.current === 'method' && !selected) {
      methodInput.current?.focus();
      pendingFocus.current = null;
    }
  }, [selected]);

  const selectCreature = (creature: CreatureRecord, source: string, count = 1) => {
    pendingFocus.current = 'target';
    const additions = Array.from({ length: count }, () => newTarget(creature.id, source));
    setLineup((previous) => additions.reduce(appendTarget, previous));
    if (!domainOverseerKnown && creature.id === domainOverseer?.id) onRevealDomainOverseer?.();
    setAddingTarget(false);
    setCustomGap(null);
  };
  const clearTargets = () => {
    pendingFocus.current = 'method';
    setLineup(EMPTY_LINEUP);
    setAddingTarget(false);
  };
  const summons = selected && !finished && !fled ? {
    activeCount: (creatureId: string) => activeTargets.filter((target) => target.creatureId === creatureId).length,
    add: (creatureId: string, count: number) => {
      const additions = Array.from({ length: count }, () => newTarget(creatureId, `${selected.label} 소환 · Initiative 순서에서 시전자 직후`));
      setLineup((previous) => ({ ...additions.reduce(appendTarget, previous), activeId: previous.activeId }));
    },
  } : undefined;
  const targetStatus = (target: typeof targets[number]) => (
    <label className="play-target-status" data-status={target.status}>
      <span>상태</span>
      <select value={target.status ?? ''} aria-label={`${target.label} 상태`} disabled={finished || fled}
        onChange={(event) => {
          const status = event.target.value;
          setLineup((previous) => ({ ...previous, targets: previous.targets.map((item) => item.id === target.id
            ? { ...item, status: status === 'defeated' || status === 'left' ? status : undefined } : item) }));
        }}>
        <option value="">교전 중</option>
        <option value="defeated">처치</option>
        <option value="left">이탈</option>
      </select>
    </label>
  );

  return (
    <section className="play-combat" aria-label="조우와 전투 도구">
      {requestedCreature && <PlayBestiaryAdd key={requestedCreature.id} creature={requestedCreature} finished={finished || fled}
        onCancel={() => {
          onCloseBestiaryRequest();
          requestAnimationFrame(() => (combatHeading.current ?? methodInput.current)?.focus());
        }} onAdd={(count) => {
          selectCreature(requestedCreature, '도감에서 추가', count);
          onCloseBestiaryRequest();
        }} />}
      {selected && primary && profile ? (
        <>
          <div className="play-combat-lineup">
            {targets.length > 1 && <div className="play-combat-targets" role="group" aria-label="전투 대상">
              {targets.map((target) => <div className="play-combat-target" key={target.id}>
                <button type="button" className="btn ghost" aria-pressed={selected.id === target.id} data-play-combat-target={target.id}
                  onClick={() => setLineup((previous) => ({ ...previous, activeId: target.id }))}>
                  <span lang="en">{target.label}</span>
                </button>
                {targetStatus(target)}
              </div>)}
            </div>}
            <header className="play-combat-heading">
              <div>
                <h3 ref={combatHeading} tabIndex={-1} lang="en">{selected.label}</h3>
                <p>{selected.source}</p>
              </div>
              {finished || fled ? onNewEncounter && <button type="button" className="btn ghost" onClick={onNewEncounter}>새 조우 시작</button>
                : <button type="button" className="btn ghost" onClick={clearTargets}>조우 다시 선택</button>}
            </header>
            {targets.length === 1 && targetStatus(selected)}
            <div className="play-combat-actions-row">
              <div className="play-combat-target-actions">
                <button type="button" className="btn ghost" disabled={finished || fled}
                  onClick={() => selectCreature(selected.creature, '같은 생물 추가')}>같은 생물 추가</button>
                <button type="button" className="btn ghost" aria-expanded={addingTarget} aria-controls={addTargetId}
                  disabled={finished || fled} onClick={() => setAddingTarget(!addingTarget)}>다른 생물 추가</button>
                {targets.length > 1 && <button type="button" className="btn ghost" disabled={finished || fled} onClick={() => {
                  const remaining = lineup.targets.filter(({ id }) => id !== selected.id);
                  pendingFocus.current = 'target';
                  setLineup({ ...lineup, targets: remaining, activeId: remaining[0]?.id ?? null });
                }}>선택 대상 빼기</button>}
              </div>
              {!fled && !finished && <div className="play-combat-complete">
                <button type="button" className="btn primary" disabled={tracksDefeats && activeTargets.length > 0}
                  onClick={() => onBattleEnd(primary, 'victory', targets.map(({ creature }) => creature), defeatedTargets)}>승리 후 전투 마치기</button>
                <button type="button" className="btn ghost"
                  onClick={() => onBattleEnd(primary, 'ended', targets.map(({ creature }) => creature), defeatedTargets)}>전투만 마치기</button>
                {tracksDefeats && activeTargets.length > 0 &&
                  <p className="play-combat-note">승리를 확정하려면 교전 중인 적을 처치 또는 이탈로 표시하세요.</p>}
              </div>}
            </div>
            {!fled && finished && currentOutcome && onPreviewBattleEnd && (currentOutcome === 'victory' || !tracksDefeats || activeTargets.length === 0) &&
              <FightOutcomeEditor current={currentOutcome}
                preview={(outcome) => onPreviewBattleEnd(outcome, targets.map(({ creature }) => creature), defeatedTargets)}
                onConfirm={(outcome) => onBattleEnd(primary, outcome, targets.map(({ creature }) => creature), defeatedTargets, true)} />}
            <div id={addTargetId} hidden={!addingTarget || finished || fled}>
              {addingTarget && !finished && !fled && <PlayCreatureSearch label="추가할 생물 이름" onSelect={(creature) => selectCreature(creature, '이름으로 추가')} />}
            </div>
          </div>
          {fled && <p className="play-condition">후퇴 기록을 남겼습니다. 탐험 화면의 재진입 목록에서 이 적 편성을 다시 열 수 있습니다.</p>}
          {finished && !fled && <p className="play-condition">이 전투의 종료를 확정했습니다. 전투 이후 결과는 휴식·정리에서 확인할 수 있습니다.</p>}
        </>
      ) : (
        <div className="play-combat-lookup">
          <ChoiceButtons className="play-combat-method" label="조우 방식" value={method} focusRef={methodInput} onChange={(next) => {
            setMethod(next);
            setChoice(null);
            setCustomGap(null);
          }} options={ENCOUNTER_METHODS} />
          {method === 'encounter' && (
            <>
              <EncounterRoll table={TABLE_CHOICE} completed={choice !== null} submitLabel="확인" onResult={(roll) => {
                const id = resultRow(TABLE_CHOICE, roll)?.next?.[0]?.id;
                return id && isEncounterTable(id) ? () => setChoice({ table: id, roll }) : null;
              }} />
              {choice && (
                <div className="play-combat-table-choice" role="status">
                  <span className="readout">{choice.roll}</span>
                  <strong>{ENCOUNTER_TABLES[choice.table]}</strong>
                </div>
              )}
            </>
          )}
          {tableId && table && (
            <div className="play-combat-table" key={tableId}>
              <h3>{ENCOUNTER_TABLES[tableId]} · {table.dice}</h3>
              {tableId === 't-overseer' && domainOverseer && (
                <div className="play-combat-domain-overseer">
                  <button type="button" className="btn primary" onClick={() => selectCreature(domainOverseer, '이 도메인의 Overseer')}>이 도메인의 Overseer 선택</button>
                  {(!discovery || domainOverseerKnown) && <strong lang="en">{domainOverseer.name}</strong>}
                </div>
              )}
              <EncounterRoll table={table} submitLabel="생물 선택" onResult={(roll) => {
                const id = resultRow(table, roll)?.next?.find((next) => creatureById.has(next.id))?.id;
                const creature = id ? creatureById.get(id) : undefined;
                const source = `${ENCOUNTER_TABLES[tableId]} ${table.dice} ${roll}`;
                return creature ? () => selectCreature(creature, choice ? `D6 ${choice.roll} · ${source}` : source) : null;
              }} />
              <XRef id={tableId}>전체 {ENCOUNTER_TABLES[tableId]} 보기</XRef>
            </div>
          )}
          {method === 'search' && <PlayCreatureSearch onSelect={(creature) => selectCreature(creature, '이름으로 선택')} />}
          {method === 'custom' && (
            <div className="play-combat-table">
              <h3>사용자 지정 조우표 · D20</h3>
              <EncounterLibraryControls sets={customSets} active={customSet} onSelect={(id) => {
                onCustomSetSelect(id);
                setCustomGap(null);
              }} onChange={onCustomSetsChange} />
              <EncounterRoll key={customSet.id} customSetId={customSet.id} submitLabel="생물 선택" onResult={(roll) => () => {
                const row = customSet.rows.find(({ min, max }) => min <= roll && roll <= max);
                const creature = row ? creatureById.get(row.creatureId) : undefined;
                if (creature) selectCreature(creature, `${customSet.name} D20 ${roll}`);
                else setCustomGap(roll);
              }} />
              {customGap !== null && <div className="play-combat-table-choice" role="status">
                <span className="readout">{customGap}</span>
                <strong>이 범위에 지정한 생물이 없습니다.</strong>
              </div>}
              <PlayCustomEncounterEditor key={customSet.id} rows={customSet.rows} onChange={(rows) => {
                onCustomSetsChange(customSets.map((set) => set.id === customSet.id ? { ...set, rows } : set));
                setCustomGap(null);
              }} />
            </div>
          )}
          {method !== 't-overseer' && method !== 'custom' && (
            <p className="play-combat-note"><XRef id="first-domain-rules">도입 도메인 전용 표</XRef>를 썼다면 생물 이름으로 찾으세요.</p>
          )}
        </div>
      )}
      {fighting && <PlayDraftScope key={roundScope} name={roundScope}>
        <PlayTurnSummary selected={selected?.status ? undefined : selected} belt={belt}
          onAttack={() => selectedCard.current?.openPcAttack()} onEnemyAction={() => selectedCard.current?.openEnemyAction()} onBelt={onOpenBelt}
          onMastery={() => openTool('mastery')} onFlee={() => openTool('flee')} />
        <CombatLingeringAlert />
      </PlayDraftScope>}
      <div className="play-combat-toolbox">
        <PlayStrip label="전투 진행 도구" prefix={toolStrip} value={tool} onChange={setTool} items={toolItems} />
        {selected && profile && <>
          <PlayStripPane prefix={toolStrip} id="start" open={tool === 'start'}>
            <PlayDraftScope key={`encounter-start-${lineup.encounterId}`} name={`encounter-start-${lineup.encounterId}`}>
              <section className="creature-encounter" aria-label="조우 시작"><EncounterStart creature={profile} onResolved={settleStart}
                quickWeapon={weapons.some(({ quick }) => quick)} /></section>
            </PlayDraftScope>
          </PlayStripPane>
          <PlayStripPane prefix={toolStrip} id="allocation" open={tool === 'allocation'}>
            <PlayDraftScope key={`allocation-${targetIds}`} name={`allocation-${targetIds}`}>
              <PlayTargetAllocation targets={targets} />
            </PlayDraftScope>
          </PlayStripPane>
          <PlayDraftScope key={roundScope} name={roundScope}>
            {activeTargets.length > 1 && <PlayStripPane prefix={toolStrip} id="compare" open={tool === 'compare'}>
              <PlayDamageComparison targets={activeTargets} />
            </PlayStripPane>}
          </PlayDraftScope>
        </>}
        {masteryPane}
        {fighting && <PlayStripPane prefix={toolStrip} id="flee" open={tool === 'flee'}>
          <PlayDraftScope key={`flee-${lineup.encounterId}`} name={`flee-${lineup.encounterId}`}>
            <PlayFlee onFlee={() => onFlee(activeTargets.map(({ creature }) => creature), targets.map(({ creature }) => creature))} />
          </PlayDraftScope>
        </PlayStripPane>}
      </div>
      {selected && <AttackFollowUpProvider encounterId={lineup.encounterId} targetId={selected.id} readOnly={!fighting || !!selected.status}>
        <PlayDraftScope key={`target-${selected.id}`} name={`target-${selected.id}`}>
          <CreatureCombatCard ref={selectedCard} creature={selected.creature} targetName={selected.label}
            entry={entryById.get(selected.creature.id)!} summons={summons} showEncounterStart={false} showAftermath={false} weapons={weapons}
            allowApplyingConditions={fighting && !selected.status} />
        </PlayDraftScope>
      </AttackFollowUpProvider>}
    </section>
  );
}

function FightOutcomeEditor({ current, preview, onConfirm }: {
  current: FinishedCombatOutcome;
  preview: (outcome: FinishedCombatOutcome) => CombatOutcomePreview;
  onConfirm: (outcome: FinishedCombatOutcome) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const next = current === 'victory' ? 'ended' : 'victory';
  const changes = open ? preview(next) : null;
  const label = (outcome: FinishedCombatOutcome) => outcome === 'victory' ? '승리' : '전투 종료';
  return (
    <div className="play-outcome-edit">
      <button ref={toggle} className="btn ghost" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        전투 결과 수정
      </button>
      <section className="play-outcome-preview" id={id} hidden={!open} aria-label="전투 결과 수정 미리보기">
        {changes && <>
          <h4>{label(current)} → {label(next)}</h4>
          <dl>
            <div><dt>XP</dt><dd>{changes.before.xp} → {changes.after.xp}</dd></div>
            <div><dt>전리품 굴림</dt><dd>{changes.before.lootRolls}회 → {changes.after.lootRolls}회</dd></div>
            <div><dt>Overseer Sanity 회복 D4</dt><dd>{changes.before.sanityRolls}회 → {changes.after.sanityRolls}회</dd></div>
          </dl>
          {changes.affected.length > 0 && <>
            <p>정리와 저널에서 바뀌는 기존 보상</p>
            <ul>{changes.affected.map(({ text, posted }, index) =>
              <li key={index}>{text}{posted && ' · 이미 반영됨'}</li>)}</ul>
          </>}
          {changes.affected.some(({ posted }) => posted) &&
            <p>이미 반영한 값은 저널의 정정표에서 확인할 수 있습니다.</p>}
          <div className="play-combat-complete">
            <button type="button" className="btn primary" onClick={() => { setOpen(false); onConfirm(next); }}>결과 수정 확정</button>
            <button type="button" className="btn ghost" onClick={() => { setOpen(false); toggle.current?.focus(); }}>취소</button>
          </div>
        </>}
      </section>
    </div>
  );
}
