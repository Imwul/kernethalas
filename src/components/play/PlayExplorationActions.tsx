import { useCallback, useEffect, useId, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { EdgeToggle } from '../EdgeToggle';
import { tableById } from '../../content';
import type { TableRow } from '../../content/schema';
import { d100FromValue, resolveCheck, rollDie, type Edge } from '../../lib/dice';
import { followUpSteps } from '../../lib/exploration-follow-up';
import { EMPTY_DOOR_INVESTIGATION, type LockTarget } from '../../lib/lock-trap';
import { readOracleValue } from '../../lib/oracle';
import { paperMapKey, type PaperMapDoorReport, type PaperMapLocation } from '../../lib/paper-map';
import { activeDarkness } from '../../lib/play-domain';
import { pcCheckModifiers } from '../../lib/play-check-modifiers';
import { PlayDraftScope, usePlayDraftState, usePlayRoll, usePlayRollField } from '../../lib/play-draft';
import { usePlayCharacter } from '../../lib/play-character';
import { gearCount, type GearEffect, type GearLedger, type PaperChange } from '../../lib/play-inventory';
import { useRecordSkillCritical } from '../../lib/skill-growth';
import { XRef } from '../bits';
import { FieldCare } from './PlayLingering';
import { LockTrapTool, type PlayLockReport } from '../LockTrapTool';
import { JournalRoll } from '../LootJournal';
import { PhysicalSkillRoll, SkillCriticalDetails, skillCheckSucceeded } from '../PhysicalSkillRoll';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { ExplorationFollowUp, type FollowUpReport } from './ExplorationFollowUp';
import { PlayRoll } from './PlayRoll';
import { PlayDieHint, PlayZeroKey } from './PlayDieHints';
import { PlayStrip, PlayStripPane, stripPaneId } from './PlayPanels';
import { SpoilsRoll } from './PlayWrapUp';
import { formatSkillBreakdown, skillBreakdown, type SkillModifier } from '../../lib/play-skill';
import { SkillAdjustments } from './SkillAdjustments';

export type ActionSheetItem = PaperChange;
type SearchReport = { used: boolean; needsEncounter: boolean; text: string; item: string; gear?: GearEffect };
export interface ExplorationActionReport {
  text: string;
  sheet: ActionSheetItem[];
  nextTension: TensionDie | null;
  darknessRolls: number[];
}

export type ExplorationAction = 'door' | 'environment' | 'scavenge' | 'deep' | 'care';

export interface ExplorationActionsHandle {
  open: (action: ExplorationAction, mapExit?: string) => void;
}

interface ActionRoll {
  id: string;
  result: TensionResult;
  darkness: number | null;
  followUpId?: string;
}

interface DoorRecord {
  text: string;
  sheet: ActionSheetItem[];
}

interface Props {
  room: boolean;
  actionsRef: Ref<ExplorationActionsHandle>;
  initialSides: TensionDie;
  darknessEffectCount?: number;
  priorDarknessRolls?: number[];
  onReport: (report: ExplorationActionReport) => void;
  onCombat: (source: string) => void;
  scavengeLimit?: 1 | 2 | 3;
  finishedSources: string[];
  mapLocation?: PaperMapLocation;
  mapExits?: number;
  onMapDoorSave?: (report: PaperMapDoorReport, paperId?: string) => boolean;
  resumeExit?: string;
  onResumeHandled?: () => void;
  gearLedger?: GearLedger;
}

const DOOR_TABLE = tableById.get('t-door')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;
const SCAVENGE_TABLE = tableById.get('t-scavenging')!;
const CONTAINER_TABLE = tableById.get('t-deep-search')!;
const CHECK_LABELS = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
const NO_DARKNESS_ROLLS: number[] = [];

export function ExplorationActionLinks({ room, label, onSelect }: {
  room: boolean;
  label: string;
  onSelect: (action: ExplorationAction) => void;
}) {
  const heading = useId();
  return (
    <div className="play-explore-step" role="group" aria-labelledby={heading}>
      <h3 id={heading}>{label}</h3>
      <div className="play-explore-next">
        <button type="button" className="btn ghost" onClick={() => onSelect('door')}>자물쇠·함정 처리</button>
        {room && <>
          <button type="button" className="btn ghost" onClick={() => onSelect('scavenge')}>방 뒤지기로</button>
          <button type="button" className="btn ghost" onClick={() => onSelect('deep')}>깊은 수색으로</button>
        </>}
      </div>
    </div>
  );
}

function rowAt(rows: TableRow[], value: number | null) {
  return value === null ? undefined : rows.find(({ min, max }) => min <= value && value <= max);
}

function tensionResolved(roll?: ActionRoll) {
  return !!roll && (!roll.result.darkness || roll.darkness !== null);
}

function lockSheet(prefix: string, report: PlayLockReport | null): ActionSheetItem[] {
  return [
    ...(report?.lockpicks ? [{ id: `${prefix}-lockpicks`, text: `Lockpick −${report.lockpicks}`, gear: gearCount('Lockpick', -report.lockpicks) }] : []),
    ...(report?.xp ? [{ id: `${prefix}-xp`, text: `XP +${report.xp}` }] : []),
  ];
}

export function PlayExplorationActions({ room, actionsRef, initialSides, darknessEffectCount = 0, priorDarknessRolls = NO_DARKNESS_ROLLS, onReport, onCombat,
  scavengeLimit = 1, finishedSources, mapLocation, mapExits = 0, onMapDoorSave, resumeExit, onResumeHandled, gearLedger }: Props) {
  const [rolls, setRolls] = usePlayDraftState<ActionRoll[]>('action-tension', []);
  const [pane, setPane] = usePlayDraftState<ExplorationAction | null>('action-pane', null);
  const [searchAttempt, setSearchAttempt] = usePlayDraftState('scavenge-selected', 1);
  const [door, setDoor] = usePlayDraftState<'roll' | 'present'>('door-choice', 'roll');
  const [mapExit, setMapExit] = usePlayDraftState('door-map-exit', '');
  const [manualExit, setManualExit] = usePlayDraftState('door-manual-exit', '');
  const [finishedDoors, setFinishedDoors] = usePlayDraftState<DoorRecord[]>('finished-doors', []);
  const [doorRoll, setDoorRoll] = usePlayDraftState<number | null>('door-roll', null);
  const [resumedDoor, setResumedDoor] = usePlayDraftState<PaperMapDoorReport | null>('resumed-door', null);
  const [deepStarted, setDeepStarted] = usePlayDraftState('deep-started', false);
  const [contentsRoll, setContentsRoll] = usePlayDraftState<number | null>('deep-contents', null);
  const [contentsRevision, setContentsRevision] = usePlayDraftState('deep-contents-revision', 0);
  const [doorReport, setDoorReport] = useState<PlayLockReport | null>(null);
  const [environmentReport, setEnvironmentReport] = useState<PlayLockReport | null>(null);
  const [containerReport, setContainerReport] = useState<PlayLockReport | null>(null);
  const [scavenge, setScavenge] = useState<Partial<Record<number, SearchReport>>>({});
  const [lootText, setLootText] = useState('');
  const [lootItem, setLootItem] = useState('');
  const [lootGear, setLootGear] = useState<GearEffect>();
  const [followUps, setFollowUps] = useState<Record<string, ActionSheetItem[]>>({});
  const [savedDoorMessage, setSavedDoorMessage] = useState('');
  const [deferForm, setDeferForm] = useState(false);
  const [deferPaperId, setDeferPaperId] = useState('');
  const [deferExit, setDeferExit] = useState('');
  const panelId = useId();
  const panel = useRef<HTMLElement>(null);
  const currentSearch = Math.min(searchAttempt, scavengeLimit);
  const reportSearch = useCallback((attempt: number, result: SearchReport) => {
    setScavenge((current) => JSON.stringify(current[attempt]) === JSON.stringify(result)
      ? current : { ...current, [attempt]: result });
  }, []);

  const startResuming = useCallback((saved: PaperMapDoorReport) => {
    setResumedDoor(saved);
    setMapExit(`exit:${saved.exit}`);
    setDoor('present');
    setSavedDoorMessage('');
    setPane('door');
    requestAnimationFrame(() => {
      const heading = panel.current?.querySelector<HTMLElement>('.play-door-map h4');
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: 'center' });
    });
  }, [setDoor, setMapExit, setPane, setResumedDoor]);

  useEffect(() => {
    if (!resumeExit) return;
    const saved = mapLocation?.doors?.find(({ exit }) => paperMapKey(exit) === paperMapKey(resumeExit));
    if (saved?.deferred) startResuming(saved);
    onResumeHandled?.();
  }, [resumeExit, mapLocation, startResuming, onResumeHandled]);

  useImperativeHandle(actionsRef, () => ({
    open(action, exit) {
      setPane(action === 'scavenge' || action === 'deep' ? (room ? action : 'door') : action);
      if (action === 'door' && exit) {
        setMapExit(`exit:${exit}`);
        setSavedDoorMessage('');
      }
      requestAnimationFrame(() => {
        const button = panel.current?.querySelector<HTMLElement>(`button[aria-controls="${CSS.escape(stripPaneId(panelId, action))}"]`);
        button?.focus({ preventScroll: true });
        button?.scrollIntoView({ block: 'start' });
      });
    },
  }), [panelId, room, setPane, setMapExit]);

  const doorPresent = door === 'present' || door === 'roll' && doorRoll !== null && doorRoll <= 5;
  const readyDeep = room && deepStarted && tensionResolved(rolls.find(({ id }) => id === 'deep'));
  const openContainer = readyDeep && containerReport?.opened;
  const contents = openContainer ? rowAt(CONTAINER_TABLE.rows, contentsRoll) : undefined;
  const hasLoot = contents?.next?.some(({ id }) => id === 't-container-loot');
  const last = rolls.at(-1);
  const nextTension = tensionResolved(last) && last ? last.result.nextDie : null;
  const activeDoor = doorPresent ? doorReport : null;
  const activeContainer = readyDeep ? containerReport : null;
  const doorNumber = finishedDoors.length + 1;
  const doorKey = `door-${doorNumber}`;
  const doorText = door === 'roll' && doorRoll !== null && !doorPresent ? '문 없음' : doorPresent ? activeDoor?.text || '문 있음' : '';
  const canArchiveDoor = !!doorText && !activeDoor?.pendingTension;
  const mappedExit = mapLocation ? (mapExit === 'manual' ? manualExit.trim() : mapExit.startsWith('exit:') ? mapExit.slice(5) : '') : '';
  const doorTitle = mappedExit && mapLocation ? `${mapLocation.paperId} · ${mappedExit}` : `문 ${doorNumber}`;
  const exitOptions = [...new Set([
    ...Array.from({ length: mapExits }, (_, index) => `${index + 1}번 출입구`),
    ...(mapLocation?.doors?.map(({ exit }) => exit) ?? []),
  ])];
  const previousDoor = mappedExit ? mapLocation?.doors?.find(({ exit }) => paperMapKey(exit) === paperMapKey(mappedExit)) : undefined;
  const savedInvestigation = !!previousDoor?.deferred && !resumedDoor;
  const canDeferDoor = canArchiveDoor && doorPresent && !activeDoor?.opened && !previousDoor?.opened && !savedInvestigation;
  useEffect(() => {
    if (!resumedDoor || !activeDoor || !previousDoor || !onMapDoorSave) return;
    if (activeDoor.pendingTension) {
      if (previousDoor.opened) onMapDoorSave(resumedDoor);
      return;
    }
    const deferred = activeDoor.opened ? undefined : activeDoor.investigation;
    if (activeDoor.opened === previousDoor.opened && JSON.stringify(deferred) === JSON.stringify(previousDoor.deferred)) return;
    onMapDoorSave({ exit: resumedDoor.exit, text: (activeDoor.text || resumedDoor.text).slice(0, 600), opened: activeDoor.opened,
      ...(deferred ? { deferred } : {}) });
  }, [resumedDoor, activeDoor, previousDoor, onMapDoorSave]);

  const archiveDoor = (title: string, text: string) => {
    setFinishedDoors((previous) => [...previous, { text: `${title} · ${text}`, sheet: lockSheet(doorKey, activeDoor) }]);
    setDoor('roll');
    setDoorRoll(null);
    setDoorReport(null);
    setResumedDoor(null);
    setMapExit('');
    setManualExit('');
    setDeferForm(false);
  };
  const deferDoor = (paperId: string, exit: string) => {
    if (!canDeferDoor || !paperId || !exit) return;
    const report = { exit, text: doorText.slice(0, 600), opened: false, deferred: activeDoor?.investigation ?? EMPTY_DOOR_INVESTIGATION };
    if (!onMapDoorSave?.(report, paperId)) {
      setSavedDoorMessage('장소 종류와 지도 번호를 확인하세요.');
      return;
    }
    archiveDoor(`${paperId} · ${exit}`, `${doorText} · 개방 보류`);
    setSavedDoorMessage(`${paperId} · ${exit}을 돌아갈 곳에 저장했습니다.`);
  };
  const darknessRecords = useMemo(() => {
    const prior = [...priorDarknessRolls];
    return rolls.flatMap(({ id, darkness, followUpId }) => {
      const row = rowAt(DARKNESS_TABLE.rows, darkness);
      if (!row || darkness === null) return [];
      const carried = prior.some((roll) => roll === 33 || roll === 34) ? 0 : darknessEffectCount;
      const effects = activeDarkness(prior.map((roll, index) => ({ id: String(index), roll })), []);
      prior.push(darkness);
      const count = carried + effects.length;
      return [{ id, key: `${id}-${followUpId ?? darkness}`, darkness, row, count, followUp: !!followUpSteps('darkness', row.min, count) }];
    });
  }, [rolls, darknessEffectCount, priorDarknessRolls]);
  const reportFollowUp = useCallback((key: string, { items }: FollowUpReport) => {
    setFollowUps((current) => JSON.stringify(current[key] ?? []) === JSON.stringify(items) ? current : { ...current, [key]: items });
  }, []);
  const searchNumbers = useMemo(() => Array.from({ length: scavengeLimit }, (_, index) => index + 1), [scavengeLimit]);
  const searchesUsed = searchNumbers.filter((number) => scavenge[number]?.used).length;
  const activeSearch = scavenge[currentSearch];
  const nextSearch = activeSearch?.used && !activeSearch.needsEncounter
    ? searchNumbers.find((number) => !scavenge[number]?.used) : undefined;
  const report = useMemo<ExplorationActionReport>(() => ({
    text: [
      ...finishedDoors.map(({ text }) => text),
      doorText ? `${doorTitle} · ${doorText}` : '',
      environmentReport?.text,
      ...(room ? searchNumbers.flatMap((number) => {
        const result = scavenge[number];
        return result?.text ? [`뒤지기${scavengeLimit > 1 ? ` ${number}회차 ·` : ''} ${result.text}`] : [];
      }) : []),
      room && deepStarted ? '깊은 수색 · Exhaustion +2' : '',
      activeContainer?.text,
      contents ? `용기 ${hasLoot && lootText ? lootText : contents.ko}` : '',
      ...darknessRecords.map(({ darkness, key, row }) => [
        `행동 후 짙어지는 어둠 D100 ${darkness} · ${row.ko}`, ...(followUps[key] ?? []).map(({ text }) => text),
      ].join(' · ')),
    ].filter(Boolean).join(' / '),
    sheet: [
      ...finishedDoors.flatMap(({ sheet }) => sheet),
      ...lockSheet(doorKey, activeDoor),
      ...lockSheet('environment', environmentReport),
      ...lockSheet('container', activeContainer),
      ...(room ? searchNumbers.flatMap((number) => {
        const result = scavenge[number];
        return result?.item ? [{
          id: number === 1 ? 'scavenge-item' : `scavenge-item-${number}`,
          text: result.item,
          gear: result.gear,
        }] : [];
      }) : []),
      ...(room && deepStarted ? [{ id: 'deep-exhaustion', text: '깊은 수색 · Exhaustion +2' }] : []),
      ...(hasLoot && lootItem ? [{ id: 'container-loot', text: lootItem, gear: lootGear }] : []),
      ...darknessRecords.flatMap(({ key }) => (followUps[key] ?? []).map((item) => ({ ...item, id: `${key}-${item.id}` }))),
    ],
    nextTension,
    darknessRolls: rolls.flatMap(({ darkness }) => darkness === null ? [] : [darkness]),
  }), [activeContainer, activeDoor, contents, darknessRecords, deepStarted, doorKey, doorTitle, doorText, environmentReport, finishedDoors, followUps, hasLoot, lootItem, lootText, lootGear, nextTension, rolls, room, scavenge, scavengeLimit, searchNumbers]);
  useEffect(() => { onReport(report); }, [onReport, report]);

  const renderTension = (actionId: string, label: string) => {
    const index = rolls.findIndex(({ id }) => id === actionId);
    const value = rolls[index];
    const previous = index < 0 ? rolls.at(-1) : rolls[index - 1];
    const darkness = value ? rowAt(DARKNESS_TABLE.rows, value.darkness) : undefined;
    const follow = darknessRecords.find((record) => record.id === actionId && record.followUp);
    const ambush = darkness?.next?.some(({ id }) => id === 't-encounter-general');
    if (!value && previous && !tensionResolved(previous)) {
      return <p className="play-explore-note">앞선 행동의 ‘짙어지는 어둠’ 결과를 먼저 확인하세요.</p>;
    }
    const completedEarlier = value && index < rolls.length - 1;
    return (
      <section className="play-explore-step" key={actionId} aria-label={label}>
        {completedEarlier
          ? <p className="play-explore-note">D{value.result.sides} 결과 {value.result.value} · 다음 D{value.result.nextDie}{darkness ? ` · ${darkness.ko}` : ''}</p>
          : <>
            <TensionTool initialSides={previous?.result.nextDie ?? initialSides} showDarknessLink={false} value={value?.result ?? null}
              onResult={(result) => setRolls((current) => [...(index < 0 ? current : current.slice(0, index)), { id: actionId, result, darkness: null }])} />
            {value?.result.darkness && (
              <PlayDraftScope name={`action-darkness-${actionId}`}>
                <PlayRoll label="행동 후 짙어지는 어둠" table={DARKNESS_TABLE} value={value.darkness}
                  onValue={(roll) => {
                    const followUpId = roll === null ? undefined : crypto.getRandomValues(new Uint32Array(2)).join('-');
                    setRolls((current) => current.map((entry) => entry.id === actionId ? { ...entry, darkness: roll, followUpId } : entry));
                  }} />
              </PlayDraftScope>
            )}
          </>}
        {ambush && <button className="btn primary play-explore-action-btn" type="button" data-play-next="" onClick={() => onCombat(`action-darkness:${actionId}`)}>행동 중 매복 조우로</button>}
        {follow && <button type="button" className="btn ghost play-explore-action-btn" onClick={() => {
          const heading = document.getElementById(`${panelId}-${follow.key}`);
          heading?.focus({ preventScroll: true });
          heading?.scrollIntoView({ block: 'start' });
        }}>어둠 후속 판정으로</button>}
      </section>
    );
  };

  const lock = (target: LockTarget, publish: (report: PlayLockReport) => void, key: string = target) => (
    <PlayDraftScope name={`lock-${key}`}>
      <LockTrapTool key={key} embedded={{
        target,
        onReport: publish,
        renderTension: (attempt) => renderTension(`${key}-${attempt}`, '강제 개방 긴장 굴림'),
        tensionReady: (attempt) => tensionResolved(rolls.find(({ id }) => id === `${key}-${attempt}`)),
        nextTension: nextTension ?? initialSides,
        resume: target === 'door' ? resumedDoor?.deferred : undefined,
        gearLedger,
      }} />
    </PlayDraftScope>
  );

  return (
    <section className="play-explore-actions" aria-label="선택 탐험 행동" ref={panel}>
      <PlayStrip label="탐험 행동" prefix={panelId} value={pane} onChange={setPane} items={[
        { id: 'door', label: '문·함정 조사' },
        { id: 'environment', label: '환경 함정' },
        ...(room ? [
          { id: 'scavenge' as const, label: '방 뒤지기', badge: scavengeLimit > 1 ? `${searchesUsed}/${scavengeLimit}` : undefined },
          { id: 'deep' as const, label: '깊은 수색' },
        ] : []),
        { id: 'care' as const, label: '붕대 치료' },
      ]} />
      <PlayStripPane prefix={panelId} id="care" open={pane === 'care'}>
        {pane === 'care' && <div className="play-explore-action-body"><FieldCare /></div>}
      </PlayStripPane>
      <PlayStripPane prefix={panelId} id="door" open={pane === 'door'}>
        <div className="play-explore-action-body">
          {mapLocation && onMapDoorSave && <section className="play-door-map" aria-label="종이 지도 출입구 연결">
            <h4 tabIndex={-1}>{mapLocation.paperId} 출입구</h4>
            <div className="play-door-map-fields">
              <label className="field"><span>조사할 출입구</span>
                <select value={mapExit} disabled={!!resumedDoor} onChange={(event) => {
                  setMapExit(event.target.value);
                  setSavedDoorMessage('');
                }}>
                  <option value="">조사 순서로 기록</option>
                  {exitOptions.map((exit) => <option key={exit} value={`exit:${exit}`}>{exit}</option>)}
                  <option value="manual">종이 지도 표기 직접 입력</option>
                </select>
              </label>
              {mapExit === 'manual' && <label className="field"><span>출입구 표기</span>
                <input value={manualExit} maxLength={48} placeholder="예 북쪽 철문" onChange={(event) => {
                  setManualExit(event.target.value);
                  setSavedDoorMessage('');
                }} />
              </label>}
            </div>
            {previousDoor && <p className="play-explore-note"><strong>저장한 조사</strong> · {previousDoor.text}</p>}
            {previousDoor?.deferred && !resumedDoor && !doorPresent && <button type="button" className="btn ghost"
              onClick={() => startResuming(previousDoor)}>저장한 문 조사 이어가기</button>}
          </section>}
          {!resumedDoor && !previousDoor?.opened && !savedInvestigation && <label className="field"><span>조사할 대상</span>
            <select value={door} onChange={(event) => setDoor(event.target.value as typeof door)}>
              <option value="roll">문 존재부터 굴리기</option>
              <option value="present">지도에 문 표시됨</option>
            </select>
          </label>}
          {door === 'roll' && (!previousDoor || !previousDoor.opened && !savedInvestigation) && <PlayDraftScope name={`exists-${doorKey}`}>
            <JournalRoll key={doorKey} tableId={DOOR_TABLE.id} label="문이 있는가?" value={doorRoll} onValue={setDoorRoll}
              resultText={doorRoll !== null && doorRoll <= 5 ? '문 있음 · 잠김과 함정을 이어서 확인합니다.' : '문 없음'} />
          </PlayDraftScope>}
          {doorPresent && !savedInvestigation && (!previousDoor?.opened || resumedDoor || activeDoor?.opened) && lock('door', setDoorReport, doorKey)}
          {canDeferDoor && onMapDoorSave && !deferForm && <button type="button"
            className="btn ghost play-explore-action-btn" onClick={() => {
              if (mapLocation && mappedExit) deferDoor(mapLocation.paperId, mappedExit);
              else {
                setDeferPaperId(mapLocation?.paperId ?? '');
                setDeferExit(mappedExit);
                setDeferForm(true);
              }
            }}>나중에 열기</button>}
          {deferForm && canDeferDoor && <form className="play-door-map-fields" aria-label="보류할 문 저장" onSubmit={(event) => {
            event.preventDefault();
            deferDoor(deferPaperId.trim(), deferExit.trim());
          }}>
            <label className="field"><span>종이 지도 번호</span><input value={deferPaperId} maxLength={32} autoComplete="off"
              onChange={(event) => setDeferPaperId(event.target.value)} /></label>
            <label className="field"><span>출입구 표기</span><input value={deferExit} maxLength={48} autoComplete="off"
              onChange={(event) => setDeferExit(event.target.value)} /></label>
            <button type="submit" className="btn primary" disabled={!deferPaperId.trim() || !deferExit.trim()}>돌아갈 곳에 저장</button>
            <button type="button" className="btn ghost" onClick={() => setDeferForm(false)}>취소</button>
          </form>}
          {canArchiveDoor && <div className="play-explore-next">
            {mappedExit && onMapDoorSave && !savedInvestigation && (!previousDoor?.opened || activeDoor?.opened) && <button type="button" className="btn ghost" onClick={() => {
              onMapDoorSave({ exit: mappedExit, text: doorText.slice(0, 600), opened: !!activeDoor?.opened,
                ...(!activeDoor?.opened && previousDoor?.deferred ? { deferred: activeDoor?.investigation ?? previousDoor.deferred } : {}) });
              setSavedDoorMessage(`${doorTitle} 조사 기록을 저장했습니다.`);
            }}>선택한 출입구에 조사 저장</button>}
            <button className="btn ghost play-explore-action-btn" type="button" onClick={() => {
              archiveDoor(doorTitle, doorText);
              setSavedDoorMessage('');
            }}>다른 문 조사</button>
          </div>}
          {savedDoorMessage && <p className="play-explore-note" role="status">{savedDoorMessage}</p>}
        </div>
      </PlayStripPane>
      <PlayStripPane prefix={panelId} id="environment" open={pane === 'environment'} className="play-environment">
        {lock('environment', setEnvironmentReport)}
      </PlayStripPane>
      {room && (
        <>
          <PlayStripPane prefix={panelId} id="scavenge" open={pane === 'scavenge'}>
            <div className="play-explore-action-body">
              {scavengeLimit > 1 && <div className="play-scavenge-attempts">
                <p className="play-explore-note" role="status">{searchesUsed}/{scavengeLimit}회 사용</p>
                <div className="seg" role="group" aria-label="방 뒤지기 시도 선택">
                  {searchNumbers.map((number) => (
                    <button type="button" key={number} aria-pressed={currentSearch === number}
                      aria-controls={`${panelId}-scavenge-${number}`}
                      data-play-next={number === nextSearch ? '' : undefined} data-play-roll-label={`방 뒤지기 ${number}회차`}
                      onClick={() => setSearchAttempt(number)}>{number}회차</button>
                  ))}
                </div>
              </div>}
              {searchNumbers.map((number) => {
                const source = number === 1 ? 'scavenge' : `scavenge-${number}`;
                const search = <Scavenge attempt={number} multiple={scavengeLimit > 1}
                  encounterFinished={finishedSources.includes(source)} onReport={reportSearch} onCombat={() => onCombat(source)} />;
                return (
                  <div key={number} id={`${panelId}-scavenge-${number}`} hidden={currentSearch !== number}>
                    {number === 1 ? search : <PlayDraftScope name={`scavenge-attempt-${number}`}>{search}</PlayDraftScope>}
                  </div>
                );
              })}
            </div>
          </PlayStripPane>
          <PlayStripPane prefix={panelId} id="deep" open={pane === 'deep'}>
            <div className="play-explore-action-body">
              <p className="play-explore-note">방마다 한 번 · 즉시 긴장 주사위 판정 · Exhaustion +2</p>
              {!deepStarted && <button className="btn ghost play-explore-action-btn" type="button" onClick={() => setDeepStarted(true)}>깊은 수색 시작</button>}
              {deepStarted && renderTension('deep', '깊은 수색 긴장 굴림')}
              {readyDeep && lock('container', setContainerReport)}
              {openContainer && <PlayRoll label="숨은 용기 내용물" table={CONTAINER_TABLE} value={contentsRoll} onValue={(roll) => {
                setContentsRoll(roll);
                setContentsRevision((previous) => previous + 1);
                setLootText('');
                setLootItem('');
                setLootGear(undefined);
              }} />}
              {hasLoot && <PlayDraftScope name={`container-spoils-${contentsRevision}`}>
                <SpoilsRoll key={contentsRevision} tableId="t-container-loot" onReport={setLootText} onSheetChange={setLootItem} onGearChange={setLootGear} />
              </PlayDraftScope>}
              <XRef id="deep-search">깊은 수색 규칙</XRef>
            </div>
          </PlayStripPane>
        </>
      )}
      {darknessRecords.filter(({ followUp }) => followUp).map(({ id, key, row, count, darkness }) => (
        <PlayDraftScope key={key} name={`action-follow-up-${key}`}>
          <ActionDarknessFollowUp headingId={`${panelId}-${key}`} title={`${id === 'deep' ? '깊은 수색' : '강제 개방'} · D100 ${darkness}`}
            recordKey={key} row={row.min} count={count} onReport={reportFollowUp} />
        </PlayDraftScope>
      ))}
    </section>
  );
}

function ActionDarknessFollowUp({ headingId, title, recordKey, row, count, onReport }: {
  headingId: string; title: string; recordKey: string; row: number; count: number;
  onReport: (key: string, report: FollowUpReport) => void;
}) {
  const submit = useCallback((report: FollowUpReport) => onReport(recordKey, report), [onReport, recordKey]);
  return (
    <section className="play-explore-step" aria-labelledby={headingId}>
      <h3 className="play-action-darkness-heading" id={headingId} tabIndex={-1}>{title}</h3>
      <ExplorationFollowUp kind="darkness" row={row} darknessEffectCount={count} onReport={submit} />
    </section>
  );
}

function Scavenge({ attempt, multiple, encounterFinished, onReport, onCombat }: {
  attempt: number;
  multiple: boolean;
  encounterFinished: boolean;
  onReport: (attempt: number, value: SearchReport) => void;
  onCombat: () => void;
}) {
  const id = useId();
  const commitRoll = usePlayRoll();
  const recordCritical = useRecordSkillCritical();
  const [check, setCheck] = usePlayDraftState<{
    skill: string; roll: number; edge: Edge; modifiers?: SkillModifier[]; madness?: number;
  } | null>('scavenge-check', null);
  const [draftSkill, setSkill] = useState<string | null>(null);
  const [draftRoll, setRoll] = useState<string | null>(null);
  const [draftEdge, setEdge] = useState<Edge | null>(null);
  const [draftModifiers, setModifiers] = useState<SkillModifier[] | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [bonus, setBonus] = usePlayDraftState('scavenge-bonus', false);
  const [tableRoll, setTableRoll] = usePlayDraftState<number | null>('scavenge-table', null);
  const [quantity, setQuantity] = usePlayDraftState<(number | null)[]>('scavenge-quantity', []);
  const [resolve, setResolve] = usePlayDraftState<'success' | 'failure' | ''>('scavenge-resolve', '');
  const [rewards, setRewards] = usePlayDraftState('scavenge-rewards-revision', 0);
  const [spoils, setSpoils] = useState('');
  const [spoilsItem, setSpoilsItem] = useState('');
  const [spoilsGear, setSpoilsGear] = useState<GearEffect>();
  const pc = usePlayCharacter();
  const savedScavenge = pc?.skill('Scavenge') ?? '';
  const rules = pcCheckModifiers(pc, 'Scavenge');
  const skill = draftSkill ?? check?.skill ?? savedScavenge;
  const rawRoll = draftRoll ?? (check ? String(check.roll) : '');
  const edge = draftEdge ?? check?.edge ?? rules.edge;
  const modifiers = draftModifiers ?? check?.modifiers ?? [];
  // Earlier saves stored the initial Madness modifier among the editable overrides.
  const previousFormat = check !== null && check.madness === undefined;
  const fixed = previousFormat ? [] : rules.fixed;
  const breakdown = skillBreakdown(skill, modifiers, fixed);
  const confirmedSkill = check && skillBreakdown(check.skill, check.modifiers, [{ label: '광기', value: -(check.madness ?? 0) }]);
  const checkOutcome = check && confirmedSkill ? resolveCheck(d100FromValue(check.roll), confirmedSkill.total, check.edge) : null;
  const allowsTable = checkOutcome?.outcome === 'success' || checkOutcome?.outcome === 'critical';
  const effective = tableRoll === null ? null : tableRoll + (bonus && checkOutcome?.outcome === 'critical' ? 5 : 0);
  const row = allowsTable ? rowAt(SCAVENGE_TABLE.rows, effective) : undefined;
  const reward = row && scavengeReward(row);
  const amount = reward && reward.dice.every((_, index) => quantity[index] != null)
    ? quantity.reduce<number>((sum, n) => sum + (n ?? 0), 0) : null;
  const spoilsRow = row?.next?.some(({ id }) => id === 't-spoils');
  const item = resolve === 'failure' && row?.min === 1 ? 'Sanity −1'
    : reward && amount !== null ? reward.item === '₵' ? `+${amount}₵` : `${reward.item} +${amount}`
      : spoilsRow ? spoilsItem : '';
  const text = row ? item || (spoilsRow && spoils ? spoils : row.ko) : checkOutcome ? CHECK_LABELS[checkOutcome.outcome] : '';
  const rewardName = reward?.item;
  const gear = useMemo(() => rewardName && amount !== null && amount > 0 ? gearCount(rewardName === '₵' ? '동전' : rewardName, amount)
    : spoilsRow ? spoilsGear : undefined, [rewardName, amount, spoilsRow, spoilsGear]);
  const used = check !== null;
  const needsEncounter = checkOutcome?.outcome === 'fumble' && !encounterFinished;
  const rollLabel = multiple ? `방 뒤지기 ${attempt}회차` : '방 뒤지기';
  const diceField = usePlayRollField('scavenge', rollLabel, 'D100', used, true);
  useEffect(() => { onReport(attempt, { used, needsEncounter, text, item, gear }); }, [attempt, onReport, used, needsEncounter, text, item, gear]);

  const resetRewards = () => {
    setQuantity([]);
    setResolve('');
    setRewards((previous) => previous + 1);
    setSpoils('');
    setSpoilsItem('');
    setSpoilsGear(undefined);
  };
  const applyCheck = (roll: number | null, source: 'manual' | 'app') => {
    if (roll === null || !breakdown) {
      setInvalid(true);
      return;
    }
    commitRoll(() => {
      setCheck({ skill: skill.trim(), roll, edge, modifiers, ...(!previousFormat && { madness: pc?.madness.scavenging ?? 0 }) });
      recordCritical('Scavenge', resolveCheck(d100FromValue(roll), breakdown.total, edge));
      setBonus(false);
      setTableRoll(null);
      resetRewards();
    }, { label: rollLabel, dice: 'D100', value: roll === 100 ? '00' : String(roll), source, field: diceField['data-play-roll-field'],
      breakdown: formatSkillBreakdown(breakdown) });
    setSkill(null);
    setRoll(null);
    setEdge(null);
    setModifiers(null);
    setInvalid(false);
  };

  return (
    <section className="play-explore-step" aria-label={multiple ? `방 뒤지기 판정 ${attempt}회차` : '방 뒤지기 판정'}>
      {!multiple && <p className="play-explore-note">Scavenge 판정 · 방마다 한 번</p>}
      <form className="physical-check-form play-scavenge-check" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        applyCheck(readOracleValue(rawRoll.trim(), 100), 'manual');
      }}>
        <label className="field"><span>Scavenge 수치</span><input value={skill} inputMode="text"
          onChange={(event) => setSkill(event.target.value)} placeholder="예: 55" /></label>
        <EdgeToggle value={edge} onChange={setEdge} />
        {rules.notes.length > 0 && !check && <p className="physical-check-exhausted">{rules.notes.join(' / ')}</p>}
        <div className="field"><label htmlFor={`${id}-scavenge-roll`}>Scavenge D100</label><PlayDieHint dice="D100" sides={100} />
          <input id={`${id}-scavenge-roll`} value={rawRoll} inputMode="numeric" {...diceField}
          aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-scavenge-error` : undefined}
          onChange={(event) => { setRoll(event.target.value); setInvalid(false); }} placeholder="1–100" /></div>
        <div className="physical-check-actions">
          <PlayZeroKey onInput={() => { setRoll('00'); setInvalid(false); }} />
          <button className="btn ghost" type="submit">판정</button>
          <button className="btn ghost" type="button" onClick={() => applyCheck(breakdown ? rollDie(100) : null, 'app')}>D100 굴리기</button>
        </div>
        <SkillAdjustments skill="Scavenge" base={skill} onBase={setSkill} modifiers={modifiers} onModifiers={setModifiers} fixed={fixed} />
        {invalid && <p className="field-err" id={`${id}-scavenge-error`} role="alert">Skill 정수와 1–100 사이의 주사위(또는 00)를 입력하세요.</p>}
      </form>
      {allowsTable && pc?.hasPerk('Scavenger') && <p className="play-explore-note">Scavenger Perk · 표 결과를 D4만큼 올리거나 내릴 수 있음</p>}
      {checkOutcome && <div className="play-explore-note" role="status">
        뒤지기 {CHECK_LABELS[checkOutcome.outcome]}
        <SkillCriticalDetails skill="Scavenge" outcome={checkOutcome.outcome} />
      </div>}
      {needsEncounter && <button className="btn primary play-explore-action-btn" type="button" data-play-next=""
        onClick={onCombat}>뒤지기 조우로</button>}
      {allowsTable && (
        <>
          {checkOutcome.outcome === 'critical' && <label className="play-explore-lair"><input type="checkbox" checked={bonus} onChange={(event) => {
            setBonus(event.target.checked);
            resetRewards();
          }} /> 대성공 보정 +5 적용</label>}
          <JournalRoll die="D20" label="뒤지기 결과" value={tableRoll} onValue={(roll) => { setTableRoll(roll); resetRewards(); }}
            resultText={effective === null ? '' : `${bonus ? `보정 ${effective} · ` : ''}${row?.ko ?? '표 범위를 벗어났습니다. 보정을 확인하세요.'}`} />
          {row?.min === 1 && <PhysicalSkillRoll key={rewards} label="참혹한 유해 Resolve 판정" skill="Resolve"
            slot={`scavenge-resolve-${rewards}`} onResult={(result) => setResolve(skillCheckSucceeded(result) ? 'success' : 'failure')}
            onClear={() => setResolve('')} />}
          {reward?.dice.map((die, index) => (
            <JournalRoll key={`${rewards}-${index}`} die={die} label={`${reward.item === '₵' ? '동전' : reward.item} ${reward.dice.length > 1 ? `${index + 1}번째` : '수량'}`}
              value={quantity[index] ?? null} onValue={(roll) => setQuantity((current) => reward.dice.map((_, place) => place === index ? roll : current[place] ?? null))} />
          ))}
          {spoilsRow && <PlayDraftScope name={`scavenge-spoils-${rewards}`}>
            <SpoilsRoll key={rewards} tableId="t-spoils" onReport={setSpoils} onSheetChange={setSpoilsItem} onGearChange={setSpoilsGear} />
          </PlayDraftScope>}
        </>
      )}
      <XRef id="scavenging">뒤지기 규칙</XRef>
    </section>
  );
}

function scavengeReward(row: TableRow): { dice: ('D4' | 'D20' | 'D100')[]; item: string } | null {
  switch (row.min) {
    case 3: return { dice: ['D20'], item: '₵' };
    case 4: return { dice: ['D4'], item: 'Crafting Supplies' };
    case 12: return { dice: ['D20', 'D20'], item: '₵' };
    case 13: return { dice: ['D4'], item: 'Cooking Ingredients' };
    case 19: return { dice: ['D100'], item: '₵' };
    default: return null;
  }
}
