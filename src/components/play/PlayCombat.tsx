import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { entryById, tableById } from '../../content';
import { creatureById, type CreatureRecord } from '../../content/entries/creatures';
import type { OracleTable } from '../../content/schema';
import type { EncounterSet } from '../../lib/custom-encounters';
import { rollDie, tableSides } from '../../lib/dice';
import { encounterInteger } from '../../lib/encounter-start';
import { automaticRollSides, readOracleValue, rollTable } from '../../lib/oracle';
import { PlayDraftScope, usePlayDraftState, usePlayRoll, usePlayRollField } from '../../lib/play-draft';
import type { PaperChange } from '../../lib/play-inventory';
import { CreatureCombatCard } from '../CreatureCombatCard';
import { EncounterStart } from '../EncounterStart';
import { XRef } from '../bits';
import { IDie } from '../icons';
import { PlayCreatureSearch } from './PlayCreatureSearch';
import { PlayBestiaryAdd } from './PlayBestiaryAdd';
import { EncounterLibraryControls, PlayCustomEncounterEditor } from './PlayCustomEncounter';
import { PlayDamageComparison } from './PlayDamageComparison';
import { PlayFlee } from './PlayFlee';
import { PlayMastery } from './PlayMastery';
import { PlayRoundBoard } from './PlayRoundBoard';
import { PlayTargetAllocation } from './PlayTargetAllocation';
import '../../styles/play-combat.css';

type EncounterTable = 't-encounter-a' | 't-encounter-b' | 't-overseer';
type EncounterMethod = 'encounter' | EncounterTable | 'search' | 'custom';
type CombatTargetStatus = 'defeated' | 'left';

interface Target {
  id: string;
  creatureId: string;
  source: string;
  ordinal?: number;
  status?: CombatTargetStatus;
}

export type DefeatedCombatTarget = { creatureId: string; label: string };

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

function EncounterRoll({ table, customSetId, completed = false, submitLabel, onResult }: EncounterRollProps) {
  const inputId = useId();
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const commitRoll = usePlayRoll();
  const dice = table?.dice ?? 'D20';
  const sides = tableSides(dice);
  const label = table?.ko ?? '사용자 지정 조우표';
  const field = usePlayRollField(`encounter-roll-${table?.id ?? customSetId}`, label, dice, completed);

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
      <button type="submit" className="btn primary">{submitLabel}</button>
      {(!table || automaticRollSides(table) !== null) && (
        <button type="button" className="btn ghost" onClick={() => apply(table ? rollTable(table) : rollDie(20), 'app')}>
          <IDie /> {dice} 굴리기
        </button>
      )}
      {error && <p className="field-err" id={`${inputId}-error`} role="alert">{error}</p>}
    </form>
  );
}

interface PlayCombatProps {
  initialKind?: 'encounter' | 'overseer';
  domainOverseer?: CreatureRecord | null;
  onCreatureChange: (creature: CreatureRecord | null) => void;
  onTargetsChange?: (names: string[]) => void;
  onBattleEnd: (creature: CreatureRecord, outcome: 'victory' | 'ended', creatures: CreatureRecord[], defeated?: DefeatedCombatTarget[]) => void;
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
}

export type EncounterSeed = { creatureIds: string[]; description: string };

function restoredLineup(seed: EncounterSeed | undefined) {
  if (!seed) return EMPTY_LINEUP;
  return seed.creatureIds.reduce((lineup, creatureId, index) => appendTarget(lineup, {
    id: `initial-${index + 1}`, creatureId, source: seed.description,
  }), EMPTY_LINEUP);
}

export function PlayCombat({ initialKind = 'encounter', domainOverseer, onCreatureChange, onTargetsChange, onBattleEnd, onFlee, fled, finished,
  seed, bestiaryCreatureId, onCloseBestiaryRequest, customSets, customSetId, onCustomSetSelect, onCustomSetsChange, onMasterySheetChange,
  onMasteryJournalChange }: PlayCombatProps) {
  const methodId = useId();
  const addTargetId = useId();
  const [method, setMethod] = usePlayDraftState<EncounterMethod>('method', initialKind === 'overseer' ? 't-overseer' : 'encounter');
  const [choice, setChoice] = usePlayDraftState<{ table: EncounterTable; roll: number } | null>('table-choice', null);
  const [lineup, setLineup] = usePlayDraftState('lineup', restoredLineup(seed));
  const [customGap, setCustomGap] = usePlayDraftState<number | null>('custom-gap', null);
  const [addingTarget, setAddingTarget] = useState(false);
  const methodInput = useRef<HTMLSelectElement>(null);
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
              <button type="button" className="btn ghost" onClick={clearTargets}>조우 다시 선택</button>
            </header>
            {targets.length === 1 && targetStatus(selected)}
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
            <div id={addTargetId} hidden={!addingTarget || finished || fled}>
              {addingTarget && !finished && !fled && <PlayCreatureSearch label="추가할 생물 이름" onSelect={(creature) => selectCreature(creature, '이름으로 추가')} />}
            </div>
          </div>
          <PlayDraftScope key={`encounter-start-${lineup.encounterId}`} name={`encounter-start-${lineup.encounterId}`}>
            <details className="fold creature-encounter">
              <summary>조우 시작</summary>
              <EncounterStart creature={profile} />
            </details>
          </PlayDraftScope>
          <PlayDraftScope key={`allocation-${targetIds}`} name={`allocation-${targetIds}`}>
            <PlayTargetAllocation targets={targets} />
          </PlayDraftScope>
          <PlayDraftScope key={`combat-tools-${lineup.encounterId}`} name={`combat-tools-${lineup.encounterId}`}>
            <PlayRoundBoard targets={activeTargets} />
            {activeTargets.length > 1 && <PlayDamageComparison targets={activeTargets} />}
          </PlayDraftScope>
          <PlayDraftScope key={`target-${selected.id}`} name={`target-${selected.id}`}>
            <CreatureCombatCard creature={selected.creature} targetName={selected.label}
              entry={entryById.get(selected.creature.id)!} summons={summons} showEncounterStart={false} />
          </PlayDraftScope>
          {!finished && !fled && activeTargets.length > 0 && <PlayDraftScope key={`flee-${lineup.encounterId}`} name={`flee-${lineup.encounterId}`}>
            <PlayFlee onFlee={() => onFlee(activeTargets.map(({ creature }) => creature), targets.map(({ creature }) => creature))} />
          </PlayDraftScope>}
          {fled && <p className="play-condition">후퇴 기록을 남겼습니다. 탐험 화면의 재진입 목록에서 이 적 편성을 다시 열 수 있습니다.</p>}
          {finished && !fled && <p className="play-condition">이 전투의 종료를 확정했습니다. 전투 이후 결과는 휴식·정리에서 확인할 수 있습니다.</p>}
          {!fled && (!finished || !tracksDefeats) && <div className="play-combat-complete">
            <button type="button" className="btn primary" disabled={tracksDefeats && activeTargets.length > 0}
              onClick={() => onBattleEnd(primary, 'victory', targets.map(({ creature }) => creature), defeatedTargets)}>승리 후 전투 마치기</button>
            <button type="button" className="btn ghost"
              onClick={() => onBattleEnd(primary, 'ended', targets.map(({ creature }) => creature), defeatedTargets)}>전투만 마치기</button>
            {tracksDefeats && activeTargets.length > 0 &&
              <p className="play-combat-note">승리를 확정하려면 교전 중인 적을 처치 또는 이탈로 표시하세요.</p>}
          </div>}
        </>
      ) : (
        <div className="play-combat-lookup">
          <div className="field play-combat-method">
            <label htmlFor={methodId}>조우 방식</label>
            <select id={methodId} ref={methodInput} value={method} onChange={(event) => {
              setMethod(event.target.value as EncounterMethod);
              setChoice(null);
              setCustomGap(null);
            }}>
              <option value="encounter">일반 조우 · D6로 A/B 결정</option>
              <option value="t-encounter-a">조우 표 A 직접 선택 · D20</option>
              <option value="t-encounter-b">조우 표 B 직접 선택 · D20</option>
              <option value="t-overseer">Overseer · D10</option>
              <option value="search">생물 이름으로 찾기</option>
              <option value="custom">사용자 지정 조우표 · D20</option>
            </select>
          </div>
          {method === 'encounter' && (
            <>
              <EncounterRoll table={TABLE_CHOICE} completed={choice !== null} submitLabel="D6 확인" onResult={(roll) => {
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
                  <strong lang="en">{domainOverseer.name}</strong>
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
      <details className="fold play-mastery-fold">
        <summary>Mastery 능력과 마법 전투</summary>
        <PlayDraftScope name="mastery">
          <PlayMastery targets={selected && !selected.status ? [selected, ...activeTargets.filter((target) => target.id !== selected.id)] : activeTargets}
            onSheetChange={onMasterySheetChange} onJournalChange={onMasteryJournalChange} />
        </PlayDraftScope>
      </details>
    </section>
  );
}
