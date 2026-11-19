import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { tableById } from '../../content';
import type { TableRow } from '../../content/schema';
import { d100FromValue, resolveCheck, rollDie, type Edge } from '../../lib/dice';
import { followUpSteps } from '../../lib/exploration-follow-up';
import type { LockTarget } from '../../lib/lock-trap';
import { readOracleValue } from '../../lib/oracle';
import { activeDarkness } from '../../lib/play-domain';
import { PlayDraftScope, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { gearCount, type GearEffect, type PaperChange } from '../../lib/play-inventory';
import { XRef } from '../bits';
import { LockTrapTool, type PlayLockReport } from '../LockTrapTool';
import { JournalRoll } from '../LootJournal';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { ExplorationFollowUp, type FollowUpReport } from './ExplorationFollowUp';
import { PlayRoll } from './PlayRoll';
import { SpoilsRoll } from './PlayWrapUp';

export type ActionSheetItem = PaperChange;
type SearchReport = { text: string; item: string; gear?: GearEffect };
export interface ExplorationActionReport {
  text: string;
  sheet: ActionSheetItem[];
  nextTension: TensionDie | null;
  darknessRolls: number[];
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
  initialSides: TensionDie;
  darknessEffectCount?: number;
  priorDarknessRolls?: number[];
  onReport: (report: ExplorationActionReport) => void;
  onCombat: (source: string) => void;
}

const DOOR_TABLE = tableById.get('t-door')!;
const DARKNESS_TABLE = tableById.get('t-growing-darkness')!;
const SCAVENGE_TABLE = tableById.get('t-scavenging')!;
const CONTAINER_TABLE = tableById.get('t-deep-search')!;
const CHECK_LABELS = { critical: '대성공', success: '성공', failure: '실패', fumble: '대실패' } as const;
const NO_DARKNESS_ROLLS: number[] = [];

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

export function PlayExplorationActions({ room, initialSides, darknessEffectCount = 0, priorDarknessRolls = NO_DARKNESS_ROLLS, onReport, onCombat }: Props) {
  const [rolls, setRolls] = usePlayDraftState<ActionRoll[]>('action-tension', []);
  const [doorOpen, setDoorOpen] = usePlayDraftState('door-panel', false);
  const [searchOpen, setSearchOpen] = usePlayDraftState('scavenge-panel', false);
  const [deepOpen, setDeepOpen] = usePlayDraftState('deep-panel', false);
  const [door, setDoor] = usePlayDraftState<'roll' | 'present'>('door-choice', 'roll');
  const [finishedDoors, setFinishedDoors] = usePlayDraftState<DoorRecord[]>('finished-doors', []);
  const [environmentOpen, setEnvironmentOpen] = usePlayDraftState('environment-panel', false);
  const [doorRoll, setDoorRoll] = usePlayDraftState<number | null>('door-roll', null);
  const [deepStarted, setDeepStarted] = usePlayDraftState('deep-started', false);
  const [contentsRoll, setContentsRoll] = usePlayDraftState<number | null>('deep-contents', null);
  const [contentsRevision, setContentsRevision] = usePlayDraftState('deep-contents-revision', 0);
  const [doorReport, setDoorReport] = useState<PlayLockReport | null>(null);
  const [environmentReport, setEnvironmentReport] = useState<PlayLockReport | null>(null);
  const [containerReport, setContainerReport] = useState<PlayLockReport | null>(null);
  const [scavenge, setScavenge] = useState<SearchReport>({ text: '', item: '' });
  const [lootText, setLootText] = useState('');
  const [lootItem, setLootItem] = useState('');
  const [lootGear, setLootGear] = useState<GearEffect>();
  const [followUps, setFollowUps] = useState<Record<string, ActionSheetItem[]>>({});
  const panelId = useId();
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
  const report = useMemo<ExplorationActionReport>(() => ({
    text: [
      ...finishedDoors.map(({ text }) => text),
      doorText ? `문 ${doorNumber} · ${doorText}` : '',
      environmentReport?.text,
      room && scavenge.text ? `뒤지기 ${scavenge.text}` : '',
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
      ...(room && scavenge.item ? [{ id: 'scavenge-item', text: scavenge.item, gear: scavenge.gear }] : []),
      ...(room && deepStarted ? [{ id: 'deep-exhaustion', text: '깊은 수색 · Exhaustion +2' }] : []),
      ...(hasLoot && lootItem ? [{ id: 'container-loot', text: lootItem, gear: lootGear }] : []),
      ...darknessRecords.flatMap(({ key }) => (followUps[key] ?? []).map((item) => ({ ...item, id: `${key}-${item.id}` }))),
    ],
    nextTension,
    darknessRolls: rolls.flatMap(({ darkness }) => darkness === null ? [] : [darkness]),
  }), [activeContainer, activeDoor, contents, darknessRecords, deepStarted, doorKey, doorNumber, doorText, environmentReport, finishedDoors, followUps, hasLoot, lootItem, lootText, lootGear, nextTension, rolls, room, scavenge]);
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
        {ambush && <button className="btn primary play-explore-action-btn" type="button" onClick={() => onCombat(`action-darkness:${actionId}`)}>행동 중 매복 조우로</button>}
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
      }} />
    </PlayDraftScope>
  );

  return (
    <section className="play-explore-actions" aria-label="선택 탐험 행동">
      <details className="fold" open={doorOpen} onToggle={(event) => setDoorOpen(event.currentTarget.open)}>
        <summary>문·함정 조사</summary>
        <div className="play-explore-action-body">
          <label className="field"><span>조사할 대상</span>
            <select value={door} onChange={(event) => setDoor(event.target.value as typeof door)}>
              <option value="roll">문 존재부터 굴리기</option>
              <option value="present">지도에 문 표시됨</option>
            </select>
          </label>
          {door === 'roll' && <PlayDraftScope name={`exists-${doorKey}`}>
            <PlayRoll key={doorKey} label="문이 있는가?" table={DOOR_TABLE} value={doorRoll} onValue={setDoorRoll} />
          </PlayDraftScope>}
          {doorPresent && lock('door', setDoorReport, doorKey)}
          {canArchiveDoor && <button className="btn ghost play-explore-action-btn" type="button" onClick={() => {
            setFinishedDoors((previous) => [...previous, { text: `문 ${doorNumber} · ${doorText}`, sheet: lockSheet(doorKey, activeDoor) }]);
            setDoor('roll');
            setDoorRoll(null);
            setDoorReport(null);
          }}>다른 문 조사</button>}
          <details className="fold play-environment" open={environmentOpen} onToggle={(event) => setEnvironmentOpen(event.currentTarget.open)}>
            <summary>환경 함정</summary>
            {lock('environment', setEnvironmentReport)}
          </details>
        </div>
      </details>
      {room && (
        <>
          <details className="fold" open={searchOpen} onToggle={(event) => setSearchOpen(event.currentTarget.open)}>
            <summary>방 뒤지기</summary>
            <div className="play-explore-action-body"><Scavenge onReport={setScavenge} onCombat={() => onCombat('scavenge')} /></div>
          </details>
          <details className="fold" open={deepOpen} onToggle={(event) => setDeepOpen(event.currentTarget.open)}>
            <summary>깊은 수색</summary>
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
          </details>
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

function Scavenge({ onReport, onCombat }: { onReport: (value: SearchReport) => void; onCombat: () => void }) {
  const id = useId();
  const commitRoll = usePlayRoll();
  const [check, setCheck] = usePlayDraftState<{ skill: string; roll: number; edge: Edge } | null>('scavenge-check', null);
  const [draftSkill, setSkill] = useState<string | null>(null);
  const [draftRoll, setRoll] = useState<string | null>(null);
  const [draftEdge, setEdge] = useState<Edge | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [bonus, setBonus] = usePlayDraftState('scavenge-bonus', false);
  const [tableRoll, setTableRoll] = usePlayDraftState<number | null>('scavenge-table', null);
  const [quantity, setQuantity] = usePlayDraftState<(number | null)[]>('scavenge-quantity', []);
  const [resolve, setResolve] = usePlayDraftState<'success' | 'failure' | ''>('scavenge-resolve', '');
  const [rewards, setRewards] = usePlayDraftState('scavenge-rewards-revision', 0);
  const [spoils, setSpoils] = useState('');
  const [spoilsItem, setSpoilsItem] = useState('');
  const [spoilsGear, setSpoilsGear] = useState<GearEffect>();
  const skill = draftSkill ?? check?.skill ?? '';
  const rawRoll = draftRoll ?? (check ? String(check.roll) : '');
  const edge = draftEdge ?? check?.edge ?? 'none';
  const skillNumber = /^[+-]?\d+$/.test(skill.trim()) ? Number(skill) : NaN;
  const checkOutcome = check && resolveCheck(d100FromValue(check.roll), Number(check.skill), check.edge);
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
  useEffect(() => { onReport({ text, item, gear }); }, [onReport, text, item, gear]);

  const resetRewards = () => {
    setQuantity([]);
    setResolve('');
    setRewards((previous) => previous + 1);
    setSpoils('');
    setSpoilsItem('');
  };
  const applyCheck = (roll: number | null) => {
    if (roll === null || !Number.isSafeInteger(skillNumber)) {
      setInvalid(true);
      return;
    }
    commitRoll(() => {
      setCheck({ skill: skill.trim(), roll, edge });
      setBonus(false);
      setTableRoll(null);
      resetRewards();
    });
    setSkill(null);
    setRoll(null);
    setEdge(null);
    setInvalid(false);
  };

  return (
    <section className="play-explore-step" aria-label="방 뒤지기 판정">
      <p className="play-explore-note">Scavenge 판정 · 방마다 한 번</p>
      <form className="play-scavenge-check" data-play-roll noValidate onSubmit={(event) => {
        event.preventDefault();
        applyCheck(readOracleValue(rawRoll.trim(), 100));
      }}>
        <label className="field"><span>보정 Scavenge Skill</span><input value={skill} inputMode="text"
          onChange={(event) => setSkill(event.target.value)} placeholder="예: 55" /></label>
        <label className="field"><span>Scavenge D100</span><input value={rawRoll} inputMode="numeric" data-play-dice
          aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-scavenge-error` : undefined}
          onChange={(event) => { setRoll(event.target.value); setInvalid(false); }} placeholder="1–100/00" /></label>
        <label className="field"><span>이점</span><select value={edge} onChange={(event) => setEdge(event.target.value as Edge)}>
          <option value="none">없음</option><option value="advantage">Advantage</option><option value="disadvantage">Disadvantage</option>
        </select></label>
        <button className="btn ghost" type="submit">뒤지기 판정 확인</button>
        <button className="btn ghost" type="button" onClick={() => applyCheck(Number.isSafeInteger(skillNumber) ? rollDie(100) : null)}>D100 굴리기</button>
        {invalid && <p className="field-err" id={`${id}-scavenge-error`} role="alert">Skill 정수와 1–100 사이의 주사위(또는 00)를 입력하세요.</p>}
      </form>
      {checkOutcome && <p className="play-explore-note" role="status">뒤지기 {CHECK_LABELS[checkOutcome.outcome]}</p>}
      {checkOutcome?.outcome === 'fumble' && <button className="btn primary play-explore-action-btn" type="button" onClick={onCombat}>뒤지기 조우로</button>}
      {allowsTable && (
        <>
          {checkOutcome.outcome === 'critical' && <label className="play-explore-lair"><input type="checkbox" checked={bonus} onChange={(event) => {
            setBonus(event.target.checked);
            resetRewards();
          }} /> 대성공 보정 +5 적용</label>}
          <JournalRoll die="D20" label="뒤지기 결과" value={tableRoll} onValue={(roll) => { setTableRoll(roll); resetRewards(); }}
            resultText={effective === null ? '' : `${bonus ? `보정 ${effective} · ` : ''}${row?.ko ?? '표 범위를 벗어났습니다. 보정을 확인하세요.'}`} />
          {row?.min === 1 && (
            <label className="field"><span>참혹한 유해 Resolve 결과</span><select value={resolve} onChange={(event) => setResolve(event.target.value as typeof resolve)}>
              <option value="">판정 결과 선택</option><option value="success">성공</option><option value="failure">실패 · Sanity −1</option>
            </select></label>
          )}
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
