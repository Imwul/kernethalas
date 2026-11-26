import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { tableById } from '../../content';
import { creatureById } from '../../content/entries/creatures';
import type { OracleTable } from '../../content/schema';
import { ENCOUNTER_PLACES, encounterRowsForPlace, roomShapeForRoll, type EncounterPlace } from '../../content/tables/exploration';
import type { CheckOutcome } from '../../lib/dice';
import { DEFAULT_DOMAIN_PROGRESS, domainPlaceLabel, introEncounterCreature, markDomainPlace, removeDomainMark, stepDomainDie, type DomainProgress } from '../../lib/domain-progress';
import { RETREAT_AMBUSH_ID } from '../../lib/play-domain';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraft, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { LINGERING_RECORDED_SLOT } from '../../lib/play-effects';
import { capturePaperMapTile, paperMapKey, type PaperMapDoorReport, type PaperMapLocation } from '../../lib/paper-map';
import { gearCount, type GearLedger } from '../../lib/play-inventory';
import { EMPTY_SUPPLIES, afterLightCost, lightRemaining, readPlayLight, type PlaySupplies } from '../../lib/play-light';
import { rowTitle } from '../../lib/oracle';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
import { PhysicalSkillRoll } from '../PhysicalSkillRoll';
import type { RoomShapeState } from '../RoomShapeDiagram';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { CHARACTER_LOG_SLOT } from './PlayExhaustion';
import { LingeringEntryAlert, recordedRoomDamage } from './PlayLingering';
import { PlayLight } from './PlayLight';
import { EMPTY_FOLLOW_UP, ExplorationFollowUp } from './ExplorationFollowUp';
import { PlayDomainExit, PlayDomainProgress, type DomainDestination } from './PlayDomainProgress';
import { PlayExplorationActions, type ActionSheetItem, type ExplorationActionReport, type ExplorationActionsHandle } from './PlayExplorationActions';
import { PlayRoll } from './PlayRoll';
import { PlayStrip, PlayStripPane } from './PlayPanels';
import { PlayPaperMap, type PlayPaperMapHandle } from './PlayPaperMap';
import { PlayFinishedStep } from './PlayFocus';
import { EMPTY_ROOM_SHAPE, PlayTileControls } from './PlayTileControls';
import '../../styles/play-exploration.css';

export interface ExplorationReport {
  area: EncounterPlace | null;
  place: string | null;
  shape: string | null;
  description: string | null;
  nextTension: string | null;
  darkness: string | null;
  event: string | null;
  encounter: 'encounter' | 'overseer' | 'none' | null;
  actions?: string;
  sheet?: ActionSheetItem[];
}

interface Props {
  actionsRef: RefObject<ExplorationActionsHandle | null>;
  onReport: (report: ExplorationReport) => void;
  onCombat: (kind: 'encounter' | 'overseer', source?: string) => void;
  onWrapUp: () => void;
  onJournal?: () => void;
  finishedSources: string[];
  initialTension?: TensionDie;
  lightCost?: number;
  supplies?: PlaySupplies;
  onOpenGear?: () => void;
  onDarknessChange?: (roll: number | null) => void;
  onActionDarknessChange?: (rolls: number[]) => void;
  darknessEffectCount?: number;
  onTrader?: () => void;
  domainProgress?: DomainProgress;
  onDomainProgress?: (progress: DomainProgress) => void;
  domainPlaceId?: string;
  domainPlaceName?: string;
  domainDestinations?: DomainDestination[];
  domainDefeated?: boolean;
  onLeaveDomain?: (id: number | 'new') => void;
  paperMapDomain?: number;
  paperMap?: PaperMapLocation[];
  onPaperMapChange?: Dispatch<SetStateAction<PaperMapLocation[]>>;
  gearLedger?: GearLedger;
  retreatArrival?: {
    place: string;
    areaKnown: boolean;
    kind: 'encounter' | 'overseer';
    ambush: 'victory' | 'ended' | 'fled' | null;
    outcome: 'victory' | 'ended' | 'fled' | null;
    started: boolean;
    onCombat: () => void;
  };
}

const SHAPE_TABLE = tableById.get('t-room-shape')!;
// The description follow-on duplicates the description fold further down the step.
const PLAY_SHAPE_TABLE = { ...SHAPE_TABLE, notes: undefined, rows: SHAPE_TABLE.rows.map((row) => ({ ...row, next: undefined })) };
const ENCOUNTER_TABLE = tableById.get('t-encounter-check')!;
const EVENT_TABLE = tableById.get('t-events')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;
const PLACE_DESCRIPTIONS = {
  room: tableById.get('t-room-description')!,
  corridor: tableById.get('t-corridor-description')!,
};

const PLACE_LABELS = { shape: '모양으로 결정', room: '방', corridor: '통로' } as const;
type PlaceChoice = keyof typeof PLACE_LABELS;
type EntryLight = 'lit' | 'dark' | 'exempt';
type TileDraft = RoomShapeState & { roll: number };
const EMPTY_PAPER_MAP: PaperMapLocation[] = [];

function encounterTable(place: EncounterPlace): OracleTable {
  return {
    ...ENCOUNTER_TABLE,
    id: `play-encounter-check-${place}`,
    notes: undefined,
    columns: undefined,
    rows: encounterRowsForPlace(place).map(({ min, max, ko }) => ({ min, max, ko })),
  };
}

const PLAY_ENCOUNTERS = {
  room: encounterTable('room'),
  corridor: encounterTable('corridor'),
};

const EMPTY_ACTIONS: ExplorationActionReport = { text: '', sheet: [], nextTension: null, darknessRolls: [] };

export function PlayExploration({ actionsRef, onReport, onCombat, onWrapUp, onJournal, finishedSources, initialTension = 8, lightCost = 1, supplies = EMPTY_SUPPLIES, onOpenGear,
  onDarknessChange, onActionDarknessChange, darknessEffectCount, onTrader,
  domainProgress = DEFAULT_DOMAIN_PROGRESS, onDomainProgress, domainPlaceId = '1', domainPlaceName,
  domainDestinations, domainDefeated, onLeaveDomain, paperMapDomain = 1, paperMap = EMPTY_PAPER_MAP, onPaperMapChange, gearLedger, retreatArrival }: Props) {
  const paperMapRef = useRef<PlayPaperMapHandle>(null);
  const [revisit, setRevisit] = usePlayDraftState('revisit', false);
  const [choice, setChoice] = usePlayDraftState<PlaceChoice>('place-choice', 'shape');
  const [shapeRoll, setShapeRoll] = usePlayDraftState<number | null>('shape-roll', null);
  const [tileDraft, setTileDraft] = usePlayDraftState<TileDraft | null>('room-tile', null);
  const [tileOpen, setTileOpen] = useState(false);
  const [paperLocation, setPaperLocation] = usePlayDraftState('paper-map-key', '');
  const [resumeExit, setResumeExit] = usePlayDraftState('paper-map-resume-exit', '');
  const [descriptions, setDescriptions] = usePlayDraftState<Record<EncounterPlace, number | null>>('place-description', { room: null, corridor: null });
  const [lair, setLair] = usePlayDraftState('lair', false);
  const [arrival, setArrival] = usePlayDraftState<'lair' | 'exit' | null>('domain-arrival', null);
  const [fixedIntroRoom, setFixedIntroRoom] = usePlayDraftState('intro-fixed-room', false);
  const [introEncounterRoll, setIntroEncounterRoll] = usePlayDraftState<number | null>('intro-encounter-roll', null);
  const [introEncounterRequested, setIntroEncounterRequested] = usePlayDraftState('intro-encounter-requested', false);
  const [introEncounterSource, setIntroEncounterSource] = usePlayDraftState<string | null>('intro-encounter-source', null);
  const [eventLairApplied, setEventLairApplied] = usePlayDraftState('event-lair-applied', false);
  const [tension, setTension] = usePlayDraftState<TensionResult | null>('entry-tension', null);
  const [enteredLightCost, setEnteredLightCost] = usePlayDraftState<number | null>('entry-light-cost', null);
  const [entryLight, setEntryLight] = usePlayDraftState<EntryLight>('entry-light-mode', 'lit');
  const [darkResolve, setDarkResolve] = usePlayDraftState<CheckOutcome | null>('entry-light-resolve', null);
  const [darknessRoll, setDarknessRoll] = usePlayDraftState<number | null>('entry-darkness', null);
  const [encounterRoll, setEncounterRoll] = usePlayDraftState<number | null>('encounter-roll', null);
  const [eventRoll, setEventRoll] = usePlayDraftState<number | null>('event-roll', null);
  const [actionReport, setActionReport] = useState(EMPTY_ACTIONS);
  const [darknessFollow, setDarknessFollow] = useState(EMPTY_FOLLOW_UP);
  const [eventFollow, setEventFollow] = useState(EMPTY_FOLLOW_UP);
  const clear = useClearPlayDraftScope();
  const actionsHeading = useId();
  const descriptionId = useId();
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const commit = usePlayRoll();

  const intro = domainProgress.mode === 'intro';
  const introCreatureId = introEncounterRoll !== null ? introEncounterCreature(introEncounterRoll) : null;
  const introCreature = introCreatureId ? creatureById.get(introCreatureId) : undefined;
  const shapeRow = !intro && choice === 'shape' && shapeRoll !== null ? SHAPE_TABLE.rows.find(({ min }) => min === shapeRoll) : undefined;
  const rolledShape = shapeRoll === null ? undefined : roomShapeForRoll(shapeRoll);
  const tile = tileDraft?.roll === shapeRoll ? tileDraft : null;
  const place = choice === 'shape' ? (intro ? null : rolledShape?.place ?? null) : choice;
  const slots = usePlayDraft()?.slots;
  const remainingLight = lightRemaining(slots ? readPlayLight(slots) : null, supplies.lightEntries);
  const enteringDark = place === 'room' && entryLight === 'dark';
  const darkCheck = enteringDark && !revisit;
  const darkSanityLoss = darkCheck && (darkResolve === 'failure' || darkResolve === 'fumble');
  const lightMissing = place === 'room' && entryLight === 'lit' && remainingLight === 0 && !tension;
  const readyForEntry = !lightMissing && (!darkCheck || darkResolve !== null || !!tension);
  const roomDamageRecord = slots?.[LINGERING_RECORDED_SLOT];
  const legacyLog = slots?.[CHARACTER_LOG_SLOT];
  const roomDamage = useMemo(() => place === 'room' ? recordedRoomDamage(roomDamageRecord, legacyLog) : [],
    [place, roomDamageRecord, legacyLog]);
  const placeLabel = place ? PLACE_LABELS[place] : null;
  const mapRecord = paperMap.find((record) => record.domainId === paperMapDomain && paperMapKey(record.paperId) === paperLocation);
  const mapExits = !revisit && choice === 'shape' ? rolledShape?.exits
    : mapRecord?.tile ? roomShapeForRoll(mapRecord.tile.roll)?.exits : undefined;
  const mapNote = mapRecord ? [...mapRecord.tags, mapRecord.note].filter(Boolean).join(' · ') : '';
  const descriptionRoll = place && !revisit ? descriptions[place] : null;
  const description = place && descriptionRoll !== null ? PLACE_DESCRIPTIONS[place].rows.find(({ min, max }) =>
    descriptionRoll >= min && descriptionRoll <= max) : undefined;
  const descriptionReport = description ? `${placeLabel} · ${description.ko}` : null;
  const namedPlace = domainPlaceLabel(domainPlaceId, domainPlaceName || mapRecord?.paperId);
  const lairRoom = !!place && (domainProgress.lair?.id === domainPlaceId
    || (revisit && arrival === 'lair' && !!domainProgress.lair)
    || (!domainProgress.lair && !revisit && place === 'room' && lair));
  const exitHere = !!place && (domainProgress.exit?.id === domainPlaceId || (revisit && arrival === 'exit' && !!domainProgress.exit));
  const firstEntry = domainProgress.entryPlaceId === domainPlaceId;
  const introSkip = intro && fixedIntroRoom;
  const darknessRow = tension?.darkness && darknessRoll !== null
    ? DARKNESS_TABLE.rows.find(({ min, max }) => min <= darknessRoll && darknessRoll <= max) : undefined;
  const darknessAmbush = darknessRow?.next?.some(({ id }) => id === 't-encounter-general');
  const tensionReady = !!tension && (!tension.darkness || !!darknessRow);
  const returnAmbushResolved = retreatArrival?.ambush === 'victory' || retreatArrival?.ambush === 'ended';
  const returnCompleted = retreatArrival?.outcome === 'victory' || retreatArrival?.outcome === 'ended';
  const returnReady = tensionReady && (!darknessAmbush || returnAmbushResolved);
  const mustCheckEncounter = !!place && !revisit && !lairRoom && !introSkip && !darknessAmbush && tensionReady;
  const encountered = place && mustCheckEncounter && encounterRoll !== null
    ? encounterRoll >= ENCOUNTER_PLACES[place].threshold : null;
  const mayRollEvent = place === 'room' && encountered === false;
  const eventRow = mayRollEvent && eventRoll !== null
    ? EVENT_TABLE.rows.find(({ min, max }) => min <= eventRoll && eventRoll <= max) : undefined;
  const scavengeLimit = eventRow?.min === 40 ? 2 : eventRow?.min === 55 ? 3 : 1;
  const eventCanStartCombat = eventRow?.next?.some(({ id }) => id === 't-encounter-general');
  const entryNextTension = mayRollEvent && eventRoll === 67 ? 8 : tensionReady ? tension?.nextDie : undefined;
  const entryResolved = retreatArrival ? returnReady && returnCompleted : tensionReady && !darknessAmbush
    && (revisit || lairRoom || introSkip || encountered === false && (!mayRollEvent || !!eventRow));
  const actions = !!place && entryNextTension ? actionReport : EMPTY_ACTIONS;
  const next = actions.nextTension ?? entryNextTension;
  const nextTension = next ? `D${next}` : null;
  const roomLightCost = place === 'room' && entryLight === 'lit' ? enteredLightCost ?? lightCost : null;
  const placeReport = placeLabel
    ? [mapRecord?.paperId, revisit ? `${placeLabel} 재방문` : placeLabel].filter(Boolean).join(' · ') : null;
  const shapeReport = shapeRow ? [mapRecord?.paperId, shapeRow.ko].filter(Boolean).join(' · ') : null;
  const darknessReport = darknessRow && darknessRoll !== null ? `D100 ${darknessRoll} · ${darknessRow.ko}` : null;
  // Journal and the room summary carry the event's short title; the card keeps the whole rule text.
  const eventReport = eventRow && eventRoll !== null
    ? `D100 ${eventRoll} · ${rowTitle(eventRow)}` : null;
  const resolvedDarkness = darknessRow ? darknessFollow : EMPTY_FOLLOW_UP;
  const resolvedEvent = eventRow ? eventFollow : EMPTY_FOLLOW_UP;
  const eventLairEffect = eventRoll === 86 && resolvedEvent.items.some(({ id }) => id === 'event-86-lair');
  const loweredLair = !domainProgress.lair ? stepDomainDie(domainProgress, 1) : domainProgress;
  const priorDarknessRolls = useMemo(() => [darknessRow ? darknessRoll : null, resolvedEvent.darkness]
    .filter((roll): roll is number => roll !== null), [darknessRow, darknessRoll, resolvedEvent.darkness]);
  const encounterReport = !place || !tensionReady ? null
    : retreatArrival ? retreatArrival.kind : darknessAmbush || encountered === true ? 'encounter' : lairRoom ? 'overseer'
      : (encountered === false || revisit || introSkip) ? 'none' : null;
  const introBattleId = `intro-encounter-${introEncounterRoll}${introEncounterSource ? `:${introEncounterSource}` : ''}`;
  const introBattleFinished = finishedSources.includes(introEncounterSource ?? introBattleId);
  const showIntroEncounter = !retreatArrival && intro && !introBattleFinished && (darknessAmbush || encountered === true || introEncounterRequested);

  useEffect(() => {
    onReport({ area: place, place: placeReport, shape: shapeReport, description: descriptionReport, nextTension,
      darkness: darknessReport ? [darknessReport, ...resolvedDarkness.items.map(({ text }) => text)].join(' · ') : null,
      event: eventReport ? [eventReport, ...resolvedEvent.items.map(({ text }) => text)].join(' · ') : null,
      encounter: encounterReport, actions: [
        firstEntry ? '새 도메인 첫 진입 · XP +50' : '',
        domainProgress.lair?.id === domainPlaceId ? `은신처 발견 · ${namedPlace}` : '',
        domainProgress.exit?.id === domainPlaceId ? `출구 발견 · ${namedPlace}` : '',
        mapNote ? `지도 메모 · ${mapNote}` : '',
        darkCheck && darkResolve ? `어두운 방 · Resolve ${darkSanityLoss ? '실패' : '성공'}` : '',
        actions.text,
      ].filter(Boolean).join(' / '), sheet: [
        ...(firstEntry ? [{ id: 'domain-entry-xp', text: 'XP +50 · 새 도메인 첫 진입' }] : []),
        ...(roomLightCost !== null && tension ? [{ id: 'room-light', text: `광원 −${roomLightCost}`, gear: gearCount('광원', -roomLightCost) }] : []),
        ...(darkSanityLoss ? [{ id: 'room-dark-resolve', text: 'Sanity −1 (광원 없이 새 방 진입)' }] : []),
        ...roomDamage,
        ...resolvedDarkness.items, ...resolvedEvent.items, ...actions.sheet,
      ] });
  }, [onReport, place, placeReport, shapeReport, descriptionReport, nextTension, darknessReport, eventReport, encounterReport, roomLightCost, tension, actions, resolvedDarkness, resolvedEvent,
    firstEntry, domainProgress.lair?.id, domainProgress.exit?.id, domainPlaceId, namedPlace, mapNote, roomDamage, darkCheck, darkResolve, darkSanityLoss]);
  useEffect(() => { onDarknessChange?.(darknessReport ? darknessRoll : null); }, [onDarknessChange, darknessReport, darknessRoll]);
  useEffect(() => {
    onActionDarknessChange?.(resolvedEvent.darkness === null ? actions.darknessRolls : [resolvedEvent.darkness, ...actions.darknessRolls]);
  }, [onActionDarknessChange, actions.darknessRolls, resolvedEvent.darkness]);

  const applyDarkness = (value: number | null) => {
    if (darknessRoll !== value) {
      clear('entry-darkness-follow');
      setDarknessFollow(EMPTY_FOLLOW_UP);
    }
    setDarknessRoll(value);
  };
  const applyEvent = (value: number | null) => {
    if (eventRoll !== value) {
      clear('event-follow');
      setEventFollow(EMPTY_FOLLOW_UP);
    }
    setEventRoll(value);
  };
  const startEncounter = (source?: string) => {
    const scriptedEnemy = source === `event-${eventRoll}` && eventRow?.next?.some(({ id }) => creatureById.has(id));
    if (intro && !scriptedEnemy) {
      const trigger = source ?? null;
      if (trigger !== introEncounterSource) setIntroEncounterRoll(null);
      setIntroEncounterSource(trigger);
      setIntroEncounterRequested(true);
    } else onCombat('encounter', source);
  };
  const startEventCombat = () => startEncounter(`event-${eventRoll}`);
  const markLair = (marked: boolean) => {
    setLair(marked);
    onDomainProgress?.(marked
      ? markDomainPlace(domainProgress, 'lair', { id: domainPlaceId, name: namedPlace })
      : removeDomainMark(domainProgress, 'lair', domainPlaceId));
  };
  const saveMapLocation = (record: PaperMapLocation) => {
    const key = paperMapKey(record.paperId);
    onPaperMapChange?.((previous) => {
      const index = previous.findIndex((item) => item.domainId === record.domainId && paperMapKey(item.paperId) === key);
      const stored = previous[index];
      const storedTile = stored?.area === record.area ? stored.tile : undefined;
      const currentTile = !revisit && choice === 'shape' && shapeRoll !== null
        ? capturePaperMapTile(shapeRoll, tile ?? (storedTile?.roll === shapeRoll ? storedTile : EMPTY_ROOM_SHAPE), record.area)
        : undefined;
      const savedTile = currentTile ?? storedTile;
      const clues = record.clues ?? stored?.clues;
      const location = {
        ...record,
        ...(savedTile ? { tile: savedTile } : {}),
        ...(stored?.area === record.area && stored.doors ? { doors: stored.doors } : {}),
        ...(clues ? { clues } : {}),
      };
      return index < 0 ? [...previous, location] : previous.map((item, i) => i === index ? location : item);
    });
    setPaperLocation(key);
  };

  const saveMapDoor = (report: PaperMapDoorReport, paperId = mapRecord?.paperId) => {
    if (!paperId || !place || !onPaperMapChange) return false;
    const key = paperMapKey(paperId);
    const match = (record: PaperMapLocation) => record.domainId === paperMapDomain && paperMapKey(record.paperId) === key;
    const saved = paperMap.find(match);
    if (!key || saved && saved.area !== place) return false;
    onPaperMapChange((previous) => {
      const index = previous.findIndex(match);
      if (index < 0) {
        const mapTile = !revisit && choice === 'shape' && shapeRoll !== null
          ? capturePaperMapTile(shapeRoll, tile ?? EMPTY_ROOM_SHAPE, place) : undefined;
        return [...previous, { domainId: paperMapDomain, paperId, area: place, note: '', tags: [], tile: mapTile, doors: [report] }];
      }
      return previous.map((record, i) => {
        if (i !== index) return record;
        const doors = record.doors ?? [];
        const doorIndex = doors.findIndex(({ exit }) => paperMapKey(exit) === paperMapKey(report.exit));
        return { ...record, doors: doorIndex < 0 ? [...doors, report] : doors.map((door, j) => j === doorIndex ? report : door) };
      });
    });
    setPaperLocation(key);
    return true;
  };

  return (
    <section className="play-exploration" aria-label="장소 탐험">
      <div className="play-explore-options">
        <div className="play-explore-choice">
          <span aria-hidden="true">방문 구분</span>
          <div className="seg" role="group" aria-label="방문 구분">
            <button type="button" aria-pressed={!revisit} disabled={!!retreatArrival} onClick={() => setRevisit(false)}>새 장소</button>
            <button type="button" aria-pressed={revisit} disabled={!!retreatArrival} onClick={() => {
              setChoice(place ?? 'room');
              setRevisit(true);
            }}>재방문</button>
          </div>
        </div>
        <div className="play-explore-choice">
          <span aria-hidden="true">장소 종류</span>
          <div className="seg" role="group" aria-label="장소 종류">
            {(['shape', 'room', 'corridor'] as const).filter((option) => !(revisit || intro) || option !== 'shape').map((option) => (
              <button key={option} type="button" aria-pressed={choice === option} disabled={!!retreatArrival && (retreatArrival.areaKnown || !!tension)}
                onClick={() => setChoice(option)}>{PLACE_LABELS[option]}</button>
            ))}
          </div>
        </div>
      </div>

      {!revisit && !intro && choice === 'shape' && (
        <>
          <PlayRoll label="방·통로 모양" table={PLAY_SHAPE_TABLE} value={shapeRoll} onValue={(value) => {
            if (value !== shapeRoll) setTileDraft(null);
            setShapeRoll(value);
          }} roomShape={tile ?? (tileOpen ? EMPTY_ROOM_SHAPE : undefined)}
            afterResult={rolledShape && shapeRoll !== null && <PlayTileControls key={shapeRoll} exits={rolledShape.exits}
              state={tile ?? EMPTY_ROOM_SHAPE} open={tileOpen} onOpen={setTileOpen}
              onChange={(state) => setTileDraft({ ...state, roll: shapeRoll })}
              onInvestigateExit={mapRecord && entryNextTension ? (exit) => actionsRef.current?.open('door', `${exit + 1}번 출입구`) : undefined} />} />
          {shapeRow?.ko.includes('막다른 곳') && (
            <p className="play-explore-note">더 갈 출입구가 없다면 출입구가 둘 이상 나올 때까지 다시 굴립니다. <XRef id="room-shape">모양 규칙</XRef></p>
          )}
        </>
      )}

      {onPaperMapChange && <PlayPaperMap ref={paperMapRef} area={place} domainId={paperMapDomain} locations={paperMap} active={mapRecord}
        revisiting={revisit} canRevisit={!tension && !retreatArrival}
        onSave={saveMapLocation} onRevisit={(record, exit) => {
          setChoice(record.area);
          setRevisit(true);
          setArrival(null);
          setPaperLocation(paperMapKey(record.paperId));
          setResumeExit(exit ?? '');
        }} />}
      {intro && !place && <p className="play-explore-note">종이 지도에서 들어간 방 또는 통로를 선택하세요. <XRef id="first-domain-rules" /></p>}

      {place && (
        <>
          {place === 'room' && <LingeringEntryAlert />}
          <div className="play-explore-context">
            <p>{retreatArrival ? `${retreatArrival.place} 재진입` : revisit ? `정리한 ${placeLabel} 재방문` : `새 ${placeLabel}`}
              {roomLightCost !== null && <> · <XRef id="lightsource">광원 {roomLightCost} 소모</XRef></>}
            </p>
            {!onDomainProgress && !revisit && (
              <div className="play-explore-links">
                {place === 'room' && <XRef id="lair-check">은신처 판정 · 미발견</XRef>}
                <XRef id="domain-exit-check">출구 판정 · 은신처 발견 후</XRef>
                <XRef id="first-domain-rules">도입 도메인 규칙</XRef>
              </div>
            )}
            {!onDomainProgress && place === 'room' && !revisit && (
              <label className="play-explore-lair">
                <input type="checkbox" checked={lair} onChange={(event) => markLair(event.target.checked)} /> 이 방이 Overseer 은신처
              </label>
            )}
          </div>
          {place === 'room' && <section className="play-entry-light" aria-label="입장할 때 쓸 광원">
            <PlayLight supplies={supplies} onOpenGear={onOpenGear} />
            {roomLightCost !== null && remainingLight !== null && <p className="play-light-stock" role="status">
              {tension ? `현재 광원 ${remainingLight}` : afterLightCost(remainingLight, roomLightCost)}
            </p>}
            <label className="field"><span>입장할 때 쓸 광원</span>
              <select value={entryLight} disabled={!!tension} onChange={(event) => setEntryLight(event.target.value as EntryLight)}>
                <option value="lit">횃불·램프 등 남은 광원 사용</option>
                <option value="exempt">주문·특성 등으로 광원 소모 없음</option>
                <option value="dark">광원 없이 입장</option>
              </select>
            </label>
            {lightMissing && <p className="field-err" role="status">남은 광원이 0입니다. 새 광원을 준비하거나 사용할 방식을 선택하세요.</p>}
            {enteringDark && <p className="play-explore-note"><XRef id="blinded">Blinded</XRef> 적용.
              {darkCheck && ' 새 방에 들어갈 때 Resolve를 굴리고, 실패하면 Sanity 1을 잃습니다.'}
            </p>}
            {darkCheck && <PhysicalSkillRoll label="어두운 방 Resolve 판정" skill="Resolve" slot="entry-dark-check" readOnly={!!tension}
              onResult={(result) => setDarkResolve(result.outcome)} />}
          </section>}
          {/* Lair/exit and tension are rolled on every entry, so they share one row next to the shape. */}
          {readyForEntry && <div className="play-entry-dice">
            {onDomainProgress && <PlayDomainProgress progress={domainProgress} place={place} placeId={domainPlaceId} placeName={namedPlace}
              revisit={revisit} onChange={onDomainProgress} atLair={lairRoom} atExit={exitHere} onLairMark={markLair}
              onExitMark={(marked) => onDomainProgress(marked
                ? markDomainPlace(domainProgress, 'exit', { id: domainPlaceId, name: namedPlace })
                : removeDomainMark(domainProgress, 'exit', domainPlaceId))}
              recordedArrival={arrival} onArrival={setArrival} />}
            {intro && !revisit && !lairRoom && <label className="play-explore-lair">
              <input type="checkbox" checked={fixedIntroRoom} onChange={(event) => setFixedIntroRoom(event.target.checked)} /> 지도 지시로 이곳의 조우·이벤트 생략
            </label>}
            <section className="play-explore-step" aria-label="긴장 주사위">
              <h3>긴장 주사위</h3>
              <PlayFinishedStep summary={tension ? `D${tension.sides} ${tension.value} · ${tension.darkness ? '짙어지는 어둠 · ' : ''}다음 D${tension.nextDie}` : null}>
                <TensionTool initialSides={initialTension} value={tension} showDarknessLink={false} onResult={(result) => {
                  setTension(result);
                  if (enteredLightCost === null && roomLightCost !== null) setEnteredLightCost(roomLightCost);
                  applyDarkness(null);
                }} />
              </PlayFinishedStep>
            </section>
          </div>}
          {tension?.darkness && (
            <PlayRoll label="짙어지는 어둠" table={DARKNESS_TABLE} value={darknessRoll} onValue={applyDarkness} />
          )}
          <PlayDraftScope name="entry-darkness-follow">
            <ExplorationFollowUp key={darknessRoll} kind="darkness" row={darknessRow?.min}
              darknessEffectCount={darknessEffectCount} onReport={setDarknessFollow} />
          </PlayDraftScope>
          {mustCheckEncounter && (
            <PlayRoll label="조우 판정" table={PLAY_ENCOUNTERS[place]} value={encounterRoll} onValue={setEncounterRoll} condense />
          )}
          {mayRollEvent && (
            <PlayRoll label="이벤트" table={EVENT_TABLE} value={eventRoll} onValue={applyEvent} condense
              afterResult={onPaperMapChange && eventReport && <button className="btn ghost" type="button" onClick={() =>
                paperMapRef.current?.pinClue({ source: 'event', text: eventReport })}>이벤트를 단서로 남기기</button>} />
          )}
          <PlayDraftScope name="event-follow">
            <ExplorationFollowUp key={eventRoll} kind="event" row={eventRow?.min}
              darknessEffectCount={darknessEffectCount} onReport={setEventFollow} onCombat={startEventCombat} onTrader={onTrader}
              onEnvironmentTrap={() => actionsRef.current?.open('environment')} />
          </PlayDraftScope>
          {eventLairEffect && !intro && !domainProgress.lair && onDomainProgress && (
            eventLairApplied
              ? <p className="play-explore-note">왼쪽 문 효과를 적용했습니다. 다음 은신처 주사위 {domainProgress.lairDie}.</p>
              : loweredLair === domainProgress
                ? <p className="play-explore-note">D4에서 이 이벤트의 추가 하락은 룰북에 명시되지 않습니다. 은신처가 있는 곳을 알게 되면 직접 표시할 수 있습니다.</p>
                : <button className="btn ghost play-explore-action-btn" type="button" onClick={() => commit(() => {
                  onDomainProgress(loweredLair);
                  setEventLairApplied(true);
                })}>왼쪽 문 효과 적용 · 다음 은신처 {loweredLair.lairDie}</button>
          )}
          {showIntroEncounter && <section className="play-explore-step" aria-label="도입 도메인 조우">
            <JournalRoll die="D20" label="도입 도메인 전투 조우" value={introEncounterRoll} onValue={setIntroEncounterRoll}
              resultText={introCreature?.name} />
            {introCreature && <button className="btn primary play-explore-action-btn" type="button" data-play-next=""
              onClick={() => onCombat('encounter', introBattleId)}>도입 도메인 조우로</button>}
          </section>}
          {tensionReady && (
            <div className="play-explore-next">
              {darknessAmbush && (!intro || !!retreatArrival) && !returnAmbushResolved && retreatArrival?.ambush !== 'fled' && (
                <>
                  <p>적에게 기습당했습니다. 전투 시작 방식에서 기습당함을 선택하세요.</p>
                  <button type="button" className="btn primary" data-play-next=""
                    onClick={() => onCombat('encounter', retreatArrival ? RETREAT_AMBUSH_ID : undefined)}>매복 조우로</button>
                </>
              )}
              {retreatArrival?.ambush === 'fled' && <p>매복에서 후퇴했습니다. 다시 들어가려면 후퇴했던 장소에서 선택하세요.</p>}
              {retreatArrival?.outcome === 'fled' && <p>남아 있던 적에게서 후퇴했습니다. 다시 들어가려면 후퇴했던 장소에서 선택하세요.</p>}
              {retreatArrival && returnReady && !retreatArrival.outcome && <button type="button" className="btn primary" data-play-next=""
                onClick={retreatArrival.onCombat}>{retreatArrival.started ? '재진입 전투 이어가기' : '남아 있던 적과 조우'}</button>}
              {!retreatArrival && lairRoom && !darknessAmbush && (
                <>
                  <p>{domainDefeated ? '이 도메인의 Overseer를 처치했습니다.' : '은신처 방에서는 일반 조우 판정을 생략합니다.'}</p>
                  {!domainDefeated && <button type="button" className="btn primary" data-play-next="" onClick={() => onCombat('overseer')}>Overseer 조우로</button>}
                </>
              )}
              {encountered === true && !intro && <button type="button" className="btn primary" data-play-next="" onClick={() => onCombat('encounter')}>조우 표로</button>}
              {eventCanStartCombat && <button type="button" className="btn ghost" data-play-next="" onClick={startEventCombat}>이벤트에서 전투가 났다면 조우 표로</button>}
            </div>
          )}
          {!revisit && <div className="play-explore-description">
            <PlayStrip label="환경 묘사" prefix={descriptionId} value={descriptionOpen ? 'description' : null}
              onChange={(next) => setDescriptionOpen(next !== null)} items={[{ id: 'description', label: `${placeLabel} 환경 묘사`,
                badge: descriptionRoll !== null ? `D100 ${descriptionRoll}` : undefined }]} />
            <PlayStripPane prefix={descriptionId} id="description" open={descriptionOpen}>
              <PlayRoll label={`${placeLabel} 환경 묘사 굴림`} table={PLACE_DESCRIPTIONS[place]}
                value={descriptionRoll} onValue={(roll) => setDescriptions((previous) => ({ ...previous, [place]: roll }))}
                afterResult={onPaperMapChange && description && <button className="btn ghost" type="button" onClick={() =>
                  paperMapRef.current?.pinClue({ source: 'description', text: description.ko })}>환경 묘사를 단서로 남기기</button>} />
            </PlayStripPane>
          </div>}
          {entryNextTension && (!retreatArrival || returnCompleted) && <div className="play-explore-step" role="group" aria-labelledby={actionsHeading}>
            <h3 id={actionsHeading}>탐험 후속 행동</h3>
            <PlayExplorationActions actionsRef={actionsRef} room={place === 'room'} initialSides={entryNextTension}
              darknessEffectCount={darknessEffectCount} priorDarknessRolls={priorDarknessRolls}
              onReport={setActionReport} onCombat={startEncounter} scavengeLimit={scavengeLimit} finishedSources={finishedSources}
              mapLocation={mapRecord} mapExits={mapExits} onMapDoorSave={onPaperMapChange ? saveMapDoor : undefined}
              gearLedger={gearLedger} resumeExit={revisit ? resumeExit : undefined} onResumeHandled={() => setResumeExit('')} />
          </div>}
          {entryResolved && <div className="play-explore-next">
            {/* Most rooms end without loot or rest, so the journal is the usual next stop. */}
            {onJournal && <button type="button" className={lairRoom ? 'btn ghost' : 'btn primary'} data-play-next="" onClick={onJournal}>저널로</button>}
            <button type="button" className={lairRoom || onJournal ? 'btn ghost' : 'btn primary'} data-play-next={onJournal ? undefined : ''} onClick={onWrapUp}>정리로</button>
          </div>}
          {exitHere && tensionReady && (!retreatArrival || returnCompleted) && onLeaveDomain &&
            <PlayDomainExit mode={domainProgress.mode} onLeave={onLeaveDomain} destinations={domainDestinations} />}
        </>
      )}
    </section>
  );
}
