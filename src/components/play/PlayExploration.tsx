import { useEffect, useMemo, useState, type RefObject } from 'react';
import { tableById } from '../../content';
import { creatureById } from '../../content/entries/creatures';
import type { OracleTable } from '../../content/schema';
import { ENCOUNTER_PLACES, encounterRowsForPlace, type EncounterPlace } from '../../content/tables/exploration';
import { DEFAULT_DOMAIN_PROGRESS, domainPlaceLabel, introEncounterCreature, markDomainPlace, removeDomainMark, stepDomainDie, type DomainProgress } from '../../lib/domain-progress';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { gearCount } from '../../lib/play-inventory';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { EMPTY_FOLLOW_UP, ExplorationFollowUp } from './ExplorationFollowUp';
import { PlayDomainExit, PlayDomainProgress, type DomainDestination } from './PlayDomainProgress';
import { ExplorationActionLinks, PlayExplorationActions, type ActionSheetItem, type ExplorationActionReport, type ExplorationActionsHandle } from './PlayExplorationActions';
import { PlayRoll } from './PlayRoll';
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
  initialTension?: TensionDie;
  lightCost?: number;
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
}

const SHAPE_TABLE = tableById.get('t-room-shape')!;
const PLAY_SHAPE_TABLE = { ...SHAPE_TABLE, notes: undefined };
const ENCOUNTER_TABLE = tableById.get('t-encounter-check')!;
const EVENT_TABLE = tableById.get('t-events')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;
const PLACE_DESCRIPTIONS = {
  room: tableById.get('t-room-description')!,
  corridor: tableById.get('t-corridor-description')!,
};

const PLACE_LABELS = { shape: '모양으로 결정', room: '방', corridor: '통로' } as const;
type PlaceChoice = keyof typeof PLACE_LABELS;

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

export function PlayExploration({ actionsRef, onReport, onCombat, onWrapUp, initialTension = 8, lightCost = 1,
  onDarknessChange, onActionDarknessChange, darknessEffectCount, onTrader,
  domainProgress = DEFAULT_DOMAIN_PROGRESS, onDomainProgress, domainPlaceId = '1', domainPlaceName,
  domainDestinations, domainDefeated, onLeaveDomain }: Props) {
  const [revisit, setRevisit] = usePlayDraftState('revisit', false);
  const [choice, setChoice] = usePlayDraftState<PlaceChoice>('place-choice', 'shape');
  const [shapeRoll, setShapeRoll] = usePlayDraftState<number | null>('shape-roll', null);
  const [descriptions, setDescriptions] = usePlayDraftState<Record<EncounterPlace, number | null>>('place-description', { room: null, corridor: null });
  const [lair, setLair] = usePlayDraftState('lair', false);
  const [arrival, setArrival] = usePlayDraftState<'lair' | 'exit' | null>('domain-arrival', null);
  const [fixedIntroRoom, setFixedIntroRoom] = usePlayDraftState('intro-fixed-room', false);
  const [introEncounterRoll, setIntroEncounterRoll] = usePlayDraftState<number | null>('intro-encounter-roll', null);
  const [introEncounterRequested, setIntroEncounterRequested] = usePlayDraftState('intro-encounter-requested', false);
  const [eventLairApplied, setEventLairApplied] = usePlayDraftState('event-lair-applied', false);
  const [tension, setTension] = usePlayDraftState<TensionResult | null>('entry-tension', null);
  const [enteredLightCost, setEnteredLightCost] = usePlayDraftState<number | null>('entry-light-cost', null);
  const [darknessRoll, setDarknessRoll] = usePlayDraftState<number | null>('entry-darkness', null);
  const [encounterRoll, setEncounterRoll] = usePlayDraftState<number | null>('encounter-roll', null);
  const [eventRoll, setEventRoll] = usePlayDraftState<number | null>('event-roll', null);
  const [actionReport, setActionReport] = useState(EMPTY_ACTIONS);
  const [darknessFollow, setDarknessFollow] = useState(EMPTY_FOLLOW_UP);
  const [eventFollow, setEventFollow] = useState(EMPTY_FOLLOW_UP);
  const clear = useClearPlayDraftScope();
  const commit = usePlayRoll();

  const intro = domainProgress.mode === 'intro';
  const introCreatureId = introEncounterRoll !== null ? introEncounterCreature(introEncounterRoll) : null;
  const introCreature = introCreatureId ? creatureById.get(introCreatureId) : undefined;
  const shapeRow = !intro && choice === 'shape' && shapeRoll !== null ? SHAPE_TABLE.rows.find(({ min }) => min === shapeRoll) : undefined;
  const place = choice === 'shape' ? (intro || shapeRoll === null ? null : shapeRoll <= 25 ? 'corridor' : 'room') : choice;
  const placeLabel = place ? PLACE_LABELS[place] : null;
  const descriptionRoll = place ? descriptions[place] : null;
  const description = place && descriptionRoll !== null ? PLACE_DESCRIPTIONS[place].rows.find(({ min, max }) =>
    descriptionRoll >= min && descriptionRoll <= max) : undefined;
  const descriptionReport = description ? `${placeLabel} · ${description.ko}` : null;
  const namedPlace = domainPlaceLabel(domainPlaceId, domainPlaceName);
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
  const mustCheckEncounter = !!place && !revisit && !lairRoom && !introSkip && !darknessAmbush && tensionReady;
  const encountered = place && mustCheckEncounter && encounterRoll !== null
    ? encounterRoll >= ENCOUNTER_PLACES[place].threshold : null;
  const mayRollEvent = place === 'room' && encountered === false;
  const eventRow = mayRollEvent && eventRoll !== null
    ? EVENT_TABLE.rows.find(({ min, max }) => min <= eventRoll && eventRoll <= max) : undefined;
  const eventCanStartCombat = eventRow?.next?.some(({ id }) => id === 't-encounter-general');
  const entryNextTension = mayRollEvent && eventRoll === 67 ? 8 : tensionReady ? tension?.nextDie : undefined;
  const entryResolved = tensionReady && !darknessAmbush
    && (revisit || lairRoom || introSkip || encountered === false && (!mayRollEvent || !!eventRow));
  const actions = !!place && entryNextTension ? actionReport : EMPTY_ACTIONS;
  const next = actions.nextTension ?? entryNextTension;
  const nextTension = next ? `D${next}` : null;
  const roomLightCost = place === 'room' ? enteredLightCost ?? lightCost : null;
  const placeReport = placeLabel ? (revisit ? `${placeLabel} 재방문` : placeLabel) : null;
  const shapeReport = shapeRow?.ko ?? null;
  const darknessReport = darknessRow && darknessRoll !== null ? `D100 ${darknessRoll} · ${darknessRow.ko}` : null;
  const eventReport = eventRow && eventRoll !== null
    ? `D100 ${eventRoll} · ${eventRow.label ?? eventRow.ko}` : null;
  const resolvedDarkness = darknessRow ? darknessFollow : EMPTY_FOLLOW_UP;
  const resolvedEvent = eventRow ? eventFollow : EMPTY_FOLLOW_UP;
  const eventLairEffect = eventRoll === 86 && resolvedEvent.items.some(({ id }) => id === 'event-86-lair');
  const loweredLair = !domainProgress.lair ? stepDomainDie(domainProgress, 1) : domainProgress;
  const priorDarknessRolls = useMemo(() => [darknessRow ? darknessRoll : null, resolvedEvent.darkness]
    .filter((roll): roll is number => roll !== null), [darknessRow, darknessRoll, resolvedEvent.darkness]);
  const encounterReport = !place || !tensionReady ? null
    : darknessAmbush || encountered === true ? 'encounter' : lairRoom ? 'overseer' : (encountered === false || revisit || introSkip) ? 'none' : null;
  const showIntroEncounter = intro && (darknessAmbush || encountered === true || introEncounterRequested);

  useEffect(() => {
    onReport({ area: place, place: placeReport, shape: shapeReport, description: descriptionReport, nextTension,
      darkness: darknessReport ? [darknessReport, ...resolvedDarkness.items.map(({ text }) => text)].join(' · ') : null,
      event: eventReport ? [eventReport, ...resolvedEvent.items.map(({ text }) => text)].join(' · ') : null,
      encounter: encounterReport, actions: [
        firstEntry ? '새 도메인 첫 진입 · XP +50' : '',
        domainProgress.lair?.id === domainPlaceId ? `은신처 발견 · ${namedPlace}` : '',
        domainProgress.exit?.id === domainPlaceId ? `출구 발견 · ${namedPlace}` : '',
        actions.text,
      ].filter(Boolean).join(' / '), sheet: [
        ...(firstEntry ? [{ id: 'domain-entry-xp', text: 'XP +50 · 새 도메인 첫 진입' }] : []),
        ...(roomLightCost !== null && tension ? [{ id: 'room-light', text: `광원 −${roomLightCost}`, gear: gearCount('광원', -roomLightCost) }] : []),
        ...resolvedDarkness.items, ...resolvedEvent.items, ...actions.sheet,
      ] });
  }, [onReport, place, placeReport, shapeReport, descriptionReport, nextTension, darknessReport, eventReport, encounterReport, roomLightCost, tension, actions, resolvedDarkness, resolvedEvent,
    firstEntry, domainProgress.lair?.id, domainProgress.exit?.id, domainPlaceId, namedPlace]);
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
    if (intro && !scriptedEnemy) setIntroEncounterRequested(true);
    else onCombat('encounter', source);
  };
  const startEventCombat = () => startEncounter(`event-${eventRoll}`);
  const markLair = (marked: boolean) => {
    setLair(marked);
    onDomainProgress?.(marked
      ? markDomainPlace(domainProgress, 'lair', { id: domainPlaceId, name: namedPlace })
      : removeDomainMark(domainProgress, 'lair', domainPlaceId));
  };

  return (
    <section className="play-exploration" aria-label="장소 탐험">
      <div className="play-explore-options">
        <div className="play-explore-choice">
          <span aria-hidden="true">방문 구분</span>
          <div className="seg" role="group" aria-label="방문 구분">
            <button type="button" aria-pressed={!revisit} onClick={() => setRevisit(false)}>새 장소</button>
            <button type="button" aria-pressed={revisit} onClick={() => {
              setChoice(place ?? 'room');
              setRevisit(true);
            }}>재방문</button>
          </div>
        </div>
        <div className="play-explore-choice">
          <span aria-hidden="true">장소 종류</span>
          <div className="seg" role="group" aria-label="장소 종류">
            {(['shape', 'room', 'corridor'] as const).filter((option) => !(revisit || intro) || option !== 'shape').map((option) => (
              <button key={option} type="button" aria-pressed={choice === option}
                onClick={() => setChoice(option)}>{PLACE_LABELS[option]}</button>
            ))}
          </div>
        </div>
      </div>

      {!revisit && !intro && choice === 'shape' && (
        <>
          <PlayRoll label="방·통로 모양" table={PLAY_SHAPE_TABLE} value={shapeRoll} onValue={setShapeRoll} />
          {shapeRow?.ko.includes('막다른 곳') && (
            <p className="play-explore-note">더 갈 출입구가 없다면 출입구가 둘 이상 나올 때까지 다시 굴립니다. <XRef id="room-shape">모양 규칙</XRef></p>
          )}
        </>
      )}

      {intro && !place && <p className="play-explore-note">종이 지도에서 들어간 방 또는 통로를 선택하세요. <XRef id="first-domain-rules" /></p>}

      {place && (
        <>
          <div className="play-explore-context">
            <p>{revisit ? `정리한 ${placeLabel} 재방문` : `새 ${placeLabel}`}
              {roomLightCost !== null && <> · <XRef id="lightsource">광원 {roomLightCost} 소모</XRef>{roomLightCost === 1 && <span> (짙어지는 어둠 69–70 적용 중이면 2)</span>}</>}
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
          {!revisit && <details className="fold">
            <summary>{placeLabel} 환경 묘사</summary>
            <div className="play-explore-action-body">
              <PlayRoll label={`${placeLabel} 환경 묘사 굴림`} table={PLACE_DESCRIPTIONS[place]}
                value={descriptionRoll} onValue={(roll) => setDescriptions((previous) => ({ ...previous, [place]: roll }))} />
            </div>
          </details>}
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
            <TensionTool initialSides={initialTension} value={tension} showDarknessLink={false} onResult={(result) => {
              setTension(result);
              if (enteredLightCost === null && place === 'room') setEnteredLightCost(lightCost);
              applyDarkness(null);
            }} />
          </section>
          {tension?.darkness && (
            <PlayRoll label="짙어지는 어둠" table={DARKNESS_TABLE} value={darknessRoll} onValue={applyDarkness} />
          )}
          <PlayDraftScope name="entry-darkness-follow">
            <ExplorationFollowUp key={darknessRoll} kind="darkness" row={darknessRow?.min}
              darknessEffectCount={darknessEffectCount} onReport={setDarknessFollow} />
          </PlayDraftScope>
          {mustCheckEncounter && (
            <PlayRoll label="조우 판정" table={PLAY_ENCOUNTERS[place]} value={encounterRoll} onValue={setEncounterRoll} />
          )}
          {mayRollEvent && (
            <PlayRoll label="이벤트" table={EVENT_TABLE} value={eventRoll} onValue={applyEvent} />
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
            {introCreature && <button className="btn primary play-explore-action-btn" type="button"
              onClick={() => onCombat('encounter', `intro-encounter-${introEncounterRoll}`)}>도입 도메인 조우로</button>}
          </section>}
          {tensionReady && (
            <div className="play-explore-next">
              {darknessAmbush && !intro && (
                <>
                  <p>적에게 기습당했습니다. 전투 시작 방식에서 기습당함을 선택하세요.</p>
                  <button type="button" className="btn primary" onClick={() => onCombat('encounter')}>매복 조우로</button>
                </>
              )}
              {lairRoom && !darknessAmbush && (
                <>
                  <p>{domainDefeated ? '이 도메인의 Overseer를 처치했습니다.' : '은신처 방에서는 일반 조우 판정을 생략합니다.'}</p>
                  {!domainDefeated && <button type="button" className="btn primary" onClick={() => onCombat('overseer')}>Overseer 조우로</button>}
                </>
              )}
              {encountered === true && !intro && <button type="button" className="btn primary" onClick={() => onCombat('encounter')}>조우 표로</button>}
              {eventCanStartCombat && <button type="button" className="btn ghost" onClick={startEventCombat}>이벤트에서 전투가 났다면 조우 표로</button>}
            </div>
          )}
          {entryResolved && <ExplorationActionLinks room={place === 'room'} label="탐험 후속 행동" onSelect={(action) => actionsRef.current?.open(action)} />}
          {entryNextTension && <PlayExplorationActions actionsRef={actionsRef} room={place === 'room'} initialSides={entryNextTension}
            darknessEffectCount={darknessEffectCount} priorDarknessRolls={priorDarknessRolls}
            onReport={setActionReport} onCombat={startEncounter} />}
          {entryResolved && <div className="play-explore-next">
            <button type="button" className={lairRoom ? 'btn ghost' : 'btn primary'} onClick={onWrapUp}>정리로</button>
          </div>}
          {exitHere && tensionReady && onLeaveDomain && <PlayDomainExit mode={domainProgress.mode} onLeave={onLeaveDomain} destinations={domainDestinations} />}
        </>
      )}
    </section>
  );
}
