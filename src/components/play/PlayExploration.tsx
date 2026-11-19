import { useEffect, useMemo, useState } from 'react';
import { tableById } from '../../content';
import type { OracleTable } from '../../content/schema';
import { ENCOUNTER_PLACES, encounterRowsForPlace, type EncounterPlace } from '../../content/tables/exploration';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../../lib/play-draft';
import { XRef } from '../bits';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { EMPTY_FOLLOW_UP, ExplorationFollowUp } from './ExplorationFollowUp';
import { PlayExplorationActions, type ActionSheetItem, type ExplorationActionReport } from './PlayExplorationActions';
import { PlayRoll } from './PlayRoll';
import '../../styles/play-exploration.css';

export interface ExplorationReport {
  place: string | null;
  shape: string | null;
  nextTension: string | null;
  darkness: string | null;
  event: string | null;
  encounter: 'encounter' | 'overseer' | 'none' | null;
  actions?: string;
  sheet?: ActionSheetItem[];
}

interface Props {
  onReport: (report: ExplorationReport) => void;
  onCombat: (kind: 'encounter' | 'overseer', source?: string) => void;
  onWrapUp: () => void;
  initialTension?: TensionDie;
  lightCost?: number;
  onDarknessChange?: (roll: number | null) => void;
  onActionDarknessChange?: (rolls: number[]) => void;
  darknessEffectCount?: number;
  onTrader?: () => void;
}

const SHAPE_TABLE = tableById.get('t-room-shape')!;
const PLAY_SHAPE_TABLE = { ...SHAPE_TABLE, notes: undefined };
const ENCOUNTER_TABLE = tableById.get('t-encounter-check')!;
const EVENT_TABLE = tableById.get('t-events')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;

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

export function PlayExploration({ onReport, onCombat, onWrapUp, initialTension = 8, lightCost = 1,
  onDarknessChange, onActionDarknessChange, darknessEffectCount, onTrader }: Props) {
  const [revisit, setRevisit] = usePlayDraftState('revisit', false);
  const [choice, setChoice] = usePlayDraftState<PlaceChoice>('place-choice', 'shape');
  const [shapeRoll, setShapeRoll] = usePlayDraftState<number | null>('shape-roll', null);
  const [lair, setLair] = usePlayDraftState('lair', false);
  const [tension, setTension] = usePlayDraftState<TensionResult | null>('entry-tension', null);
  const [enteredLightCost, setEnteredLightCost] = usePlayDraftState<number | null>('entry-light-cost', null);
  const [darknessRoll, setDarknessRoll] = usePlayDraftState<number | null>('entry-darkness', null);
  const [encounterRoll, setEncounterRoll] = usePlayDraftState<number | null>('encounter-roll', null);
  const [eventRoll, setEventRoll] = usePlayDraftState<number | null>('event-roll', null);
  const [actionReport, setActionReport] = useState(EMPTY_ACTIONS);
  const [darknessFollow, setDarknessFollow] = useState(EMPTY_FOLLOW_UP);
  const [eventFollow, setEventFollow] = useState(EMPTY_FOLLOW_UP);
  const clear = useClearPlayDraftScope();

  const shapeRow = choice === 'shape' && shapeRoll !== null ? SHAPE_TABLE.rows.find(({ min }) => min === shapeRoll) : undefined;
  const place = choice === 'shape' ? (shapeRoll === null ? null : shapeRoll <= 25 ? 'corridor' : 'room') : choice;
  const placeLabel = place ? PLACE_LABELS[place] : null;
  const lairRoom = !revisit && place === 'room' && lair;
  const darknessRow = tension?.darkness && darknessRoll !== null
    ? DARKNESS_TABLE.rows.find(({ min, max }) => min <= darknessRoll && darknessRoll <= max) : undefined;
  const darknessAmbush = darknessRow?.next?.some(({ id }) => id === 't-encounter-general');
  const tensionReady = !!tension && (!tension.darkness || !!darknessRow);
  const mustCheckEncounter = !!place && !revisit && !lairRoom && !darknessAmbush && tensionReady;
  const encountered = place && mustCheckEncounter && encounterRoll !== null
    ? encounterRoll >= ENCOUNTER_PLACES[place].threshold : null;
  const mayRollEvent = place === 'room' && encountered === false;
  const eventRow = mayRollEvent && eventRoll !== null
    ? EVENT_TABLE.rows.find(({ min, max }) => min <= eventRoll && eventRoll <= max) : undefined;
  const eventCanStartCombat = eventRow?.next?.some(({ id }) => id === 't-encounter-general');
  const entryNextTension = mayRollEvent && eventRoll === 67 ? 8 : tensionReady ? tension?.nextDie : undefined;
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
  const priorDarknessRolls = useMemo(() => [darknessRow ? darknessRoll : null, resolvedEvent.darkness]
    .filter((roll): roll is number => roll !== null), [darknessRow, darknessRoll, resolvedEvent.darkness]);
  const encounterReport = !place || !tensionReady ? null
    : darknessAmbush || encountered === true ? 'encounter' : lairRoom ? 'overseer' : (encountered === false || revisit) ? 'none' : null;

  useEffect(() => {
    onReport({ place: placeReport, shape: shapeReport, nextTension,
      darkness: darknessReport ? [darknessReport, ...resolvedDarkness.items.map(({ text }) => text)].join(' · ') : null,
      event: eventReport ? [eventReport, ...resolvedEvent.items.map(({ text }) => text)].join(' · ') : null,
      encounter: encounterReport, actions: actions.text, sheet: [
        ...(roomLightCost !== null && tension ? [{ id: 'room-light', text: `광원 −${roomLightCost}` }] : []),
        ...resolvedDarkness.items, ...resolvedEvent.items, ...actions.sheet,
      ] });
  }, [onReport, placeReport, shapeReport, nextTension, darknessReport, eventReport, encounterReport, roomLightCost, tension, actions, resolvedDarkness, resolvedEvent]);
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
  const startEventCombat = () => onCombat('encounter', `event-${eventRoll}`);

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
            {(['shape', 'room', 'corridor'] as const).filter((option) => !revisit || option !== 'shape').map((option) => (
              <button key={option} type="button" aria-pressed={choice === option}
                onClick={() => setChoice(option)}>{PLACE_LABELS[option]}</button>
            ))}
          </div>
        </div>
      </div>

      {!revisit && choice === 'shape' && (
        <>
          <PlayRoll label="방·통로 모양" table={PLAY_SHAPE_TABLE} value={shapeRoll} onValue={setShapeRoll} />
          {shapeRow?.ko.includes('막다른 곳') && (
            <p className="play-explore-note">더 갈 출입구가 없다면 출입구가 둘 이상 나올 때까지 다시 굴립니다. <XRef id="room-shape">모양 규칙</XRef></p>
          )}
        </>
      )}

      {place && (
        <>
          <div className="play-explore-context">
            <p>{revisit ? `정리한 ${placeLabel} 재방문` : `새 ${placeLabel}`}
              {roomLightCost !== null && <> · <XRef id="lightsource">광원 {roomLightCost} 소모</XRef>{roomLightCost === 1 && <span> (짙어지는 어둠 69–70 적용 중이면 2)</span>}</>}
            </p>
            {!revisit && (
              <div className="play-explore-links">
                {place === 'room' && <XRef id="lair-check">은신처 판정 · 미발견</XRef>}
                <XRef id="domain-exit-check">출구 판정 · 은신처 발견 후</XRef>
                <XRef id="first-domain-rules">도입 도메인 규칙</XRef>
              </div>
            )}
            {place === 'room' && !revisit && (
              <label className="play-explore-lair">
                <input type="checkbox" checked={lair} onChange={(event) => setLair(event.target.checked)} /> 이 방이 Overseer 은신처
              </label>
            )}
          </div>
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
              darknessEffectCount={darknessEffectCount} onReport={setEventFollow} onCombat={startEventCombat} onTrader={onTrader} />
          </PlayDraftScope>
          {entryNextTension && <PlayExplorationActions room={place === 'room'} initialSides={entryNextTension}
            darknessEffectCount={darknessEffectCount} priorDarknessRolls={priorDarknessRolls}
            onReport={setActionReport} onCombat={(source) => onCombat('encounter', source)} />}
          {tensionReady && (
            <div className="play-explore-next">
              {darknessAmbush && (
                <>
                  <p>적에게 기습당했습니다. 전투 시작 방식에서 기습당함을 선택하세요.</p>
                  <button type="button" className="btn primary" onClick={() => onCombat('encounter')}>매복 조우로</button>
                </>
              )}
              {lairRoom && !darknessAmbush && (
                <>
                  <p>은신처 방에서는 일반 조우 판정을 생략합니다.</p>
                  <button type="button" className="btn primary" onClick={() => onCombat('overseer')}>Overseer 조우로</button>
                </>
              )}
              {encountered === true && <button type="button" className="btn primary" onClick={() => onCombat('encounter')}>조우 표로</button>}
              {eventCanStartCombat && <button type="button" className="btn ghost" onClick={startEventCombat}>이벤트에서 전투가 났다면 조우 표로</button>}
              {!darknessAmbush && (revisit || lairRoom || (encountered === false && (!mayRollEvent || eventRow))) && (
                <button type="button" className={lairRoom ? 'btn ghost' : 'btn primary'} onClick={onWrapUp}>정리로</button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
