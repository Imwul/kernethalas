import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { tableById } from '../content';
import { creatureById, type CreatureRecord } from '../content/entries/creatures';
import { CopyButton, XRef } from '../components/bits';
import { PlayAdvancement } from '../components/play/PlayAdvancement';
import {
  CHARACTER_SECTION_EVENT, LEVEL_UP_EVENT, USE_ABILITY_EVENT, PlayCharacter, PlayCharacterWorkspace,
  type CharacterSection, type CharacterWorkspaceView,
} from '../components/play/PlayCharacter';
import { PlayCheckpoints } from '../components/play/PlayCheckpoints';
import { useCampaignDesk } from '../components/play/PlayCampaign';
import { DrawerTabLabel, PLAY_DRAWER_EVENT, PLAY_DRAWER_ID, PlayDrawer, type DrawerTab } from '../components/play/PlayDrawer';
import { PlayPopover } from '../components/play/PlayPanels';
import { PlayCombat, type CombatOutcomePreview, type EncounterSeed, type FinishedCombatOutcome } from '../components/play/PlayCombat';
import { PlayDiscoveryMode } from '../components/play/PlayDiscovery';
import { PlayDomain } from '../components/play/PlayDomain';
import { PlayEquipment } from '../components/play/PlayEquipment';
import { PlayExploration, type ExplorationReport } from '../components/play/PlayExploration';
import { ExplorationActionLinks, type ExplorationActionsHandle } from '../components/play/PlayExplorationActions';
import { PlayFocusMode } from '../components/play/PlayFocus';
import { PlayInventory, useGearLedger } from '../components/play/PlayInventory';
import { PlayIntroDomain, type IntroStart } from '../components/play/PlayIntroDomain';
import { PlayOngoingEffects } from '../components/play/PlayOngoingEffects';
import { findPaperCorrections, paperReceiptKey, PlayPaperCorrections, type PaperReceipt } from '../components/play/PlayPaperCorrections';
import { PlayPendingRolls } from '../components/play/PlayPendingRolls';
import { PlayPinnedTool } from '../components/play/PlayPinnedTool';
import { PlaySessionPanel } from '../components/play/PlaySession';
import { PlayWrapUp, type WrapUpHandle } from '../components/play/PlayWrapUp';
import { useKeepAwakePreference, useScreenWakeLock, wakeLockSupported } from '../lib/wake-lock';
import { focusNextPlayAction, focusPlayRoll, PlayActionBar, PlayRollHistory, readPlaySessionPoint, usePhysicalFirst, usePlayPreference } from '../components/play/PlayWorkflow';
import { BESTIARY_CREATURE_PARAM } from '../lib/bestiary-encounter';
import { formatCombatDamage, readCombatDamageRecords } from '../lib/combat-damage-records';
import { creatureSpoilsTables } from '../lib/creature-combat';
import { readEncounterLibrary, storeEncounterLibrary, type EncounterSet } from '../lib/custom-encounters';
import type { RequiredExplorationRoll } from '../lib/exploration-follow-up';
import { introEncounterCreature, nameDomainDiscoveries, newDomainProgress } from '../lib/domain-progress';
import { PlayDraftProvider, PlayDraftScope, usePlayDraft, usePlayDraftState } from '../lib/play-draft';
import { usePlayCampaignId } from '../lib/play-campaigns';
import type { PlayCheckpointData } from '../lib/play-checkpoints';
import { LINGERING_CONDITIONS, LINGERING_ENTRY_SLOT, PLAY_EFFECT_CHANGES_SLOT, PLAY_EFFECTS_SLOT, readPlayOngoing } from '../lib/play-effects';
import { PAPER_MAP_SLOT, paperMapKey, type PaperMapLocation } from '../lib/paper-map';
import { archiveMapClueSources } from '../lib/paper-map-clues';
import { PLAY_PENDING_ROLLS_SLOT, type PendingPlayRoll } from '../lib/play-pending-rolls';
import { playAction, playRollStage, type PlayRollEntry } from '../lib/play-roll-history';
import { carrySessionIntent, EMPTY_SESSION, isPlaySession, PLAY_SESSION_SLOT, SESSION_INTENT_LIMIT, shortSessionText,
  type PlaySession, type SessionPause } from '../lib/play-session';
import { appendPlayTimeline, createPlayTimelineEntry, PLAY_TIMELINE_SLOT, type PlayTimelineEntry } from '../lib/play-timeline';
import {
  activeDarkness, darknessDetails, domainOverseer, influenceText, newPlayDomain, tensionSides,
  RETREAT_AMBUSH_ID, RETREAT_BATTLE_ID, RETREAT_RETURN_SLOT,
  type DarknessEvent, type PlayDomainRecord, type RetreatedEncounter, type TensionSides,
} from '../lib/play-domain';
import { gearKey, isQuickUseEntry, undoStartingGear, type PaperChange } from '../lib/play-inventory';
import { carryPlayLight, lightRemaining, PLAY_LIGHT_SLOT, playSupplies, readPlayLight } from '../lib/play-light';
import { hasRestoreUndo } from '../lib/site-backup';
import { SKILL_PRESETS_SLOT } from '../lib/play-skill';
import {
  CharacterRoomContext, MADNESS_TIMING_SLOT, PLAY_CHARACTER_SLOT, SURVIVOR_BASELINE_SLOT, XP_TO_LEVEL,
  currentProgress, foldRoomProgress, isPlayCharacter, madnessEffects, type MadnessTiming,
  type PlayCharacter as PlayCharacterRecord, type SurvivorBaseline,
} from '../lib/play-character';
import { goalCounts, roomProgress } from '../lib/character-progress';
import { startingGearToLedger, type GearLine } from '../lib/character-creation';
import { CHARACTER_LOG_SLOT } from '../components/play/PlayExhaustion';
import { ExhaustionHealNote } from '../components/play/ExhaustionHealNote';
import { StatusIcon, type StatusKind } from '../components/StatusIcon';
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
type DrawerId = 'character' | 'history' | 'gear' | 'ongoing' | 'pending' | 'domain' | 'save' | 'tool';
/** Below this desk width the drawer covers the page instead of docking beside it. */
const DOCKED_DRAWER_WIDTH = 1040;
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
  victoryXp?: number;
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
  const fields = Array.from(section.querySelectorAll<HTMLInputElement>('input[data-play-dice]'));
  const preceding = new Set(fields.slice(0, fields.indexOf(input) + 1));
  requestAnimationFrame(() => {
    const focused = document.activeElement;
    if (input.getAttribute('aria-invalid') === 'true' || (focused !== input && (input.isConnected || focused !== document.body))) return;
    const inputs = Array.from(section.querySelectorAll<HTMLInputElement>('input[data-play-dice]'));
    const next = inputs.find((field) => !preceding.has(field) && !field.disabled && field.getClientRects().length > 0);
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
  // Finished entry rolls fold to one line unless the player turned this off.
  const [focusMode, toggleFocusMode] = usePlayPreference('kn-play-focus-mode', true);
  return <PlayDraftProvider><PlayFocusMode.Provider value={focusMode}>
    <PlayDesk focusMode={focusMode} toggleFocusMode={toggleFocusMode} />
  </PlayFocusMode.Provider></PlayDraftProvider>;
}

function PlayDesk({ focusMode, toggleFocusMode }: { focusMode: boolean; toggleFocusMode: () => void }) {
  const draft = usePlayDraft()!;
  const [keepAwake, toggleKeepAwake] = useKeepAwakePreference();
  const screenAwake = useScreenWakeLock(keepAwake);
  const campaignId = usePlayCampaignId();
  const { search } = useLocation();
  const requestedCreature = search.get(BESTIARY_CREATURE_PARAM);
  const bestiaryCreature = requestedCreature && creatureById.has(requestedCreature) ? requestedCreature : null;
  const gear = useGearLedger();
  const applyStartingGear = (lines: GearLine[], source: string) => gear.change((ledger) => startingGearToLedger(ledger, lines, source));
  const undoGearGrant = (source: string) => gear.change((ledger) => undoStartingGear(ledger, source));
  const pendingGrowth = usePendingSkillGrowth();
  const skillCriticalHistory = useSkillCriticalHistory();
  const [active, setActive] = usePlayDraftState<StageId>('active', 'explore');
  const [paperMap, setPaperMap] = usePlayDraftState<PaperMapLocation[]>(PAPER_MAP_SLOT, []);
  const [pendingRolls, setPendingRolls] = usePlayDraftState<PendingPlayRoll[]>(PLAY_PENDING_ROLLS_SLOT, []);
  const [ongoingChanges] = usePlayDraftState<PaperChange[]>(PLAY_EFFECT_CHANGES_SLOT, []);
  const ongoing = readPlayOngoing(draft.slots);
  const [timeline, setTimeline] = usePlayDraftState<PlayTimelineEntry[]>(PLAY_TIMELINE_SLOT, []);
  const [physicalFirst, togglePhysicalFirst] = usePhysicalFirst();
  const [discovery, toggleDiscovery] = usePlayPreference('kn-play-discovery');
  const [storedSession, setSession] = usePlayDraftState<PlaySession>(PLAY_SESSION_SLOT, EMPTY_SESSION);
  const session = isPlaySession(storedSession) ? storedSession : EMPTY_SESSION;
  const [sessionEditing, setSessionEditing] = useState(false);
  const sessionId = useId();
  const sessionButton = useRef<HTMLButtonElement>(null);
  const lastRollField = useRef<Partial<Record<StageId, string>>>({});
  const [revision, setRevision] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const [moveBlocked, setMoveBlocked] = useState(false);
  const moveWarning = useRef<HTMLElement>(null);
  const [exploration, setExploration] = useState<ExplorationReport | null>(null);
  const [requiredRestRolls, setRequiredRestRolls] = useState<RequiredExplorationRoll[]>([]);
  const requiredMoveRolls = [
    ...(exploration?.required ?? []).map((roll) => ({ ...roll, stage: 'explore' as const })),
    ...requiredRestRolls.map((roll) => ({ ...roll, stage: 'wrapup' as const })),
  ];
  useEffect(() => { if (!requiredMoveRolls.length) setMoveBlocked(false); }, [requiredMoveRolls.length]);
  const [battles, setBattles] = usePlayDraftState<Record<string, Battle>>('battles', {});
  const [retreatReturnId] = usePlayDraftState<string | null>(RETREAT_RETURN_SLOT, null);
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
  const [xpSpent, setXpSpent] = useState(0);
  const [masteryReports, setMasteryReports] = usePlayDraftState<Record<string, string>>('masteryReports', {});
  const [masterySheet, setMasterySheet] = usePlayDraftState<Record<string, PaperChange[]>>('masterySheet', {});
  const [battleSheet, setBattleSheet] = usePlayDraftState<Record<string, PaperChange[]>>('battleSheet', {});
  const [applied, setApplied] = usePlayDraftState<PaperReceipt[]>('paperApplied', []);
  const [journalCopiedText, setJournalCopiedText] = usePlayDraftState('journalCopiedText', '');
  const [placeName, setPlaceName] = usePlayDraftState('placeName', '');
  const [note, setNote] = usePlayDraftState('note', '');
  const [introStart, setIntroStart] = usePlayDraftState<IntroStart | null>('introStart', null);
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
  const [drawer, setDrawer] = useState<DrawerId | null>(() => hasRestoreUndo() ? 'save' : null);
  const [drawerModal, setDrawerModal] = useState(() => window.innerWidth < DOCKED_DRAWER_WIDTH);
  const [needsBackup, setNeedsBackup] = useState(false);
  const { selector: campaignSelector, needsCharacterSetup, finishCharacterSetup } = useCampaignDesk();
  const [characterView, setCharacterView] = usePlayDraftState<CharacterWorkspaceView | null>('characterWorkspace', null);
  const showCharacterWorkspace = needsCharacterSetup || characterView !== null;
  const desk = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const wrapUp = useRef<WrapUpHandle>(null);
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
  const overseerKnown = !!overseer && (defeated || domain.overseerRevealedRoll === domain.overseerRoll
    || !!domain.retreats?.some(({ creatureIds }) => creatureIds.includes(overseer.id)));
  const { commitRoll: commitDomainAction } = draft;
  const revealOverseer = useCallback(() => {
    const roll = domain.overseerRoll;
    if (roll === null || domain.overseerRevealedRoll === roll) return;
    commitDomainAction(() => setDomains((previous) => {
      const current = previous.find(({ id }) => id === domain.id);
      if (!current || current.overseerRoll !== roll || current.overseerRevealedRoll === roll) return previous;
      return previous.map((record) => record === current ? { ...record, overseerRevealedRoll: roll } : record);
    }), playAction('Overseer 이름 공개'));
  }, [commitDomainAction, domain.id, domain.overseerRoll, domain.overseerRevealedRoll, setDomains]);
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
  const returnRetreat = domain.retreats?.find(({ id }) => id === retreatReturnId);
  const returnBattle = battles[RETREAT_BATTLE_ID];
  const returnAmbush = battles[RETREAT_AMBUSH_ID]?.outcome ?? null;
  const returnVisit = !!returnRetreat || !!retreatReturnId && returnBattle?.retreatId === retreatReturnId;
  const retreatDestinations = domain.retreats?.filter(({ id }) => id !== retreatReturnId || !!returnBattle?.outcome || returnAmbush === 'fled') ?? [];
  const wrapBattle = battles[wrapId];
  const completedBattles = Object.entries(battles).filter(([, battle]) => battle.outcome && battle.outcome !== 'fled');
  const finishedSources = Object.entries(battles).flatMap(([id, battle]) => battle.outcome ? [id.split(':').at(-1)!] : []);
  const campEncounterResolved = completedBattles.flatMap(([, battle]) => battle.planKey ?? []);
  const defeatedIds = wrapBattle?.defeatedTargets?.map(({ creatureId }) => creatureId)
    ?? (wrapBattle?.outcome === 'victory' ? wrapBattle.creatureIds : undefined);
  const roster = defeatedIds?.flatMap((id) => creatureById.get(id) ?? []);
  const victoryLabels = wrapBattle?.defeatedTargets?.map(({ label }) => label) ?? targetNames[wrapId];
  const overseersDefeated = roster?.filter(({ group }) => group === 'overseer').length ?? 0;
  const victoryXp = wrapBattle?.victoryXp ?? (overseersDefeated ? 200 * overseersDefeated
    : wrapBattle?.outcome === 'victory' && wrapBattle.creatureIds.some((id) => creatureById.get(id)?.group === 'creature') ? 50 : undefined);
  const battleLabel = (id: string, battle: Battle) => {
    const names = targetNames[id] ?? battle.creatureIds.flatMap((creatureId) => creatureById.get(creatureId)?.name ?? []);
    return names.join(', ') || (battle.primaryId ? creatureById.get(battle.primaryId)?.name : undefined) || '조우';
  };

  const focusStage = (id: StageId, offset?: number) => requestAnimationFrame(() => {
    const heading = headings.current[id];
    const focused = document.activeElement;
    // Preserve an input that received focus in the destination before this frame.
    if (!heading || focused?.matches('input, textarea, select') && heading.closest('.play-stage')?.contains(focused)) return;
    heading.focus({ preventScroll: true });
    if (offset === undefined) heading.scrollIntoView({ block: 'start' });
    else window.scrollBy({ top: heading.getBoundingClientRect().top + offset });
  });
  const selectStage = (id: StageId) => {
    const heading = headings.current[active];
    if (heading && id !== active) stagePositions.current[active] = -heading.getBoundingClientRect().top;
    setActive(id);
  };
  const goTo = (id: StageId, rememberPosition = false) => {
    const offset = rememberPosition ? stagePositions.current[id] : undefined;
    selectStage(id);
    focusStage(id, offset);
  };
  const drawerDocked = () => (desk.current?.clientWidth ?? 0) >= DOCKED_DRAWER_WIDTH;
  const openDrawer = (id: DrawerId, focus?: string) => {
    setDrawer(id);
    requestAnimationFrame(() => {
      const target = (focus && document.getElementById(focus)) || document.getElementById(`${PLAY_DRAWER_ID}-title`);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'nearest' });
    });
  };
  const toggleDrawer = (id: DrawerId) => {
    if (drawer === id) setDrawer(null);
    else openDrawer(id);
  };
  const closeOverlayDrawer = () => {
    if (!drawerDocked()) setDrawer(null);
  };
  const goToRollHistory = () => openDrawer('history', 'play-roll-log-title');
  const openCharacterSection = (section: CharacterSection) => {
    openDrawer('character');
    requestAnimationFrame(() => document.dispatchEvent(new CustomEvent(CHARACTER_SECTION_EVENT, { detail: section })));
  };
  const openCharacterCreator = () => {
    setDrawer(null);
    setCharacterView('create');
  };
  const finishCharacterWorkspace = () => {
    setCharacterView(null);
    if (needsCharacterSetup) {
      finishCharacterSetup();
      focusStage(active);
    } else openCharacterSection('sheet');
  };
  const backFromCharacterWorkspace = () => {
    setCharacterView(null);
    if (!needsCharacterSetup) openDrawer('character');
  };
  const goToLevelUp = () => {
    closeOverlayDrawer();
    selectStage('wrapup');
    requestAnimationFrame(() => wrapUp.current?.open('advancement'));
  };
  useEffect(() => {
    // The character tab's shortcuts: record a level-up, or use a learned ability in the current fight.
    const levelUp = () => goToLevelUp();
    const useAbility = () => { closeOverlayDrawer(); selectStage('combat'); };
    document.addEventListener(LEVEL_UP_EVENT, levelUp);
    document.addEventListener(USE_ABILITY_EVENT, useAbility);
    return () => {
      document.removeEventListener(LEVEL_UP_EVENT, levelUp);
      document.removeEventListener(USE_ABILITY_EVENT, useAbility);
    };
  });
  useEffect(() => {
    // A correction for a roll recorded inside the drawer (domain dice, gear) opens its pane.
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id === 'string') setDrawer(id.replace(`${PLAY_DRAWER_ID}-`, '') as DrawerId);
    };
    document.addEventListener(PLAY_DRAWER_EVENT, open);
    return () => document.removeEventListener(PLAY_DRAWER_EVENT, open);
  }, []);
  useEffect(() => {
    const node = bar.current;
    const root = desk.current;
    if (!node || !root || typeof ResizeObserver === 'undefined') return;
    const actions = root.querySelector<HTMLElement>('.play-action-bar');
    const observer = new ResizeObserver(() => {
      setDrawerModal(root.clientWidth < DOCKED_DRAWER_WIDTH);
      root.style.setProperty('--play-bar-h', `${node.offsetHeight}px`);
      // The next-action bar is fixed to the bottom on narrow desks; sticky footers sit above it.
      if (actions) root.style.setProperty('--play-action-h', `${actions.offsetHeight}px`);
    });
    observer.observe(node);
    observer.observe(root);
    if (actions) observer.observe(actions);
    return () => observer.disconnect();
  }, []);
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
    closeOverlayDrawer();
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
  const battleRewards = (outcome: BattleOutcome | null, creatureIds: string[], defeatedTargets?: DefeatedTarget[],
    savedXp?: number, includeInfluences = true) => {
    const kills = defeatedTargets?.map(({ creatureId }) => creatureId) ?? (outcome === 'victory' ? creatureIds : []);
    const creatures = kills.flatMap((id) => creatureById.get(id) ?? []);
    const bosses = creatures.filter(({ group }) => group === 'overseer').length;
    const regular = creatures.filter(({ group }) => group === 'creature').length;
    const extraInfluences = includeInfluences && !defeated ? effects.filter(({ id, roll }) => roll >= 81 && !!domain.extra[id]?.roll).length : 0;
    return { creatures, xp: savedXp ?? (bosses ? bosses * 200 : outcome === 'victory' && regular ? 50 : 0) + regular * extraInfluences * 10,
      lootRolls: creatures.reduce((total, entry) => total + creatureSpoilsTables(entry).length, 0), sanityRolls: bosses };
  };
  const previewBattleEnd = (outcome: FinishedCombatOutcome, creatures: CreatureRecord[], defeatedTargets?: DefeatedTarget[]): CombatOutcomePreview => {
    const before = battleRewards(combat.outcome, combat.creatureIds, combat.defeatedTargets, combat.victoryXp, false);
    const after = battleRewards(outcome, creatures.map(({ id }) => id), defeatedTargets);
    const expected = new Set(after.creatures.flatMap((creature, index) => [
      ...creatureSpoilsTables(creature).map((tableId) => `${combatId}:loot:${creature.id}:${index}:${tableId}`),
      ...(creature.group === 'overseer' ? [`${combatId}:sanity:${creature.id}:${index}`] : []),
    ]));
    const affected = (battleSheet[combatId] ?? []).filter(({ id }) =>
      id === `${combatId}:xp` ? before.xp !== after.xp
        : (id.startsWith(`${combatId}:loot:`) || id.startsWith(`${combatId}:sanity:`)) && !expected.has(id))
      .map((item) => ({
        text: item.text,
        posted: applied.some((receipt) => paperReceiptKey(receipt) === paperReceiptKey(item))
          || gear.ledger.entries.some(({ source }) => source === `${roomLedgerId}/${item.id}`),
      }));
    return { before, after, affected };
  };
  const endBattle = (creature: CreatureRecord, outcome: FinishedCombatOutcome, creatures: CreatureRecord[], defeatedTargets?: DefeatedTarget[], edit = false) => {
    if (combat.outcome === 'fled' || !!combat.outcome !== edit || combat.outcome === outcome) return;
    const creatureIds = creatures.map(({ id }) => id);
    const { xp } = battleRewards(outcome, creatureIds, defeatedTargets);
    const save = () => {
      changeBattle((prior) => ({ ...prior, primaryId: creature.id, outcome, creatureIds, defeatedTargets, victoryXp: xp }));
      if (outcome === 'victory' && combat.retreatId) {
        updateDomain({ retreats: (domain.retreats ?? []).filter(({ id }) => id !== combat.retreatId) });
      }
    };
    if (edit) draft.commitRoll(save, playAction(`전투 결과 수정 · ${outcome === 'victory' ? '승리' : '전투 종료'}`), `combat/${encodeURIComponent(combatId)}/`);
    else save();
    setWrapId(combatId);
    goTo('wrapup');
  };
  const flee = (creatures: CreatureRecord[], participants = creatures) => {
    const id = combat.retreatId ?? `${roomNumber}-${combatId}`;
    const prior = domain.retreats?.find((retreat) => retreat.id === id);
    const place = placeName.trim() || paperId || prior?.place || `장소 ${roomNumber}`;
    const creatureIds = creatures.map((creature) => creature.id);
    const area = exploration?.area ?? prior?.origin?.area;
    const origin = { area, paperId: paperId ?? prior?.origin?.paperId };
    const retreat = { id, place, creatureIds, kind: combat.kind, origin };
    updateDomain({ retreats: [...(domain.retreats ?? []).filter((item) => item.id !== id), ...(creatureIds.length ? [retreat] : [])] });
    changeBattle((battle) => ({ ...battle, outcome: 'fled', creatureIds: participants.map(({ id }) => id), retreatId: id }));
    if (!placeName.trim()) setPlaceName(place);
    goTo('journal');
  };
  const reenter = (retreat: RetreatedEncounter) => {
    const pending = Object.entries(battles).find(([, battle]) => battle.retreatId === retreat.id && !battle.outcome);
    if (pending) {
      setCombatId(pending[0]);
      goTo('combat');
      return;
    }
    resetRoom(storeDomain(true), domain.id, carryTension, { retreat });
  };
  const openReturnBattle = (retreat: RetreatedEncounter) => {
    if (!returnBattle) setBattles((previous) => ({ ...previous, [RETREAT_BATTLE_ID]: {
      ...BASE_BATTLE, kind: retreat.kind, retreatId: retreat.id,
      seed: { creatureIds: retreat.creatureIds, description: '재진입 · 적 Health 전부 회복' },
    } }));
    setCombatId(RETREAT_BATTLE_ID);
    goTo('combat');
  };
  const openTrader = () => {
    selectStage('wrapup');
    wrapUp.current?.open('equipment');
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
  const openInventory = () => openDrawer('gear');
  const saveCustomSets = (sets: EncounterSet[]) => {
    setCustomSets(sets);
    storeEncounterLibrary(sets, campaignId);
  };

  const exploreTension = tensionSides(exploration?.nextTension);
  const confirmedTension = tensionSides(nextTension) ?? breatherTension ?? exploreTension;
  const carryTension = confirmedTension ?? initialTension;
  const resetReports = () => {
    stagePositions.current = {};
    lastRollField.current = {};
    setSessionEditing(false);
    setRevision((previous) => previous + 1);
    setConfirmReset(false);
    setExploration(null);
    setRequiredRestRolls([]);
    setWrapSummary('');
    setSheetShared([]);
    setEquipmentReport('');
    setEquipmentSheet([]);
    setAdvancementReport('');
    setAdvancementSheet([]);
    setXpSpent(0);
    setDarkness(null);
    setActionDarkness([]);
    setBreatherDarkness(null);
    setBreatherTension(null);
  };
  const resetRoom = (nextDomains: PlayDomainRecord[], nextDomain: number, tension: TensionSides,
    { discard = false, retreat }: { discard?: boolean; retreat?: RetreatedEncounter } = {}) => {
    if (!discard && requiredMoveRolls.length) {
      closeOverlayDrawer();
      setMoveBlocked(true);
      requestAnimationFrame(() => {
        moveWarning.current?.focus({ preventScroll: true });
        moveWarning.current?.scrollIntoView({ block: 'center' });
      });
      return;
    }
    // Moving on folds this place's XP and Exhaustion into the character; clearing the place drops them.
    const carry = !discard;
    const saved = draft.slots[PLAY_CHARACTER_SLOT];
    const character = isPlayCharacter(saved) && carry ? foldRoomProgress(saved, progress) : saved;
    const light = carry ? carryPlayLight(draft.slots, sheet) : readPlayLight(draft.slots);
    const nextTimeline = carry ? archiveCurrentPlace() : timeline;
    draft.replaceRoom({ domains: nextDomains, domainId: nextDomain, roomNumber: roomNumber + 1,
      roomLedgerId: crypto.randomUUID(), initialTension: tension, [SKILL_GROWTH_SLOT]: pendingGrowth,
      [PAPER_MAP_SLOT]: archiveMapClueSources(paperMap, draft.slots, discard), [PLAY_TIMELINE_SLOT]: nextTimeline, [PLAY_EFFECTS_SLOT]: ongoing,
      [PLAY_PENDING_ROLLS_SLOT]: pendingRolls, [SKILL_PRESETS_SLOT]: draft.slots[SKILL_PRESETS_SLOT] ?? {},
      [PLAY_LIGHT_SLOT]: light && { remaining: light.remaining, included: [] },
      [PLAY_SESSION_SLOT]: carrySessionIntent(session),
      [LINGERING_ENTRY_SLOT]: carry ? ongoing.conditions : draft.slots[LINGERING_ENTRY_SLOT] ?? [],
      ...(character ? { [PLAY_CHARACTER_SLOT]: character } : {}),
      ...(retreat ? {
        [RETREAT_RETURN_SLOT]: retreat.id, placeName: retreat.place, 'explore/revisit': true,
        'explore/place-choice': retreat.origin?.area ?? 'room',
        ...(retreat.origin?.paperId ? { 'explore/paper-map-key': paperMapKey(retreat.origin.paperId) } : {}),
      } : {}) });
    closeOverlayDrawer();
    resetReports();
    focusStage('explore');
  };
  const restoreCheckpoint = async ({ slots, history, encounters, gear: ledger }: PlayCheckpointData) => {
    if (!await gear.change(() => ({ ledger }))) return false;
    saveCustomSets(encounters);
    draft.replaceRoom(slots, history);
    resetReports();
    closeOverlayDrawer();
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
    } else if (saved.some((target) => target.id === id && target.progress?.mode !== 'intro')) {
      resetRoom(saved, id, carryTension);
    }
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
  const damageRows: PaperChange[] = readCombatDamageRecords(draft.slots).map((record) => ({ id: `damage:${record.id}`, text: formatCombatDamage(record) }));
  const facts = [
    { label: '장소', value: [placeName.trim(), exploration?.shape ?? exploration?.place].filter(Boolean).join(' · ') },
    { label: '환경 묘사', value: exploration?.description },
    { label: '짙어지는 어둠', value: exploration?.darkness },
    { label: '이벤트', value: exploration?.event },
    { label: '조우', value: exploration?.encounter && !fightFacts.length ? ENCOUNTER_LABELS[exploration.encounter] : null },
    { label: '적', value: fightFacts.join(' / ') },
    { label: '전투 피해', value: damageRows.map(({ text }) => text).join(' / ') },
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
  const characterLogSlot = draft.slots[CHARACTER_LOG_SLOT];
  const characterLog: PaperChange[] = Array.isArray(characterLogSlot) ? characterLogSlot.filter((item): item is PaperChange =>
    !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.text === 'string') : [];
  const sheet: PaperChange[] = [
    ...(introStart && domain.progress?.mode === 'intro' ? [
      { id: 'intro-start:damage', text: `피해 ${introStart.damage} (도입 도메인 시작)` },
      { id: 'intro-start:sanity', text: `Sanity −${introStart.sanity} (도입 도메인 시작)` },
      { id: 'intro-start:exhaustion', text: 'Exhaustion +1 (도입 도메인 시작)' },
    ] : []),
    ...(exploration?.sheet ?? []),
    ...completedBattles.flatMap(([id]) => battleSheet[id] ?? []),
    ...sheetShared,
    ...equipmentSheet,
    ...advancementSheet,
    ...ongoingChanges,
    ...damageRows,
    ...Object.entries(masterySheet).flatMap(([id, items]) => items.map((item) => ({ ...item, id: `${id}:${item.id}` }))),
    ...characterLog,
  ];
  const savedCharacter = draft.slots[PLAY_CHARACTER_SLOT];
  const pcRecord = isPlayCharacter(savedCharacter) ? savedCharacter : undefined;
  const pcMadness = madnessEffects(pcRecord?.madness);
  const defeatedForGoals = Object.values(battles).flatMap((battle) => battle.defeatedTargets ?? []).flatMap(({ creatureId }) => {
    const creature = creatureById.get(creatureId);
    return creature ? [{ types: creature.types, overseer: creature.group === 'overseer' }] : [];
  });
  const baselineGoals = goalCounts({ defeated: defeatedForGoals, sheet,
    darkness: (darkness !== null ? 1 : 0) + actionDarkness.length + (breatherDarkness !== null ? 1 : 0) });
  const priorSurvivor = (draft.slots[SURVIVOR_BASELINE_SLOT] as SurvivorBaseline | undefined) ?? undefined;
  const olderLines = new Set(priorSurvivor?.lineIds);
  const progress = {
    ...roomProgress(sheet.filter(({ id }) => !olderLines.has(id)), Math.max(0, xpSpent - (priorSurvivor?.xpSpent ?? 0)), {
      xpLoss: pcMadness.xpLoss, extraSanityLoss: pcMadness.extraSanityLoss,
      goals: Object.fromEntries(Object.entries(baselineGoals).map(([key, value]) => [key, Math.max(0, value - (priorSurvivor?.goals[key] ?? 0))])),
      madnessTiming: draft.slots[MADNESS_TIMING_SLOT] as MadnessTiming[] | undefined,
    }),
    baseline: { lineIds: [...new Set(sheet.map(({ id }) => id))], xpSpent, goals: baselineGoals },
    priorSurvivor,
  };
  const pcNow = pcRecord ? currentProgress(pcRecord, progress) : null;
  type Alert = { id: string; label: string; level: string; icon: StatusKind; onClick: () => void };
  const characterAlerts: Alert[] = [
    ...ongoing.conditions.map((id) => {
      const label = LINGERING_CONDITIONS.find((item) => item.id === id)?.label ?? id;
      const level = id !== 'burning' && (ongoing.levels?.[id] ?? 1) > 1 ? ` ${ongoing.levels?.[id]}` : '';
      return { id, label: `${label}${level}`, level: 'danger', icon: id, onClick: () => openDrawer('ongoing') };
    }),
    ...(!pcNow ? [] : [
      ...((pcNow.exhaustion ?? 0) >= 21 || pcMadness.dead || pcRecord?.rotStage === 8
        ? [{ id: 'dead', label: '사망 확인', level: 'danger', icon: 'death' as const, onClick: () => openCharacterSection('state') }] : []),
      ...(pcNow.sanity === 0 ? [{ id: 'madness', label: 'Sanity 0 · 광기', level: 'danger', icon: 'madness' as const, onClick: () => openCharacterSection('state') }] : []),
      ...(pcNow.exhaustion !== undefined && pcNow.exhaustion >= 11 && pcNow.exhaustion <= 20
        ? [{ id: 'exhaustion', label: pcNow.exhaustion >= 16 ? `Exh ${pcNow.exhaustion} · 판정 불리` : `Exh ${pcNow.exhaustion} · 회복 절반`,
          level: pcNow.exhaustion >= 16 ? 'danger' : 'warn', icon: 'exhaustion' as const, onClick: () => openCharacterSection('state') }] : []),
      ...(pcNow.xp !== undefined && pcNow.xp >= XP_TO_LEVEL ? [{ id: 'level', label: '레벨업 가능', level: 'good', icon: 'level' as const, onClick: goToLevelUp }] : []),
    ]),
  ];
  const supplies = playSupplies(gear.ledger, sheet, roomLedgerId);
  const tracksLight = readPlayLight(draft.slots) !== null;
  const postedGear = roomLedgerId ? gear.ledger.entries.flatMap((entry) => {
    const prefix = `${roomLedgerId}/`;
    return entry.source?.startsWith(prefix) && !isQuickUseEntry(entry, roomLedgerId)
      ? [{ id: entry.source.slice(prefix.length), text: entry.reason }] : [];
  }) : [];
  const postedGearIds = new Set(postedGear.map(({ id }) => id));
  const gearChanges = sheet.filter(({ id, gear: item }) => item && (!tracksLight || item.kind !== 'count'
    || gearKey(item.name) !== '광원' || postedGearIds.has(id)));
  const paperCommitted = applied.length > 0 || postedGear.length > 0;
  const paperId = paperMap.find((record) => record.domainId === domainId && paperMapKey(record.paperId) === draft.slots['explore/paper-map-key'])?.paperId;
  const appliedKeys = applied.map(paperReceiptKey);
  const unapplied = sheet.filter(({ id, text }) => !appliedKeys.includes(`${id}:${text}`)).length;
  const pause = session.pause?.roomId === roomLedgerId ? session.pause : null;
  const sessionVisible = !showCharacterWorkspace && (sessionEditing || !!pause || !!session.nextIntent);
  const sessionPlace = [domain.name.trim() || `도메인 ${domain.id}`, placeName.trim() || (!paperId ? `장소 ${roomNumber}` : ''),
    paperId && `지도 ${paperId}`].filter(Boolean).join(' · ');
  const lastRoll = draft.history.filter((entry) => !entry.action).at(-1);
  const confirmedFact = facts.find(({ label }) =>
    label === (active === 'combat' ? '적' : active === 'wrapup' ? '휴식·전리품' : '탐험 행동')) ?? facts.find(({ label }) => label === '이벤트');
  const sessionFacts = [confirmedFact?.value && `${confirmedFact.label} · ${confirmedFact.value}`,
    lastRoll && `${lastRoll.label} · ${lastRoll.dice} ${lastRoll.value}`].flatMap((line) => line ? [shortSessionText(line, 148)] : []);
  const savePause = (intent: string) => {
    if (!roomLedgerId) return;
    setSession({ pause: { roomId: roomLedgerId, at: Date.now(), place: shortSessionText(sessionPlace, 100),
      intent: shortSessionText(intent, SESSION_INTENT_LIMIT), facts: sessionFacts, point: readPlaySessionPoint(active, lastRollField.current[active]) } });
    setSessionEditing(false);
  };
  const resumeSession = ({ point }: SessionPause) => {
    setSession(carrySessionIntent(session));
    if (point.field) goToRecordedField(point, (focused) => { if (!focused) focusNextPlayAction(point.stage); });
    else {
      closeOverlayDrawer();
      selectStage(point.stage);
      requestAnimationFrame(() => focusNextPlayAction(point.stage));
    }
  };
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
  const archiveCurrentPlace = () => {
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
    return appendPlayTimeline(timeline, entry);
  };
  const nextLocation = () => resetRoom(storeDomain(true), domain.id, carryTension);

  const stageHeading = (id: StageId) => (
    // The stage tabs already name the stage; the heading stays for screen readers and as the focus target.
    <h2 id={`play-${id}`} className="play-stage-heading sr-only" tabIndex={-1} ref={(node) => {
      if (node) headings.current[id] = node;
    }}>{STAGES.find((entry) => entry.id === id)?.heading}</h2>
  );

  const activeOngoing = ongoing.conditions.length + ongoing.abilities.length;
  const characterLevel = (draft.slots[PLAY_CHARACTER_SLOT] as PlayCharacterRecord | undefined)?.level;
  const drawerTabs: DrawerTab<DrawerId>[] = [
    { id: 'character', label: '캐릭터', title: '캐릭터 기본값', badge: characterLevel ? `Lv${characterLevel}` : undefined,
      content: characterView !== 'sheet' && <PlayCharacter onCreate={openCharacterCreator} /> },
    { id: 'history', label: '이력', title: '굴림 이력', badge: draft.history.length || undefined,
      content: <PlayRollHistory key={revision} paperCommitted={paperCommitted} onCorrection={goToRecordedField} /> },
    { id: 'gear', label: '장비', title: '장비 장부', badge: gear.ledger.items.length || undefined,
      content: <PlayInventory state={gear} changes={gearChanges} roomId={roomLedgerId} /> },
    { id: 'ongoing', label: '상태', title: '이어지는 상태·능력', badge: activeOngoing || undefined, content: <PlayOngoingEffects /> },
    { id: 'pending', label: '보류', title: '보류한 굴림', badge: pendingRolls.length || undefined,
      content: <PlayPendingRolls open={drawer === 'pending'} stage={active} roomId={roomLedgerId} wrapBattleId={wrapId}
        place={`${domain.name.trim() || `도메인 ${domain.id}`} · ${placeName.trim() || paperId || `장소 ${roomNumber}`}`}
        rolls={pendingRolls} onChange={setPendingRolls} onJump={(roll, after) => {
          if (roll.wrapBattleId) {
            const outcome = battles[roll.wrapBattleId]?.outcome;
            if (!outcome || outcome === 'fled') { after(false); return; }
            setWrapId(roll.wrapBattleId);
          }
          goToRecordedField(roll, after);
        }} /> },
    { id: 'domain', label: '도메인', title: domain.name.trim() || `도메인 ${domain.id}`, badge: effects.length || undefined,
      content: <PlayDomain key={domain.id} domain={domain} domains={domains} activeEffects={effects} defeated={defeated} domainPlaceId={String(roomNumber)}
        overseerKnown={overseerKnown} onRevealOverseer={revealOverseer}
        onUpdate={updateDomain} onSwitch={switchDomain} onDismiss={(id) => setDismissed((old) => [...old, id])}
        timeline={timeline} onTimelineChange={setTimeline} /> },
    { id: 'save', label: '저장', title: '플레이 저장·이어하기', flag: needsBackup ? '백업 필요' : undefined,
      content: <PlayCheckpoints data={{ slots: draft.slots, gear: gear.ledger, encounters: customSets, history: draft.history }}
        place={placeName.trim() || paperId || `장소 ${roomNumber}`} stage={stage.label} onRestore={restoreCheckpoint}
        currentLight={lightRemaining(readPlayLight(draft.slots), supplies.lightEntries)}
        onNeedsBackup={setNeedsBackup} /> },
    { id: 'tool', label: '도구', title: '고정 도구', content: <PlayPinnedTool /> },
  ];

  return (
    <CharacterRoomContext.Provider value={progress}>
    <PlayDiscoveryMode.Provider value={discovery}>
    <div className="play-desk" ref={desk} data-physical-first={physicalFirst || undefined} data-drawer={drawer ?? undefined}
      data-character-workspace={showCharacterWorkspace || undefined}
      onKeyDownCapture={advanceDiceFocus} onFocusCapture={({ target }) => {
        if (target instanceof HTMLInputElement && target.dataset.playRollField && target.closest('.play-stage')) {
          lastRollField.current[active] = target.dataset.playRollField;
        }
      }}>
      <header className="play-header">
        <h1>플레이 모드</h1>
        {campaignSelector}
        <div className="play-header-actions">
          <PlayPopover className="play-view-menu" label="보기 설정" bodyLabel="보기 설정" align="end"
            trigger={<>보기{(physicalFirst || focusMode || keepAwake || discovery) && <span className="play-tray-badge">
              {[physicalFirst, focusMode, keepAwake, discovery].filter(Boolean).length}</span>}</>}>
            <div className="play-header-toggles">
              <button className="play-toggle" type="button" aria-pressed={physicalFirst} onClick={togglePhysicalFirst}>실물 입력 우선</button>
              <button className="play-toggle" type="button" aria-pressed={focusMode} onClick={toggleFocusMode}>집중 보기</button>
              <button className="play-toggle" type="button" aria-pressed={discovery} onClick={toggleDiscovery}>발견 모드</button>
              {wakeLockSupported() && <button className="play-toggle" type="button" aria-pressed={keepAwake}
                title={keepAwake && !screenAwake ? '브라우저가 화면 켜 두기를 허용하지 않았습니다.' : undefined}
                onClick={toggleKeepAwake}>화면 켜 두기</button>}
            </div>
          </PlayPopover>
          {!showCharacterWorkspace && <button className="btn ghost" type="button" ref={sessionButton} aria-expanded={sessionEditing || !!pause}
            aria-controls={sessionVisible ? sessionId : undefined} onClick={() => setSessionEditing(true)}>오늘 여기까지</button>}
          {!showCharacterWorkspace && <button className="btn ghost play-reset-toggle" type="button" aria-expanded={confirmReset} aria-controls="play-reset"
            onClick={() => setConfirmReset((open) => !open)}>이번 장소 지우기</button>}
        </div>
      </header>
      {sessionVisible && <PlaySessionPanel id={sessionId} editing={sessionEditing} pause={pause} nextIntent={session.nextIntent} place={sessionPlace} facts={sessionFacts}
        onPause={savePause} onResume={resumeSession} onEdit={() => setSessionEditing(true)}
        onComplete={() => { setSession(EMPTY_SESSION); requestAnimationFrame(() => sessionButton.current?.focus({ preventScroll: true })); }}
        onClose={() => { setSessionEditing(false); sessionButton.current?.focus({ preventScroll: true }); }} />}
      {showCharacterWorkspace && <PlayCharacterWorkspace onboarding={needsCharacterSetup} view={characterView}
        onView={setCharacterView} onBack={backFromCharacterWorkspace} onFinish={finishCharacterWorkspace} onApplyGear={applyStartingGear} onUndoGear={undoGearGrant} />}
      {confirmReset && (
        <div className="play-reset" id="play-reset" role="group" aria-label="새 장소 확인">
          <p>이번 장소의 입력과 굴림 결과를 저널에 남기지 않고 지웁니다. 기록을 남기고 넘어가려면 저널의 다음 장소를 누르세요.</p>
          <button className="btn primary" type="button" onClick={() => resetRoom(storeDomain(false), domain.id, initialTension, { discard: true })}>지우고 새로 시작</button>
          <button className="btn ghost" type="button" onClick={() => setConfirmReset(false)}>취소</button>
        </div>
      )}
      <div className="play-bar" ref={bar}>
        <nav className="play-nav" aria-label="플레이 단계">
          {STAGES.map(({ id, label }) => (
            <button key={id} type="button" aria-current={id === active ? 'step' : undefined}
              aria-controls={`play-stage-${id}`} onClick={() => goTo(id, true)}>{label}</button>
          ))}
        </nav>
        <div className="play-tray" role="group" aria-label="플레이 서랍">
          {drawerTabs.map(({ id, label, badge, flag }) => (
            <button key={id} type="button" className="play-tray-item" aria-expanded={drawer === id} aria-controls={PLAY_DRAWER_ID}
              onClick={() => toggleDrawer(id)}><DrawerTabLabel label={label} badge={badge} flag={flag} /></button>
          ))}
          <button type="button" className="play-tray-all" aria-expanded={drawer !== null} aria-controls={PLAY_DRAWER_ID}
            onClick={() => drawer ? setDrawer(null) : openDrawer('history')}>
            <DrawerTabLabel label="장부" flag={needsBackup ? '백업 필요' : undefined} />
          </button>
        </div>
        {characterAlerts.length > 0 && <div className="play-alerts" role="group" aria-label="캐릭터 경고">
          {characterAlerts.map(({ id, label, level, icon, onClick }) => <button key={id} type="button" className="play-alert-chip" data-level={level}
            onClick={onClick}><StatusIcon kind={icon} />{label}</button>)}
        </div>}
      </div>

      <div className="play-layout">
        <div className="play-main">
          {requiredMoveRolls.length > 0 && (active === 'journal' || moveBlocked) && (
            <section className="play-reset play-move-warning" aria-label="이동 전에 마칠 판정" ref={moveWarning} tabIndex={-1}>
              <h3>이동 전에 마칠 판정</h3>
              <p>이미 시작한 행동의 남은 굴림을 입력한 뒤 이동할 수 있습니다.</p>
              <div className="play-header-actions">
                {requiredMoveRolls.map(({ field, label, stage: targetStage }) => <button key={field} type="button" className="btn ghost" onClick={() => {
                  setMoveBlocked(false);
                  goToRecordedField({ stage: targetStage, field });
                }}>{label}</button>)}
              </div>
            </section>
          )}
          <section className="play-stage" id="play-stage-explore" aria-labelledby="play-explore" hidden={active !== 'explore'}>
            {stageHeading('explore')}
            <EffectNotice effects={effects} types={EXPLORE_EFFECTS} />
            {domain.progress?.mode === 'intro' && <PlayDraftScope name="intro-domain">
              <PlayIntroDomain opening={domain.id === 1 && roomNumber === 1} recorded={introStart} onRecord={setIntroStart} />
            </PlayDraftScope>}
            {retreatDestinations.length > 0 && (
              <section className="play-reentries" aria-label="후퇴했던 장소">
                <h3>후퇴했던 장소</h3>
                <ul>
                  {retreatDestinations.map((retreat) => <li key={retreat.id}>
                    <div><strong>{retreat.place}</strong><p>{retreat.creatureIds.map((id) => creatureById.get(id)?.name).filter(Boolean).join(' · ')}</p></div>
                    <button className="btn ghost" type="button" onClick={() => reenter(retreat)} aria-label={`${retreat.place} 재진입`}>재진입</button>
                  </li>)}
                </ul>
              </section>
            )}
            <PlayDraftScope name="explore">
              <PlayExploration key={revision} actionsRef={explorationActions} onReport={setExploration} onCombat={startCombat} onWrapUp={() => goTo('wrapup')} onJournal={() => goTo('journal')}
                finishedSources={finishedSources} initialTension={initialTension} lightCost={previousEffects.some(({ roll }) => roll === 69 || roll === 70) ? 2 : 1}
                supplies={supplies} gearLedger={gear.ledger} onOpenGear={openInventory}
                onDarknessChange={setDarkness} onActionDarknessChange={setActionDarkness}
                darknessEffectCount={previousEffects.length} onTrader={openTrader}
                domainProgress={domain.progress} onDomainProgress={(progress) => updateDomain({ progress })}
                domainPlaceId={String(roomNumber)} domainPlaceName={placeName} domainDefeated={defeated}
                paperMapDomain={domainId} paperMap={paperMap} onPaperMapChange={setPaperMap}
                domainDestinations={domains.filter((target) => target.id !== domain.id && target.progress?.mode !== 'intro')}
                retreatArrival={returnVisit ? {
                  place: returnRetreat?.place ?? placeName, areaKnown: !!returnRetreat?.origin?.area || !!returnBattle,
                  kind: returnRetreat?.kind ?? returnBattle?.kind ?? 'encounter', ambush: returnAmbush,
                  started: !!returnBattle, outcome: returnBattle?.outcome ?? null,
                  onCombat: () => { if (returnRetreat) openReturnBattle(returnRetreat); },
                } : undefined}
                onLeaveDomain={switchDomain} />
            </PlayDraftScope>
          </section>
          <section className="play-stage" id="play-stage-combat" aria-labelledby="play-combat" hidden={active !== 'combat'}>
            {stageHeading('combat')}
            <EffectNotice effects={effects} types={COMBAT_EFFECTS} influence={influence} />
            {returnRetreat && !battles[combatId] ? <div className="play-explore-next">
              <p>{returnRetreat.place}에 들어가는 판정을 마치면 남아 있던 적과 조우할 수 있습니다.</p>
              <button type="button" className="btn primary" onClick={() => goTo('explore')}>재진입 입장 판정으로</button>
            </div> : <PlayDraftScope name="combat">
              <PlayDraftScope name={combatId}>
                <PlayCombat key={`${revision}:${combatId}`} initialKind={combat.kind} domainOverseer={overseer ?? null}
                  domainOverseerKnown={overseerKnown} onRevealDomainOverseer={revealOverseer}
                  customSets={customSets} customSetId={domain.encounterSetId}
                  onCustomSetSelect={(encounterSetId) => updateDomain({ encounterSetId })} onCustomSetsChange={saveCustomSets}
                  seed={combat.seed} fled={combat.outcome === 'fled'} finished={!!combat.outcome} onFlee={flee}
                  currentOutcome={combat.outcome === 'victory' || combat.outcome === 'ended' ? combat.outcome : undefined}
                  onPreviewBattleEnd={previewBattleEnd}
                  onNewEncounter={() => startCombat('encounter', `manual-${crypto.randomUUID()}`)}
                  bestiaryCreatureId={bestiaryCreature} onCloseBestiaryRequest={closeBestiaryRequest}
                  belt={gear.ledger.items.filter(({ count, location }) => location === 'belt' && count > 0)} onOpenBelt={openInventory}
                  onMasterySheetChange={reportMasterySheet} onMasteryJournalChange={reportMasteryLine}
                  onCreatureChange={chooseCreature} onTargetsChange={reportTargets} onBattleEnd={endBattle} />
              </PlayDraftScope>
            </PlayDraftScope>}
          </section>
          <section className="play-stage" id="play-stage-wrapup" aria-labelledby="play-wrapup" hidden={active !== 'wrapup'}>
            {stageHeading('wrapup')}
            <ExhaustionHealNote />
            <EffectNotice effects={effects} types={REST_EFFECTS} />
            {completedBattles.length > 1 && (
              <label className="field play-wrap-battle"><span>정리할 전투</span>
                <select value={wrapId} onChange={(event) => setWrapId(event.target.value)}>
                  {completedBattles.map(([id, battle]) => <option key={id} value={id}>{battle.planKey ? '야영 · ' : ''}{battleLabel(id, battle)}</option>)}
                </select>
              </label>
            )}
            <PlayDraftScope name="wrap">
              <PlayWrapUp key={revision} handleRef={wrapUp} creature={roster?.[0] ?? null} victoryCreatures={roster}
                inventory={gear.ledger.items}
                supplies={supplies} nextRoomLightCost={effects.some(({ roll }) => roll === 69 || roll === 70) ? 2 : 1}
                onContinue={() => goTo('journal')} onOpenGear={openInventory}
                victoryLabels={victoryLabels} victoryXp={victoryXp}
                battleId={wrapId} combatEnded={!!wrapBattle?.outcome && wrapBattle.outcome !== 'fled'}
                onCampEncounter={startCampEncounter} campEncounterResolved={campEncounterResolved}
                campDarkness={hasEffect(17)} campAttunementBlocked={hasEffect(19)}
                afterBreatherCheck={hasEffect(15)} breatherTension={exploreTension ?? initialTension}
                breatherDarknessEffectCount={preBreatherEffects.length}
                onBreatherTensionChange={setBreatherTension} onBreatherDarknessChange={setBreatherDarkness}
                onRequiredRolls={setRequiredRestRolls}
                onBreatherAmbush={() => startCombat('encounter', 'breather')}
                onJournalChange={setWrapSummary} onBattleJournalChange={reportBattleLine} onSheetChange={reportSheet}
                extraPanes={[
                  { id: 'equipment', label: '소지칸·상인', content: <PlayDraftScope root name="equipment">
                    <PlayEquipment key={`equipment-${revision}`} inventory={gear.ledger.items} onSheetChange={setEquipmentSheet} onJournalChange={setEquipmentReport} />
                  </PlayDraftScope> },
                  { id: 'advancement', label: 'XP·레벨업', content: <PlayDraftScope root name="advancement">
                    <PlayAdvancement key={`advancement-${revision}`} onSheetChange={setAdvancementSheet} onJournalChange={setAdvancementReport}
                      onXpSpent={setXpSpent} />
                  </PlayDraftScope> },
                ]} />
            </PlayDraftScope>
            {wrapBattle?.outcome && wrapBattle.outcome !== 'fled' && exploration?.area && exploreTension && (
              <ExplorationActionLinks room={exploration.area === 'room'} label="이 장소 탐험 계속" onSelect={(action) => {
                selectStage('explore');
                explorationActions.current?.open(action);
              }} />
            )}
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
              {gearChanges.length > 0 && <button className="btn ghost play-stage-next" type="button" aria-expanded={drawer === 'gear'}
                aria-controls={PLAY_DRAWER_ID} onClick={openInventory}>장비 장부에서 변경 확인</button>}
              {journal ? <>
                <div className="play-journal-output">
                  <h3>저널에 옮길 내용</h3>
                  <p>{journal}</p>
                  <label className="play-paper-copied"><input type="checkbox" checked={journalCopiedText === journal}
                    onChange={(event) => setJournalCopiedText(event.currentTarget.checked ? journal : '')} />종이 저널에 옮김</label>
                </div>
                {/* Stays at the bottom of the screen while the checklist above is reviewed, so moving on never needs a scroll. */}
                <div className="play-journal-advance">
                  <div className="play-header-actions">
                    <CopyButton text={journal} label="장소 기록 복사" />
                    <button className="btn primary" type="button" data-play-next="" onClick={nextLocation}>다음 장소</button>
                  </div>
                  <p className="play-carry">다음 장소는 긴장 주사위 D{carryTension}{carryTension === 6 ? '으로' : '로'} 시작합니다.
                    {unapplied > 0 && <span className="play-carry-warn"> 시트에 옮기지 않은 항목 {unapplied}개</span>}</p>
                </div>
              </> : <p className="play-empty">도구에서 굴림이나 결과를 확인하면 여기에 모입니다.</p>}
            </div>
          </section>
        </div>
        <aside className="play-context" aria-label="플레이 중 참고">
          <PlayActionBar stage={active} onHistory={goToRollHistory} />
          <PlayDrawer tabs={drawerTabs} active={showCharacterWorkspace ? null : drawer} modal={drawerModal} onSelect={(id) => openDrawer(id)} onClose={() => {
            const opener = drawer && document.querySelector<HTMLElement>(`.play-tray-item[aria-expanded="true"]`);
            setDrawer(null);
            requestAnimationFrame(() => (opener?.getClientRects().length ? opener : document.querySelector<HTMLElement>('.play-tray-all'))?.focus({ preventScroll: true }));
          }} />
          <section className="play-context-facts">
            <h2>이번 장소</h2>
            {facts.length ? (
              <dl className="play-facts">
                {facts.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
            ) : <p className="play-empty">확인한 장소와 결과가 여기에 표시됩니다.</p>}
          </section>
          {stage.references.length > 0 && <section className="play-context-refs">
            <h2>현재 단계의 규칙</h2>
            <div className="play-refs">{stage.references.map((id) => <XRef key={id} id={id} />)}</div>
          </section>}
        </aside>
      </div>
    </div>
    </PlayDiscoveryMode.Provider>
    </CharacterRoomContext.Provider>
  );
}
