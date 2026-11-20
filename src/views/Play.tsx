import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { tableById } from '../content';
import { creatureById, type CreatureRecord } from '../content/entries/creatures';
import { CopyButton, XRef } from '../components/bits';
import { PlayAdvancement } from '../components/play/PlayAdvancement';
import { PlayCheckpoints } from '../components/play/PlayCheckpoints';
import { PlayCombat, type EncounterSeed } from '../components/play/PlayCombat';
import { PlayDomain } from '../components/play/PlayDomain';
import { PlayEquipment } from '../components/play/PlayEquipment';
import { PlayExploration, type ExplorationReport } from '../components/play/PlayExploration';
import { ExplorationActionLinks, type ExplorationActionsHandle } from '../components/play/PlayExplorationActions';
import { PlayFocusMode } from '../components/play/PlayFocus';
import { PlayInventory, useGearLedger } from '../components/play/PlayInventory';
import { PlayOngoingEffects } from '../components/play/PlayOngoingEffects';
import { findPaperCorrections, paperReceiptKey, PlayPaperCorrections, type PaperReceipt } from '../components/play/PlayPaperCorrections';
import { PlayPendingRolls } from '../components/play/PlayPendingRolls';
import { PlayPinnedTool } from '../components/play/PlayPinnedTool';
import { PlayWrapUp } from '../components/play/PlayWrapUp';
import { focusPlayRoll, PlayActionBar, PlayRollHistory, usePhysicalFirst, usePlayPreference } from '../components/play/PlayWorkflow';
import { BESTIARY_CREATURE_PARAM } from '../lib/bestiary-encounter';
import { readEncounterLibrary, storeEncounterLibrary, type EncounterSet } from '../lib/custom-encounters';
import { introEncounterCreature, nameDomainDiscoveries, newDomainProgress } from '../lib/domain-progress';
import { PlayDraftProvider, PlayDraftScope, usePlayDraft, usePlayDraftState } from '../lib/play-draft';
import { usePlayCampaignId } from '../lib/play-campaigns';
import type { PlayCheckpointData } from '../lib/play-checkpoints';
import { LINGERING_CONDITIONS, PLAY_EFFECT_CHANGES_SLOT, PLAY_EFFECTS_SLOT, readPlayOngoing } from '../lib/play-effects';
import { PAPER_MAP_SLOT, paperMapKey, type PaperMapLocation } from '../lib/paper-map';
import { PLAY_PENDING_ROLLS_SLOT, type PendingPlayRoll } from '../lib/play-pending-rolls';
import { playRollStage, type PlayRollEntry } from '../lib/play-roll-history';
import { appendPlayTimeline, createPlayTimelineEntry, PLAY_TIMELINE_SLOT, type PlayTimelineEntry } from '../lib/play-timeline';
import {
  activeDarkness, darknessDetails, domainOverseer, influenceText, newPlayDomain, tensionSides,
  type DarknessEvent, type PlayDomainRecord, type RetreatedEncounter, type TensionSides,
} from '../lib/play-domain';
import { isQuickUseEntry, type PaperChange } from '../lib/play-inventory';
import { SKILL_PRESETS_SLOT } from '../lib/play-skill';
import { navigate, useLocation } from '../lib/router';
import { SKILL_GROWTH_SLOT, usePendingSkillGrowth, useSkillCriticalHistory } from '../lib/skill-growth';
import '../styles/play.css';
import '../styles/play-workflow.css';
import '../styles/play-desk-tools.css';

const STAGES = [
  { id: 'explore', label: '탐험', heading: '이번 장소 탐험', references: ['p-explore-room', 'first-domain-rules', 'retracing'] },
  { id: 'combat', label: '조우·전투', heading: '조우와 전투', references: ['p-combat-round', 'p-initiative', 'p-attack'] },
  { id: 'wrapup', label: '휴식·정리', heading: '휴식과 전리품', references: ['p-rest', 'combat-end', 'spoils'] },
  { id: 'journal', label: '저널', heading: '이번 장소 기록', references: [] },
] as const;

type StageId = typeof STAGES[number]['id'];
type EncounterKind = 'encounter' | 'overseer';
type BattleOutcome = 'victory' | 'ended' | 'fled';
type DefeatedTarget = { creatureId: string; label: string };
type Battle = {
  kind: EncounterKind;
  planKey?: string;
  retreatId?: string;
  seed?: EncounterSeed;
  primaryId: string | null;
  creatureIds: string[];
  defeatedTargets?: DefeatedTarget[];
  outcome: BattleOutcome | null;
};
const BASE_BATTLE: Battle = { kind: 'encounter', primaryId: null, creatureIds: [], outcome: null };
const FIRST_DOMAIN = [newPlayDomain(1)];
const ENCOUNTER_LABELS = { encounter: '전투', overseer: 'Overseer 은신처', none: '없음' } as const;
const COMBAT_EFFECTS = new Set([1, 13, 23, 29, 35, 51, 55, 59, 61, 65, 77]);
const REST_EFFECTS = new Set([15, 17, 19, 61]);
const EXPLORE_EFFECTS = new Set([61, 69, 73]);

function encounterFromEvent(source: string): EncounterSeed | undefined {
  const intro = /^intro-encounter-(\d+)(?::[\w:-]+)?$/.exec(source);
  if (intro) {
    const id = introEncounterCreature(Number(intro[1]));
    return id ? { creatureIds: [id], description: `도입 도메인 D20 ${intro[1]}` } : undefined;
  }
  const match = /^event-(\d+)$/.exec(source);
  if (!match) return undefined;
  const roll = Number(match[1]);
  const row = tableById.get('t-events')?.rows.find(({ min, max }) => min <= roll && roll <= max);
  const creatureIds = row?.next?.flatMap(({ id }) => creatureById.has(id) ? [id] : []) ?? [];
  return creatureIds.length ? { creatureIds, description: `이벤트 D100 ${roll}` } : undefined;
}

function advanceDiceFocus(event: KeyboardEvent<HTMLDivElement>) {
  const input = event.target;
  if (event.key !== 'Enter' || event.nativeEvent.isComposing || !(input instanceof HTMLInputElement)
      || !input.matches('[data-play-dice]') || !input.form?.hasAttribute('data-play-roll')) return;
  const section = input.closest('.play-stage, .play-domain-body');
  if (!section) return;
  requestAnimationFrame(() => {
    if (document.activeElement !== input || input.getAttribute('aria-invalid') === 'true') return;
    const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[data-play-dice]'));
    const next = inputs.slice(inputs.indexOf(input) + 1)
      .find((field) => !field.disabled && field.getClientRects().length > 0);
    next?.focus();
  });
}

function EffectNotice({ effects, types, influence = [] }: { effects: DarknessEvent[]; types: Set<number>; influence?: string[] }) {
  const lines = effects.flatMap((event) => {
    const row = darknessDetails(event);
    return row && types.has(row.min) ? [{ id: event.id, text: row.ko }] : [];
  });
  if (!lines.length && !influence.length) return null;
  return (
    <aside className="play-effect-note" aria-label="이 단계에 적용되는 도메인 효과">
      {influence.length > 0 && <p><strong>도메인의 일반 적</strong> · {influence.join(' / ')}</p>}
      {lines.length > 0 && <ul>{lines.map(({ id, text }) => <li key={id}>{text}</li>)}</ul>}
    </aside>
  );
}

export function Play() {
  const [focusMode, toggleFocusMode] = usePlayPreference('kn-play-focus-mode');
  return <PlayDraftProvider><PlayFocusMode.Provider value={focusMode}>
    <PlayDesk focusMode={focusMode} toggleFocusMode={toggleFocusMode} />
  </PlayFocusMode.Provider></PlayDraftProvider>;
}

function PlayDesk({ focusMode, toggleFocusMode }: { focusMode: boolean; toggleFocusMode: () => void }) {
  const draft = usePlayDraft()!;
  const campaignId = usePlayCampaignId();
  const { search } = useLocation();
  const requestedCreature = search.get(BESTIARY_CREATURE_PARAM);
  const bestiaryCreature = requestedCreature && creatureById.has(requestedCreature) ? requestedCreature : null;
  const gear = useGearLedger();
  const pendingGrowth = usePendingSkillGrowth();
  const skillCriticalHistory = useSkillCriticalHistory();
  const [active, setActive] = usePlayDraftState<StageId>('active', 'explore');
  const [paperMap, setPaperMap] = usePlayDraftState<PaperMapLocation[]>(PAPER_MAP_SLOT, []);
  const [pendingRolls, setPendingRolls] = usePlayDraftState<PendingPlayRoll[]>(PLAY_PENDING_ROLLS_SLOT, []);
  const [ongoingChanges] = usePlayDraftState<PaperChange[]>(PLAY_EFFECT_CHANGES_SLOT, []);
  const ongoing = readPlayOngoing(draft.slots);
  const [timeline, setTimeline] = usePlayDraftState<PlayTimelineEntry[]>(PLAY_TIMELINE_SLOT, []);
  const [physicalFirst, togglePhysicalFirst] = usePhysicalFirst();
  const [revision, setRevision] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [exploration, setExploration] = useState<ExplorationReport | null>(null);
  const [battles, setBattles] = usePlayDraftState<Record<string, Battle>>('battles', {});
  const [combatId, setCombatId] = usePlayDraftState('combat', 'place');
  const [wrapId, setWrapId] = usePlayDraftState('wrap', 'place');
  const [targetNames, setTargetNames] = usePlayDraftState<Record<string, string[]>>('targetNames', {});
  const [battleLines, setBattleLines] = usePlayDraftState<Record<string, string>>('battleLines', {});
  const [wrapSummary, setWrapSummary] = useState('');
  const [sheetShared, setSheetShared] = useState<PaperChange[]>([]);
  const [equipmentReport, setEquipmentReport] = useState('');
  const [equipmentSheet, setEquipmentSheet] = useState<PaperChange[]>([]);
  const [advancementReport, setAdvancementReport] = useState('');
  const [advancementSheet, setAdvancementSheet] = useState<PaperChange[]>([]);
  const [masteryReports, setMasteryReports] = usePlayDraftState<Record<string, string>>('masteryReports', {});
  const [masterySheet, setMasterySheet] = usePlayDraftState<Record<string, PaperChange[]>>('masterySheet', {});
  const [battleSheet, setBattleSheet] = usePlayDraftState<Record<string, PaperChange[]>>('battleSheet', {});
  const [applied, setApplied] = usePlayDraftState<PaperReceipt[]>('paperApplied', []);
  const [journalCopiedText, setJournalCopiedText] = usePlayDraftState('journalCopiedText', '');
  const [placeName, setPlaceName] = usePlayDraftState('placeName', '');
  const [note, setNote] = usePlayDraftState('note', '');
  const [nextTension, setNextTension] = usePlayDraftState('nextTension', '');
  const [initialTension] = usePlayDraftState<TensionSides>('initialTension', 8);
  const [breatherTension, setBreatherTension] = useState<TensionSides | null>(null);
  const [domains, setDomains] = usePlayDraftState<PlayDomainRecord[]>('domains', FIRST_DOMAIN);
  const [domainId] = usePlayDraftState('domainId', 1);
  const [roomNumber] = usePlayDraftState('roomNumber', 1);
  const [roomLedgerId, setRoomLedgerId] = usePlayDraftState('roomLedgerId', '');
  useEffect(() => {
    if (!roomLedgerId) setRoomLedgerId(crypto.randomUUID());
  }, [roomLedgerId, setRoomLedgerId]);
  const [darkness, setDarkness] = useState<number | null>(null);
  const [actionDarkness, setActionDarkness] = useState<number[]>([]);
  const [breatherDarkness, setBreatherDarkness] = useState<number | null>(null);
  const [dismissed, setDismissed] = usePlayDraftState<string[]>('dismissedDarkness', []);
  const [customSets, setCustomSets] = useState(() => readEncounterLibrary(campaignId));
  const equipment = useRef<HTMLDetailsElement>(null);
  const inventory = useRef<HTMLDetailsElement>(null);
  const explorationActions = useRef<ExplorationActionsHandle>(null);
  const headings = useRef<Partial<Record<StageId, HTMLHeadingElement>>>({});
  const stagePositions = useRef<Partial<Record<StageId, number>>>({});
  const stage = STAGES.find(({ id }) => id === active) ?? STAGES[0];
  const domain = domains.find(({ id }) => id === domainId) ?? domains[0];
  const overseer = domainOverseer(domain.overseerRoll);
  const defeated = domain.defeated || !!overseer && Object.values(battles).some(
    (battle) => battle.defeatedTargets?.some(({ creatureId }) => creatureId === overseer.id)
      ?? (battle.outcome === 'victory' && battle.creatureIds.includes(overseer.id)),
  );
  const previousEffects = activeDarkness(domain.darkness, dismissed);
  const roomDarkness = [
    ...[darkness].flatMap((roll) => roll === null ? [] : [{ id: `${roomNumber}-entry-${roll}`, roll }]),
    ...actionDarkness.map((roll, index) => ({ id: `${roomNumber}-action-${index}-${roll}`, roll })),
    ...[breatherDarkness].flatMap((roll) => roll === null ? [] : [{ id: `${roomNumber}-breather-${roll}`, roll }]),
  ];
  const effects = activeDarkness([...domain.darkness, ...roomDarkness], dismissed);
  const preBreatherEffects = activeDarkness([
    ...domain.darkness, ...roomDarkness.filter(({ id }) => !id.startsWith(`${roomNumber}-breather-`)),
  ], dismissed);
  const hasEffect = (min: number) => effects.some((effect) => darknessDetails(effect)?.min === min);
  const influence = defeated ? [] : [
    influenceText(domain.influence),
    ...effects.filter(({ roll }) => roll >= 81).map(({ id }) => domain.extra[id]
      ? influenceText(domain.extra[id]) : '추가 영향력 굴림 필요'),
  ].filter(Boolean);

  const combat = battles[combatId] ?? BASE_BATTLE;
  const wrapBattle = battles[wrapId];
  const completedBattles = Object.entries(battles).filter(([, battle]) => battle.outcome && battle.outcome !== 'fled');
  const finishedSources = Object.entries(battles).flatMap(([id, battle]) => battle.outcome ? [id.split(':').at(-1)!] : []);
  const campEncounterResolved = completedBattles.flatMap(([, battle]) => battle.planKey ?? []);
  const defeatedIds = wrapBattle?.defeatedTargets?.map(({ creatureId }) => creatureId)
    ?? (wrapBattle?.outcome === 'victory' ? wrapBattle.creatureIds : undefined);
  const roster = defeatedIds?.flatMap((id) => creatureById.get(id) ?? []);
  const victoryLabels = wrapBattle?.defeatedTargets?.map(({ label }) => label) ?? targetNames[wrapId];
  const overseersDefeated = roster?.filter(({ group }) => group === 'overseer').length ?? 0;
  const victoryXp = overseersDefeated ? 200 * overseersDefeated
    : wrapBattle?.outcome === 'victory' && wrapBattle.creatureIds.some((id) => creatureById.get(id)?.group === 'creature') ? 50 : undefined;
  const battleLabel = (id: string, battle: Battle) => {
    const names = targetNames[id] ?? battle.creatureIds.flatMap((creatureId) => creatureById.get(creatureId)?.name ?? []);
    return names.join(', ') || (battle.primaryId ? creatureById.get(battle.primaryId)?.name : undefined) || '조우';
  };

  const focusStage = (id: StageId) => requestAnimationFrame(() => {
    const heading = headings.current[id];
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start' });
  });
  const selectStage = (id: StageId) => {
    const heading = headings.current[active];
    if (heading && id !== active) stagePositions.current[active] = -heading.getBoundingClientRect().top;
    setActive(id);
  };
  const goTo = (id: StageId, rememberPosition = false) => {
    const offset = rememberPosition ? stagePositions.current[id] : undefined;
    selectStage(id);
    if (offset === undefined) focusStage(id);
    else requestAnimationFrame(() => {
      const heading = headings.current[id];
      if (!heading) return;
      heading.focus({ preventScroll: true });
      window.scrollBy({ top: heading.getBoundingClientRect().top + offset });
    });
  };
  const goToRollHistory = () => {
    selectStage('journal');
    requestAnimationFrame(() => {
      const heading = document.getElementById('play-roll-log-title');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'start' });
    });
  };
  useEffect(() => {
    if (bestiaryCreature) goTo('combat');
  }, [bestiaryCreature]);
  const closeBestiaryRequest = () => {
    const params = new URLSearchParams(search);
    params.delete(BESTIARY_CREATURE_PARAM);
    navigate(`/play${params.size ? `?${params}` : ''}`, { replace: true, keepScroll: true });
  };
  const goToRecordedField = ({ stage, field, scope }: Pick<PlayRollEntry, 'stage' | 'field'> & { scope?: string }, after?: (focused: boolean) => void) => {
    const battleId = stage === 'combat'
      ? Object.keys(battles).find((id) => (scope ?? field)?.startsWith(`combat/${encodeURIComponent(id)}/`)) : undefined;
    if (battleId) setCombatId(battleId);
    selectStage(stage);
    focusPlayRoll(stage, field, after);
  };
  const changeBattle = useCallback((update: (previous: Battle) => Battle) => {
    setBattles((previous) => {
      const battle = previous[combatId] ?? BASE_BATTLE;
      const result = update(battle);
      return result === battle ? previous : { ...previous, [combatId]: result };
    });
  }, [combatId, setBattles]);
  const chooseCreature = useCallback((creature: CreatureRecord | null) => {
    changeBattle((prior) => {
      const primaryId = creature?.id ?? null;
      return primaryId === prior.primaryId ? prior : { ...prior, primaryId, creatureIds: [], defeatedTargets: undefined, outcome: null };
    });
  }, [changeBattle]);
  const reportTargets = useCallback((names: string[]) => {
    const old = targetNames[combatId] ?? [];
    if (old.length === names.length && old.every((name, index) => name === names[index])) return;
    setTargetNames((previous) => ({ ...previous, [combatId]: names }));
    if (old.length > 0) changeBattle((prior) => prior.outcome ? { ...prior, outcome: null, creatureIds: [], defeatedTargets: undefined } : prior);
  }, [changeBattle, combatId, setTargetNames, targetNames]);
  const startCombat = (kind: EncounterKind, source?: string, planKey?: string) => {
    const id = source ?? (kind === 'overseer' ? 'overseer' : 'place');
    if (!battles[id]) {
      setBattles((previous) => ({ ...previous, [id]: { ...BASE_BATTLE, kind, planKey, seed: encounterFromEvent(id) } }));
    }
    setCombatId(id);
    goTo('combat');
  };
  const startCampEncounter = (planKey: string) => {
    const existing = Object.entries(battles).find(([, battle]) => battle.planKey === planKey);
    const id = existing?.[0] ?? `camp-${Object.keys(battles).length + 1}`;
    startCombat('encounter', id, planKey);
  };
  const updateDomain = (change: Partial<PlayDomainRecord>) => {
    setDomains((previous) => previous.map((record) => record.id === domain.id ? { ...record, ...change } : record));
  };
  const endBattle = (creature: CreatureRecord, outcome: 'victory' | 'ended', creatures?: CreatureRecord[], defeatedTargets?: DefeatedTarget[]) => {
    changeBattle((prior) => ({ ...prior, primaryId: creature.id, outcome, creatureIds: (creatures ?? [creature]).map(({ id }) => id), defeatedTargets }));
    if (outcome === 'victory' && combat.retreatId) {
      updateDomain({ retreats: (domain.retreats ?? []).filter(({ id }) => id !== combat.retreatId) });
    }
    setWrapId(combatId);
    goTo('wrapup');
  };
  const flee = (creatures: CreatureRecord[], participants = creatures) => {
    const id = combat.retreatId ?? `${roomNumber}-${combatId}`;
    const prior = domain.retreats?.find((retreat) => retreat.id === id);
    const place = placeName.trim() || prior?.place || `장소 ${roomNumber}`;
    const creatureIds = creatures.map((creature) => creature.id);
    const retreat = { id, place, creatureIds, kind: combat.kind };
    updateDomain({ retreats: [...(domain.retreats ?? []).filter((item) => item.id !== id), ...(creatureIds.length ? [retreat] : [])] });
    changeBattle((battle) => ({ ...battle, outcome: 'fled', creatureIds: participants.map(({ id }) => id), retreatId: id }));
    if (!placeName.trim()) setPlaceName(place);
    goTo('journal');
  };
  const reenter = (retreat: RetreatedEncounter) => {
    const pending = Object.entries(battles).find(([, battle]) => battle.retreatId === retreat.id && !battle.outcome);
    const id = pending?.[0] ?? `reentry-${Object.keys(battles).length + 1}`;
    if (!pending) setBattles((previous) => ({ ...previous, [id]: {
      ...BASE_BATTLE, kind: retreat.kind, retreatId: retreat.id,
      seed: { creatureIds: retreat.creatureIds, description: '재진입 · 적 Health 전부 회복' },
    } }));
    if (!placeName.trim()) setPlaceName(retreat.place);
    setCombatId(id);
    goTo('combat');
  };
  const openTrader = () => {
    goTo('wrapup');
    requestAnimationFrame(() => {
      if (!equipment.current) return;
      equipment.current.open = true;
      const summary = equipment.current.querySelector('summary');
      summary?.focus({ preventScroll: true });
      summary?.scrollIntoView({ block: 'start' });
    });
  };
  const reportBattleLine = useCallback((line: string) => {
    setBattleLines((previous) => (previous[wrapId] ?? '') === line ? previous : { ...previous, [wrapId]: line });
  }, [setBattleLines, wrapId]);
  const reportSheet = useCallback((items: PaperChange[]) => {
    const scoped = items.filter(({ id }) => id.startsWith(`${wrapId}:`));
    const shared = items.filter(({ id }) => !id.startsWith(`${wrapId}:`));
    setSheetShared((previous) => JSON.stringify(previous) === JSON.stringify(shared) ? previous : shared);
    setBattleSheet((previous) => JSON.stringify(previous[wrapId] ?? []) === JSON.stringify(scoped)
      ? previous : { ...previous, [wrapId]: scoped });
  }, [setBattleSheet, wrapId]);
  const reportMasterySheet = useCallback((items: PaperChange[]) => {
    setMasterySheet((previous) => JSON.stringify(previous[combatId] ?? []) === JSON.stringify(items)
      ? previous : { ...previous, [combatId]: items });
  }, [setMasterySheet, combatId]);
  const reportMasteryLine = useCallback((line: string) => {
    setMasteryReports((previous) => (previous[combatId] ?? '') === line ? previous : { ...previous, [combatId]: line });
  }, [setMasteryReports, combatId]);
  const openInventory = () => {
    if (!inventory.current) return;
    inventory.current.open = true;
    const summary = inventory.current.querySelector('summary');
    summary?.focus({ preventScroll: true });
    summary?.scrollIntoView({ block: 'start' });
  };
  const saveCustomSets = (sets: EncounterSet[]) => {
    setCustomSets(sets);
    storeEncounterLibrary(sets, campaignId);
  };

  const exploreTension = tensionSides(exploration?.nextTension);
  const confirmedTension = tensionSides(nextTension) ?? breatherTension ?? exploreTension;
  const carryTension = confirmedTension ?? initialTension;
  const resetReports = () => {
    stagePositions.current = {};
    setRevision((previous) => previous + 1);
    setConfirmReset(false);
    setExploration(null);
    setWrapSummary('');
    setSheetShared([]);
    setEquipmentReport('');
    setEquipmentSheet([]);
    setAdvancementReport('');
    setAdvancementSheet([]);
    setDarkness(null);
    setActionDarkness([]);
    setBreatherDarkness(null);
    setBreatherTension(null);
  };
  const resetRoom = (nextDomains: PlayDomainRecord[], nextDomain: number, tension: TensionSides, nextTimeline = timeline) => {
    draft.replaceRoom({ domains: nextDomains, domainId: nextDomain, roomNumber: roomNumber + 1,
      roomLedgerId: crypto.randomUUID(), initialTension: tension, [SKILL_GROWTH_SLOT]: pendingGrowth,
      [PAPER_MAP_SLOT]: paperMap, [PLAY_TIMELINE_SLOT]: nextTimeline, [PLAY_EFFECTS_SLOT]: ongoing,
      [PLAY_PENDING_ROLLS_SLOT]: pendingRolls, [SKILL_PRESETS_SLOT]: draft.slots[SKILL_PRESETS_SLOT] ?? {} });
    resetReports();
    focusStage('explore');
  };
  const restoreCheckpoint = async ({ slots, history, encounters, gear: ledger }: PlayCheckpointData) => {
    if (!await gear.change(() => ({ ledger }))) return false;
    saveCustomSets(encounters);
    draft.replaceRoom(slots, history);
    resetReports();
    focusStage(playRollStage(slots.active));
    return true;
  };
  const storeDomain = (keepRoomEffects: boolean) => domains.map((record) => record.id === domain.id ? {
    ...record,
    progress: nameDomainDiscoveries(record.progress, String(roomNumber), placeName),
    darkness: keepRoomEffects ? effects : record.darkness,
    defeated: keepRoomEffects ? defeated : record.defeated,
  } : record);
  const switchDomain = (id: number | 'new') => {
    const saved = storeDomain(true);
    if (id === 'new') {
      const addition = newPlayDomain(Math.max(...domains.map((record) => record.id)) + 1);
      resetRoom([...saved, { ...addition, progress: newDomainProgress(String(roomNumber + 1)) }], addition.id, 8);
    } else if (saved.some((target) => target.id === id && target.progress?.mode !== 'intro')) resetRoom(saved, id, carryTension);
  };

  const fightFacts = Object.entries(battles).flatMap(([id, battle]) => {
    if (!battle.primaryId && !battle.outcome) return [];
    const details = [battleLabel(id, battle)];
    if (battle.outcome) details.push(battle.outcome === 'victory' ? '승리' : battle.outcome === 'fled' ? '후퇴 · 적 편성 기록' : '전투 종료');
    if (battle.planKey) details.push('야영 조우');
    return [details.join(' · ')];
  });
  const wrapFacts = [
    ...completedBattles.flatMap(([id]) => battleLines[id] || []),
    wrapSummary.trim(),
  ].filter(Boolean);
  const facts = [
    { label: '장소', value: [placeName.trim(), exploration?.shape ?? exploration?.place].filter(Boolean).join(' · ') },
    { label: '환경 묘사', value: exploration?.description },
    { label: '짙어지는 어둠', value: exploration?.darkness },
    { label: '이벤트', value: exploration?.event },
    { label: '조우', value: exploration?.encounter && !fightFacts.length ? ENCOUNTER_LABELS[exploration.encounter] : null },
    { label: '적', value: fightFacts.join(' / ') },
    { label: '능력', value: Object.values(masteryReports).filter(Boolean).join(' / ') },
    { label: '상태·유지', value: ongoingChanges.map(({ text }) => text).join(' / ') },
    { label: '탐험 행동', value: exploration?.actions },
    { label: '대성공·대실패', value: skillCriticalHistory.join(' / ') },
    { label: '휴식·전리품', value: wrapFacts.join(' / ') },
    { label: '상인 거래', value: equipmentReport },
    { label: '성장', value: advancementReport },
    { label: '야영 성장 대기', value: pendingGrowth.join(' · ') },
    { label: '다음 긴장 주사위', value: confirmedTension ? `D${confirmedTension}` : null },
    { label: '메모', value: note.trim() },
  ].filter(({ value }) => value);
  const journal = facts.map(({ label, value }) => `${label} ${value}`).join(' / ');
  const sheet = [
    ...(exploration?.sheet ?? []),
    ...completedBattles.flatMap(([id]) => battleSheet[id] ?? []),
    ...sheetShared,
    ...equipmentSheet,
    ...advancementSheet,
    ...ongoingChanges,
    ...Object.entries(masterySheet).flatMap(([id, items]) => items.map((item) => ({ ...item, id: `${id}:${item.id}` }))),
  ];
  const gearChanges = sheet.filter((item) => item.gear);
  const postedGear = roomLedgerId ? gear.ledger.entries.flatMap((entry) => {
    const prefix = `${roomLedgerId}/`;
    return entry.source?.startsWith(prefix) && !isQuickUseEntry(entry, roomLedgerId)
      ? [{ id: entry.source.slice(prefix.length), text: entry.reason }] : [];
  }) : [];
  const paperCommitted = applied.length > 0 || postedGear.length > 0;
  const paperId = paperMap.find((record) => record.domainId === domainId && paperMapKey(record.paperId) === draft.slots['explore/paper-map-key'])?.paperId;
  const appliedKeys = applied.map(paperReceiptKey);
  useEffect(() => {
    if (!applied.some((item) => typeof item === 'string')) return;
    const legacy = new Map(sheet.map(({ id, text }) => [paperReceiptKey({ id, text }), { id, text }]));
    if (applied.some((item) => typeof item === 'string' && legacy.has(item))) {
      setApplied((previous) => previous.map((item) => typeof item === 'string' ? legacy.get(item) ?? item : item));
    }
  });
  const confirmCorrection = (previous: PaperReceipt, current?: PaperChange) => {
    const previousKey = paperReceiptKey(previous);
    const currentKey = current && paperReceiptKey(current);
    setApplied((items) => [
      ...items.filter((item) => ![previousKey, currentKey].includes(paperReceiptKey(item))),
      ...(current ? [{ id: current.id, text: current.text }] : []),
    ]);
  };
  const nextLocation = () => {
    const corrections = findPaperCorrections(sheet, applied);
    const pendingCorrections = corrections.map(({ receipt, current }) => ({
      id: `correction:${paperReceiptKey(receipt)}`, text: `정정 · ${receipt.text} → ${current?.text ?? '취소'}`,
    }));
    const pendingGear = findPaperCorrections(gearChanges, postedGear).map(({ receipt, current }) => ({
      id: `gear-correction:${paperReceiptKey(receipt)}`, text: `장부 정정 · ${receipt.text} → ${current?.text ?? '취소'}`,
    }));
    const archivedSheet = sheet.filter((item) => !corrections.some(({ current }) => current === item));
    const entry = createPlayTimelineEntry({
      id: roomLedgerId, domainId: domain.id, roomNumber, title: placeName.trim() || paperId || '', paperId, facts,
      sheet: [...archivedSheet, ...pendingCorrections, ...pendingGear], applied: appliedKeys, journalCopied: journalCopiedText === journal,
    });
    resetRoom(storeDomain(true), domain.id, carryTension, appendPlayTimeline(timeline, entry));
  };

  const stageHeading = (id: StageId) => (
    <h2 id={`play-${id}`} className="play-stage-heading" tabIndex={-1} ref={(node) => {
      if (node) headings.current[id] = node;
    }}>{STAGES.find((entry) => entry.id === id)?.heading}</h2>
  );

  return (
    <div className="play-desk" data-physical-first={physicalFirst || undefined} onKeyDownCapture={advanceDiceFocus}>
      <header className="play-header">
        <div>
          <h1>플레이 모드</h1>
          <p>종이 시트와 저널 옆에서 이번 장소의 판정과 결과를 모읍니다.</p>
        </div>
        <div className="play-header-actions">
          <button className="btn ghost" type="button" aria-pressed={physicalFirst} onClick={togglePhysicalFirst}>실물 입력 우선</button>
          <button className="btn ghost" type="button" aria-pressed={focusMode} onClick={toggleFocusMode}>집중 보기</button>
          <button className="btn ghost" type="button" disabled={!draft.canUndo} onClick={draft.undoRoll}>직전 굴림 되돌리기</button>
          <button className="btn ghost" type="button" aria-expanded={confirmReset} aria-controls="play-reset"
            onClick={() => setConfirmReset((open) => !open)}>새 장소 시작</button>
        </div>
      </header>
      {confirmReset && (
        <div className="play-reset" id="play-reset" role="group" aria-label="새 장소 확인">
          <p>이번 장소의 입력과 굴림 결과를 지웁니다.</p>
          <button className="btn primary" type="button" onClick={() => resetRoom(storeDomain(false), domain.id, initialTension)}>초기화하고 시작</button>
          <button className="btn ghost" type="button" onClick={() => setConfirmReset(false)}>취소</button>
        </div>
      )}
      <PlayCheckpoints data={{ slots: draft.slots, gear: gear.ledger, encounters: customSets, history: draft.history }}
        place={placeName.trim() || paperId || `장소 ${roomNumber}`} stage={stage.label} onRestore={restoreCheckpoint} />
      <PlayDomain key={domain.id} domain={domain} domains={domains} activeEffects={effects} defeated={defeated} domainPlaceId={String(roomNumber)}
        onUpdate={updateDomain} onSwitch={switchDomain} onDismiss={(id) => setDismissed((old) => [...old, id])}
        timeline={timeline} onTimelineChange={setTimeline} />
      <PlayOngoingEffects />
      <PlayPendingRolls stage={active} roomId={roomLedgerId} wrapBattleId={wrapId}
        place={`${domain.name.trim() || `도메인 ${domain.id}`} · ${placeName.trim() || paperId || `장소 ${roomNumber}`}`}
        rolls={pendingRolls} onChange={setPendingRolls} onJump={(roll, after) => {
          if (roll.wrapBattleId) {
            const outcome = battles[roll.wrapBattleId]?.outcome;
            if (!outcome || outcome === 'fled') { after(false); return; }
            setWrapId(roll.wrapBattleId);
          }
          goToRecordedField(roll, after);
        }} />
      <details className="fold play-gear-fold" ref={inventory}>
        <summary>장비 장부{gear.ledger.items.length > 0 ? ` · ${gear.ledger.items.length}종` : ''}</summary>
        <PlayInventory state={gear} changes={gearChanges} roomId={roomLedgerId} />
      </details>

      <div className="play-layout">
        <nav className="play-nav" aria-label="플레이 단계">
          {STAGES.map(({ id, label }) => (
            <button key={id} type="button" aria-current={id === active ? 'step' : undefined}
              aria-controls={`play-stage-${id}`} onClick={() => goTo(id, true)}>{label}</button>
          ))}
        </nav>
        <div className="play-main">
          <section className="play-stage" id="play-stage-explore" aria-labelledby="play-explore" hidden={active !== 'explore'}>
            {stageHeading('explore')}
            <EffectNotice effects={effects} types={EXPLORE_EFFECTS} />
            {ongoing.conditions.length > 0 && <p className="play-effect-note">
              다음 방 · {LINGERING_CONDITIONS.filter(({ id }) => ongoing.conditions.includes(id)).map(({ label }) => label).join(' · ')} · Health −{ongoing.conditions.length} · Armor 무시
            </p>}
            {!!domain.retreats?.length && (
              <details className="fold play-reentries">
                <summary>후퇴했던 장소 다시 열기</summary>
                <ul>
                  {domain.retreats.map((retreat) => <li key={retreat.id}>
                    <div><strong>{retreat.place}</strong><p>{retreat.creatureIds.map((id) => creatureById.get(id)?.name).filter(Boolean).join(' · ')}</p></div>
                    <button className="btn ghost" type="button" onClick={() => reenter(retreat)} aria-label={`${retreat.place} 재진입`}>재진입</button>
                  </li>)}
                </ul>
              </details>
            )}
            <PlayDraftScope name="explore">
              <PlayExploration key={revision} actionsRef={explorationActions} onReport={setExploration} onCombat={startCombat} onWrapUp={() => goTo('wrapup')}
                finishedSources={finishedSources} initialTension={initialTension} lightCost={previousEffects.some(({ roll }) => roll === 69 || roll === 70) ? 2 : 1}
                onDarknessChange={setDarkness} onActionDarknessChange={setActionDarkness}
                darknessEffectCount={previousEffects.length} onTrader={openTrader}
                domainProgress={domain.progress} onDomainProgress={(progress) => updateDomain({ progress })}
                domainPlaceId={String(roomNumber)} domainPlaceName={placeName} domainDefeated={defeated}
                paperMapDomain={domainId} paperMap={paperMap} onPaperMapChange={setPaperMap}
                domainDestinations={domains.filter((target) => target.id !== domain.id && target.progress?.mode !== 'intro')}
                onLeaveDomain={switchDomain} />
            </PlayDraftScope>
          </section>
          <section className="play-stage" id="play-stage-combat" aria-labelledby="play-combat" hidden={active !== 'combat'}>
            {stageHeading('combat')}
            <EffectNotice effects={effects} types={COMBAT_EFFECTS} influence={influence} />
            <PlayDraftScope name="combat">
              <PlayDraftScope name={combatId}>
                <PlayCombat key={`${revision}:${combatId}`} initialKind={combat.kind} domainOverseer={overseer ?? null}
                  customSets={customSets} customSetId={domain.encounterSetId}
                  onCustomSetSelect={(encounterSetId) => updateDomain({ encounterSetId })} onCustomSetsChange={saveCustomSets}
                  seed={combat.seed} fled={combat.outcome === 'fled'} finished={!!combat.outcome} onFlee={flee}
                  bestiaryCreatureId={bestiaryCreature} onCloseBestiaryRequest={closeBestiaryRequest}
                  onMasterySheetChange={reportMasterySheet} onMasteryJournalChange={reportMasteryLine}
                  onCreatureChange={chooseCreature} onTargetsChange={reportTargets} onBattleEnd={endBattle} />
              </PlayDraftScope>
            </PlayDraftScope>
          </section>
          <section className="play-stage" id="play-stage-wrapup" aria-labelledby="play-wrapup" hidden={active !== 'wrapup'}>
            {stageHeading('wrapup')}
            <EffectNotice effects={effects} types={REST_EFFECTS} />
            {completedBattles.length > 1 && (
              <label className="field play-wrap-battle"><span>정리할 전투</span>
                <select value={wrapId} onChange={(event) => setWrapId(event.target.value)}>
                  {completedBattles.map(([id, battle]) => <option key={id} value={id}>{battle.planKey ? '야영 · ' : ''}{battleLabel(id, battle)}</option>)}
                </select>
              </label>
            )}
            <PlayDraftScope name="wrap">
              <PlayWrapUp key={revision} creature={roster?.[0] ?? null} victoryCreatures={roster}
                inventory={gear.ledger.items}
                victoryLabels={victoryLabels} victoryXp={victoryXp}
                battleId={wrapId} combatEnded={!!wrapBattle?.outcome && wrapBattle.outcome !== 'fled'}
                onCampEncounter={startCampEncounter} campEncounterResolved={campEncounterResolved}
                campDarkness={hasEffect(17)} campAttunementBlocked={hasEffect(19)}
                afterBreatherCheck={hasEffect(15)} breatherTension={exploreTension ?? initialTension}
                breatherDarknessEffectCount={preBreatherEffects.length}
                onBreatherTensionChange={setBreatherTension} onBreatherDarknessChange={setBreatherDarkness}
                onBreatherAmbush={() => startCombat('encounter', 'breather')}
                onJournalChange={setWrapSummary} onBattleJournalChange={reportBattleLine} onSheetChange={reportSheet} />
            </PlayDraftScope>
            {wrapBattle?.outcome && wrapBattle.outcome !== 'fled' && exploration?.area && exploreTension && (
              <ExplorationActionLinks room={exploration.area === 'room'} label="이 장소 탐험 계속" onSelect={(action) => {
                selectStage('explore');
                explorationActions.current?.open(action);
              }} />
            )}
            <details className="fold play-equipment-fold" key={`equipment-${revision}`} ref={equipment}>
              <summary>소지칸·상인 거래</summary>
              <PlayDraftScope name="equipment">
                <PlayEquipment inventory={gear.ledger.items} onSheetChange={setEquipmentSheet} onJournalChange={setEquipmentReport} />
              </PlayDraftScope>
            </details>
            <details className="fold play-equipment-fold" key={`advancement-${revision}`}>
              <summary>XP 레벨업·능력 해금</summary>
              <PlayDraftScope name="advancement">
                <PlayAdvancement onSheetChange={setAdvancementSheet} onJournalChange={setAdvancementReport} />
              </PlayDraftScope>
            </details>
            <button type="button" className="btn primary play-stage-next" data-play-next="" onClick={() => goTo('journal')}>저널 기록 보기</button>
          </section>
          <section className="play-stage" id="play-stage-journal" aria-labelledby="play-journal" hidden={active !== 'journal'}>
            {stageHeading('journal')}
            <div className="play-journal">
              <div className="play-journal-fields">
                <label className="field"><span>장소 이름 (선택)</span>
                  <input value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="예: 지하 묘실" />
                </label>
                <label className="field"><span>다음 긴장 주사위</span>
                  <select value={nextTension} onChange={(event) => setNextTension(event.target.value)}>
                    <option value="">현재 판정에서 가져오기</option>
                    <option>D8</option><option>D6</option><option>D4</option>
                  </select>
                </label>
              </div>
              <label className="field"><span>덧붙일 메모 (선택)</span>
                <textarea value={note} rows={2} onChange={(event) => setNote(event.target.value)} />
              </label>
              <PlayPaperCorrections items={sheet} receipts={applied} onConfirm={confirmCorrection} />
              <PlayPaperCorrections items={gearChanges} receipts={postedGear} onOpenGear={openInventory} />
              {sheet.length > 0 && (
                <fieldset className="play-sheet">
                  <legend>종이 시트에 반영</legend>
                  {sheet.map(({ id, text }) => {
                    const key = `${id}:${text}`;
                    return <label key={key}><input type="checkbox" checked={appliedKeys.includes(key)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setApplied((old) => checked ? [...old, { id, text }] : old.filter((item) => paperReceiptKey(item) !== key));
                      }} />{text}</label>;
                  })}
                </fieldset>
              )}
              {gearChanges.length > 0 && <button className="btn ghost play-stage-next" type="button" onClick={openInventory}>장비 장부에서 변경 확인</button>}
              {journal ? (
                <div className="play-journal-output">
                  <h3>저널에 옮길 내용</h3>
                  <p>{journal}</p>
                  <label className="play-paper-copied"><input type="checkbox" checked={journalCopiedText === journal}
                    onChange={(event) => setJournalCopiedText(event.currentTarget.checked ? journal : '')} />종이 저널에 옮김</label>
                  <div className="play-header-actions">
                    <CopyButton text={journal} label="장소 기록 복사" />
                    <button className="btn primary" type="button" data-play-next="" onClick={nextLocation}>다음 장소</button>
                  </div>
                  <p className="play-carry">다음 장소는 긴장 주사위 D{carryTension}{carryTension === 6 ? '으로' : '로'} 시작합니다.</p>
                </div>
              ) : <p className="play-empty">도구에서 굴림이나 결과를 확인하면 여기에 모입니다.</p>}
            </div>
            <PlayRollHistory key={revision} paperCommitted={paperCommitted}
              onCorrection={goToRecordedField} />
          </section>
        </div>
        <aside className="play-context" aria-label="플레이 중 참고">
          <PlayActionBar stage={active} onHistory={goToRollHistory} />
          <PlayPinnedTool />
          <section>
            <h2>이번 장소</h2>
            {facts.length ? (
              <dl className="play-facts">
                {facts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            ) : <p className="play-empty">확인한 장소와 결과가 여기에 표시됩니다.</p>}
          </section>
          {stage.references.length > 0 && <section>
            <h2>현재 단계의 규칙</h2>
            <div className="play-refs">{stage.references.map((id) => <XRef key={id} id={id} />)}</div>
          </section>}
        </aside>
      </div>
    </div>
  );
}
