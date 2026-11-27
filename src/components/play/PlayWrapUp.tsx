import { useCallback, useContext, useEffect, useId, useImperativeHandle, useMemo, useState, type ReactNode, type Ref } from 'react';
import { tableById, titleOf } from '../../content';
import { creatureById, type CreatureRecord } from '../../content/entries/creatures';
import { creatureSpoilsTables } from '../../lib/creature-combat';
import type { RequiredExplorationRoll } from '../../lib/exploration-follow-up';
import { journalRow } from '../../lib/loot-journal';
import { usePlayCharacter } from '../../lib/play-character';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraft, usePlayDraftScope, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { usePlayOngoingEffects } from '../../lib/play-effects';
import { gearCount, gearKey, type GearEffect, type GearItem, type PaperChange } from '../../lib/play-inventory';
import { BREATHER_LIGHT_COST, EMPTY_SUPPLIES, afterLightCost, lightRemaining, readPlayLight, type PlaySupplies } from '../../lib/play-light';
import { playAction } from '../../lib/play-roll-history';
import { usePendingSkillGrowth } from '../../lib/skill-growth';
import { XRef } from '../bits';
import { CampCalculator, campSuccessRange, type CampReport } from '../CampCalculator';
import { JournalRoll, LootJournal } from '../LootJournal';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { EMPTY_FOLLOW_UP, ExplorationFollowUp } from './ExplorationFollowUp';
import { armorRollChanges, PlayFightArmor, type ArmorRolls } from './PlayFightArmor';
import { PlayLight } from './PlayLight';
import { PlayDiscoveryMode } from './PlayDiscovery';
import { PlaySurvival, ROT_REST_EVENT, type SurvivalPane, type SurvivalReport } from './PlaySurvival';
import '../../styles/play-wrapup.css';

interface Props {
  creature: CreatureRecord | null;
  combatEnded: boolean;
  battleId?: string;
  victoryCreatures?: CreatureRecord[];
  victoryLabels?: readonly string[];
  victoryXp?: number;
  inventory?: GearItem[];
  supplies?: PlaySupplies;
  nextRoomLightCost?: number;
  onContinue?: () => void;
  onOpenGear?: () => void;
  onBattleJournalChange?: (text: string) => void;
  onJournalChange: (text: string) => void;
  onSheetChange?: (items: PaperChange[]) => void;
  onCampEncounter?: (planKey: string) => void;
  campEncounterResolved?: boolean | string | readonly string[];
  campDarkness?: boolean;
  campAttunementBlocked?: boolean;
  afterBreatherCheck?: boolean;
  breatherTension?: TensionDie;
  breatherDarknessEffectCount?: number;
  onBreatherTensionChange?: (sides: TensionDie | null) => void;
  onBreatherDarknessChange?: (roll: number | null) => void;
  onRequiredRolls?: (rolls: RequiredExplorationRoll[]) => void;
  onBreatherAmbush?: () => void;
  /** Desk tools that belong with the rest stop (trade, advancement) share the pane row. */
  extraPanes?: { id: string; label: string; content: ReactNode }[];
  handleRef?: Ref<WrapUpHandle>;
}

export interface WrapUpHandle {
  open: (pane: string) => void;
}

const BASE_PANES = ['loot', 'breather', 'camp', 'survival', 'recovery'] as const;
type Pane = typeof BASE_PANES[number] | (string & {});
type Source = 'creature' | typeof MANUAL_SOURCES[number];

const FOLLOW_LOOT = new Set([
  'p-potion', 'p-magic-item', 't-mundane', 't-valuable', 't-precious', 't-relics', 't-fragments',
  't-gems', 't-lore-books', 't-random-weapon', 't-random-armor', 't-random-torso', 't-random-limbs', 't-random-shield',
]);
const MANUAL_SOURCES = ['t-spoils', 't-resources', 't-container-loot', 't-valuable', 't-precious'] as const;

const EMPTY_CAMP: CampReport = { summary: '', sheet: [] };
const EMPTY_SURVIVAL: SurvivalReport = { summary: '', sheet: [] };
const EMPTY_LOOT = { journal: '', sheet: '' };
type LootReport = typeof EMPTY_LOOT & { gear?: GearEffect };
const EMPTY_ARMOR: ArmorRolls = {};
interface LootSlot {
  tableId: string;
  id: string;
  owner: string;
}

function sourcesForBattle(ids: string, battleId: string, labels: string) {
  const combatants = ids ? ids.split(',').flatMap((id) => creatureById.get(id) ?? []) : [];
  const targetLabels = labels.split('\n');
  const counts: Record<string, number> = {};
  const creatureGroups = combatants.map((creature, index) => {
    counts[creature.id] = (counts[creature.id] ?? 0) + 1;
    const duplicate = combatants.some((other, i) => other.id === creature.id && i !== index);
    const label = targetLabels[index] || (duplicate ? `${creature.name} ${counts[creature.id]}` : creature.name);
    const tables = creatureSpoilsTables(creature).map((tableId) => ({
      tableId, id: `${battleId}:loot:${creature.id}:${index}:${tableId}`, owner: combatants.length > 1 ? label : '',
    }));
    return { label, id: `${creature.id}:${index}`, tables, overseer: creature.group === 'overseer' };
  });
  return creatureGroups;
}

const manualSlots: LootSlot[] = MANUAL_SOURCES.map((tableId) => ({ tableId, id: `loot:${tableId}`, owner: '' }));

export function PlayWrapUp({
  creature, combatEnded, battleId = 'battle', victoryCreatures, victoryLabels, victoryXp, onBattleJournalChange, onJournalChange, onSheetChange,
  inventory = [], supplies = EMPTY_SUPPLIES, nextRoomLightCost = 1, onContinue, onOpenGear,
  onCampEncounter, campEncounterResolved, campDarkness, campAttunementBlocked,
  afterBreatherCheck = false, breatherTension = 8, breatherDarknessEffectCount, onBreatherTensionChange, onBreatherDarknessChange, onBreatherAmbush, onRequiredRolls,
  extraPanes = [], handleRef,
}: Props) {
  const paneId = useId();
  const pendingGrowth = usePendingSkillGrowth();
  const draft = usePlayDraft();
  const scope = usePlayDraftScope();
  const pc = usePlayCharacter();
  const commit = usePlayRoll();
  const ongoing = usePlayOngoingEffects();
  const [pane, setPane] = usePlayDraftState<Pane>('pane', 'loot');
  const [survivalPane, setSurvivalPane] = usePlayDraftState<SurvivalPane>('survival-pane', 'treatment');
  const [paneBattle, setPaneBattle] = usePlayDraftState('pane-battle', '');
  const [camp, setCamp] = useState<CampReport>(EMPTY_CAMP);
  const [survival, setSurvival] = useState<SurvivalReport>(EMPTY_SURVIVAL);
  const [lootReports, setLootReports] = usePlayDraftState<Record<string, LootReport>>('loot-reports', {});
  const [breatherRoll, setBreatherRoll] = usePlayDraftState<number | null>('breather-roll', null);
  const [keepTension, setKeepTension] = usePlayDraftState('breather-keep-tension', false);
  const [lowTension, setLowTension] = usePlayDraftState<TensionDie | null>('breather-low-tension', null);
  const [breatherCheck, setBreatherCheck] = usePlayDraftState<TensionResult | null>('breather-tension-check', null);
  const [darknessRoll, setDarknessRoll] = usePlayDraftState<number | null>('breather-darkness-roll', null);
  const [darknessFollow, setDarknessFollow] = useState(EMPTY_FOLLOW_UP);
  const [recovery, setRecovery] = usePlayDraftState<number | null>(`${battleId}:recovery`, null);
  const [sanity, setSanity] = usePlayDraftState<Record<string, number>>(`${battleId}:overseer-sanity`, {});
  const [armorReport, setArmorReport] = usePlayDraftState(`${battleId}:armor-report`, '');
  const [armorRolls, setArmorRolls] = usePlayDraftState<ArmorRolls>(`${battleId}:armor-checks`, EMPTY_ARMOR);
  const clearScope = useClearPlayDraftScope();
  const known = (BASE_PANES as readonly string[]).includes(pane) || extraPanes.some(({ id }) => id === pane);
  const active = !known || (!combatEnded && pane === 'recovery') ? 'loot' : pane;
  // A freshly finished fight opens on its after-fight steps (Toughness, armor, Overseer Sanity) before loot, as in the book.
  // A fight that broke into a breather or camp returns to that rest instead, so its saved plan can be finished.
  useEffect(() => {
    if (!combatEnded || paneBattle === battleId) return;
    setPaneBattle(battleId);
    if (pane !== 'camp' && pane !== 'breather') setPane('recovery');
  }, [combatEnded, paneBattle, battleId, pane, setPaneBattle, setPane]);
  const goToPane = (next: string, focusLabel?: string) => {
    setPane(next);
    requestAnimationFrame(() => {
      const pane = document.getElementById(`${paneId}-${next}`);
      const control = 'input:not([disabled]), select:not([disabled]), button:not([disabled])';
      const anchor = focusLabel ? pane?.querySelector<HTMLElement>(`[aria-label="${CSS.escape(focusLabel)}"], [data-play-roll-label="${CSS.escape(focusLabel)}"]`) : null;
      const target = (anchor?.matches(control) ? anchor : anchor?.querySelector<HTMLElement>(control)) ?? pane?.querySelector<HTMLElement>(control);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
  };
  useImperativeHandle(handleRef, () => ({
    open(next) {
      setPane(next);
      requestAnimationFrame(() => {
        const button = document.querySelector<HTMLElement>(`button[aria-controls="${CSS.escape(`${paneId}-${next}`)}"]`);
        button?.focus({ preventScroll: true });
        button?.scrollIntoView({ block: 'nearest' });
      });
    },
  }), [paneId, setPane]);
  const victoryIds = combatEnded ? (victoryCreatures ?? (creature ? [creature] : [])).map(({ id }) => id).join(',') : '';
  const victoryNames = victoryLabels?.join('\n') ?? '';
  const bosses = useMemo(() => victoryIds.split(',').flatMap((id, index) => {
    const entry = creatureById.get(id);
    return entry?.group === 'overseer' ? [{ id: `${id}:${index}`, name: victoryNames.split('\n')[index] || entry.name }] : [];
  }), [victoryIds, victoryNames]);
  const armorChanges = useMemo(() => armorRollChanges(battleId, armorRolls), [battleId, armorRolls]);
  const groups = useMemo(() => sourcesForBattle(victoryIds, battleId, victoryNames), [victoryIds, battleId, victoryNames]);
  const battleSlots = useMemo(() => groups.flatMap(({ tables }) => tables), [groups]);

  const lootText = (slots: LootSlot[]) => slots.flatMap(({ id, owner }) => {
    const result = lootReports[id]?.journal;
    return result ? [owner ? `${owner} ${result}` : result] : [];
  }).join(' / ');
  const updateLoot = useCallback((id: string, report: LootReport) => {
    setLootReports((previous) => {
      const old = previous[id] ?? EMPTY_LOOT;
      if (JSON.stringify(old) === JSON.stringify(report)) return previous;
      return { ...previous, [id]: report };
    });
  }, [setLootReports]);

  const remainingLight = lightRemaining(draft ? readPlayLight(draft.slots) : null, supplies.lightEntries);
  const breather = breatherRoll !== null ? `Toughness +${breatherRoll + 2}, Health +1, Exhaustion −2` : '';
  const lowered = keepTension ? breatherTension : breatherTension === 8 ? 6 : breatherTension === 6 ? 4 : lowTension;
  const extraCheck = !!breather && (afterBreatherCheck || breatherCheck !== null);
  const darknessRow = extraCheck && breatherCheck?.darkness ? journalRow('t-growing-darkness', darknessRoll) : undefined;
  const darknessForDomain = darknessRow ? darknessRoll : null;
  const darknessItems = darknessRow ? darknessFollow.items : EMPTY_FOLLOW_UP.items;
  const pendingBreatherRolls = useMemo<RequiredExplorationRoll[]>(() => {
    if (!extraCheck) return [];
    if (!breatherCheck) return [{ label: '숨 고르기 · 긴장 주사위', field: `${scope}tension` }];
    if (breatherCheck.darkness && darknessRoll === null) return [{ label: '숨 고르기 · 짙어지는 어둠 D100',
      field: `${scope}journal:${titleOf('t-growing-darkness').ko}` }];
    return darknessRow ? darknessFollow.required.map((roll) => ({ ...roll, label: `숨 고르기 · ${roll.label}` })) : [];
  }, [extraCheck, breatherCheck, darknessRoll, scope, darknessRow, darknessFollow.required]);
  const nextTension = !breather ? null : extraCheck
    ? breatherCheck && (!breatherCheck.darkness || darknessRow) ? breatherCheck.nextDie : null
    : lowered;
  const restHistory = (label: string, fallback: string) => draft?.history.slice().reverse().find((entry) =>
    entry.label === label && entry.stage === 'wrapup')?.id ?? fallback;
  const breatherRestId = nextTension === null ? '' : restHistory('숨 고르기 회복', `숨 고르기 ${breatherRoll}`);
  const campRestId = camp.canCompleteRest ? restHistory('야영 판정', camp.summary) : '';
  const combatLoot = lootText(battleSlots);
  const manualLoot = lootText(manualSlots);
  const battleLine = [
    combatEnded && recovery !== null ? `전투 후 Toughness +${recovery}` : '',
    ...bosses.flatMap(({ id, name }) => sanity[id] ? [`${name} 처치 Sanity +${sanity[id]}`] : []),
    ...armorChanges.map(({ text }) => text),
    combatLoot ? `전리품 ${combatLoot}` : '',
  ].filter(Boolean).join(' · ');
  const sharedLine = [
    breather ? `숨 고르기 ${breather}, 광원 −${BREATHER_LIGHT_COST}` : '',
    darknessRow ? `숨 고르기 후 어둠 D100 ${darknessRoll} · ${darknessRow.ko}` : '',
    ...darknessItems.map(({ text }) => text),
    camp.summary,
    survival.summary,
    manualLoot ? `전리품 ${manualLoot}` : '',
  ].filter(Boolean).join(' · ');

  const sheet = useMemo(() => {
    const result: PaperChange[] = [...camp.sheet, ...survival.sheet,
      ...darknessItems.map((item) => ({ ...item, id: `breather:${item.id}` }))];
    if (breatherRoll !== null) result.push(
      { id: 'breather:toughness', text: `Toughness +${breatherRoll + 2} (숨 고르기)` },
      { id: 'breather:health', text: 'Health +1 (숨 고르기)' },
      { id: 'breather:exhaustion', text: 'Exhaustion −2 (숨 고르기)' },
      { id: 'breather:light', text: `광원 −${BREATHER_LIGHT_COST} (숨 고르기)`, gear: gearCount('광원', -BREATHER_LIGHT_COST) },
    );
    if (combatEnded) {
      if (recovery !== null) result.push({ id: `${battleId}:toughness`, text: `Toughness +${recovery} (전투 종료)` });
      result.push(...armorChanges);
      if (armorReport || armorChanges.length === 0) result.push({ id: `${battleId}:armor`, text: armorReport || '사용한 방어구 내구도 판정' });
      for (const { id, name } of bosses) if (sanity[id]) {
        result.push({ id: `${battleId}:sanity:${id}`, text: `Sanity +${sanity[id]} (${name} 처치)` });
      }
      if (victoryIds && victoryXp) result.push({ id: `${battleId}:xp`, text: `XP +${victoryXp} (승리)` });
    }
    for (const { id, owner } of [...manualSlots, ...battleSlots]) {
      const loot = lootReports[id];
      if (loot?.sheet) result.push({ id, text: owner ? `${loot.sheet} · ${owner} 처치 보상` : loot.sheet, gear: loot.gear });
    }
    return result;
  }, [camp.sheet, survival.sheet, darknessItems, breatherRoll, combatEnded, recovery, battleId, armorReport,
    armorChanges, bosses, sanity, victoryIds, victoryXp, battleSlots, lootReports]);

  useEffect(() => { onBreatherDarknessChange?.(darknessForDomain); }, [onBreatherDarknessChange, darknessForDomain]);
  useEffect(() => { onBreatherTensionChange?.(nextTension); }, [onBreatherTensionChange, nextTension]);
  useEffect(() => { onRequiredRolls?.(pendingBreatherRolls); }, [onRequiredRolls, pendingBreatherRolls]);
  useEffect(() => { onBattleJournalChange?.(battleLine); }, [onBattleJournalChange, battleLine]);
  const journalLine = onBattleJournalChange ? sharedLine : [battleLine, sharedLine].filter(Boolean).join(' · ');
  useEffect(() => { onJournalChange(journalLine); }, [journalLine, onJournalChange]);
  useEffect(() => { onSheetChange?.(sheet); }, [onSheetChange, sheet]);
  useEffect(() => {
    if (!combatEnded) {
      setRecovery(null);
      if (Object.keys(armorRolls).length) setArmorRolls(EMPTY_ARMOR);
      if (armorReport) {
        setArmorReport('');
        clearScope(`${battleId}:armor`);
      }
    }
  }, [combatEnded, setRecovery, armorReport, setArmorReport, armorRolls, setArmorRolls, battleId, clearScope]);
  useEffect(() => {
    if (combatEnded || victoryIds) return;
    if (Object.keys(sanity).length) setSanity({});
    const removed = Object.keys(lootReports).filter((id) => id.startsWith(`${battleId}:loot:`));
    if (!removed.length) return;
    removed.forEach(clearScope);
    setLootReports((previous) => {
      const remaining = { ...previous };
      removed.forEach((id) => delete remaining[id]);
      return remaining;
    });
  }, [combatEnded, victoryIds, battleId, lootReports, clearScope, setLootReports, sanity, setSanity]);

  const applyDarkness = (value: number | null) => {
    if (darknessRoll !== value) {
      clearScope('breather-darkness-follow');
      setDarknessFollow(EMPTY_FOLLOW_UP);
    }
    setDarknessRoll(value);
  };
  const setBreather = (value: number | null) => {
    setBreatherRoll(value);
    setLowTension(null);
    setBreatherCheck(null);
    applyDarkness(null);
  };
  const openSurvival = (next: SurvivalPane) => {
    setSurvivalPane(next);
    setPane('survival');
  };
  const openRestRot = (rest: 'breather' | 'camp') => {
    openSurvival('rot');
    document.dispatchEvent(new CustomEvent(ROT_REST_EVENT, { detail: rest }));
  };
  const rationPlan = camp.preview?.ration === 'missing' ? 'Ration 없음 · 성공 시 회복 절반'
    : camp.preview?.ration === 'cooked' ? '요리한 Ration 1개 사용'
      : `Ration 1개 사용${!camp.summary && supplies.ration === 0 ? ' · 장부 부족' : ''}`;
  const campMaterials = Object.entries(camp.preview?.spent ?? {}).flatMap(([name, amount]) => {
    if (name === 'Ration' || amount === 0) return [];
    const entries = inventory.filter((item) => item.integrity !== 'broken' && gearKey(item.name) === gearKey(name));
    const known = entries.reduce((total, item) => total + item.count, 0);
    const shortage = !camp.summary && entries.length > 0 && known < amount ? ` (장부 ${amount - known}개 부족)` : '';
    return [`${name} ${amount}개${shortage}`];
  }).join(' · ');
  const breatherDie = lowered === null ? `D${breatherTension} · 하락 후 주사위 확인`
    : keepTension ? `D${lowered} 유지` : `D${breatherTension} → D${lowered}`;
  return (
    <section className="play-wrapup" aria-label="휴식과 전리품 정리">
      {combatEnded && <section className="play-fight-checklist" aria-label="전투 종료 처리 목록">
        <h3>전투 직후</h3>
        <dl>
          <div><dt>Toughness</dt><dd><button type="button" className="linkbtn" onClick={() => goToPane('recovery', '전투 후 Toughness 회복')}>
            {recovery === null ? 'D4 회복' : `+${recovery}`}</button></dd></div>
          <div><dt>방어구</dt><dd><button type="button" className="linkbtn" onClick={() => goToPane('recovery', '사용한 방어구 내구도')}>
            {armorChanges.length ? `${armorChanges.length}개 판정` : armorReport || '사용한 장비 내구도 확인'}</button></dd></div>
          {bosses.length > 0 && <div><dt>Overseer 처치</dt><dd><button type="button" className="linkbtn" onClick={() => goToPane('recovery')}>
            {bosses.every(({ id }) => sanity[id]) ? `Sanity +${bosses.reduce((total, { id }) => total + sanity[id], 0)}` : 'Sanity D4 회복'}</button></dd></div>}
          {!!victoryXp && <div><dt>승리 보상</dt><dd><button type="button" className="linkbtn" onClick={() => goToPane('loot')}>XP +{victoryXp} · 전리품</button></dd></div>}
        </dl>
      </section>}
      <section className="play-travel-choices" aria-label="계속 탐험과 휴식 비용 비교">
        <div className="play-travel-choice">
          <strong>계속 탐험</strong>
          <p>다음 방 · {afterLightCost(remainingLight, nextRoomLightCost)}</p>
          <p>다음 장소에서 긴장 D{nextTension ?? breatherTension} 판정</p>
          {onContinue && <button type="button" className="linkbtn" onClick={onContinue}>탐험 계속 준비</button>}
        </div>
        <div className="play-travel-choice">
          <strong>숨 고르기</strong>
          <p>{breatherRoll === null ? afterLightCost(remainingLight, BREATHER_LIGHT_COST) : `광원 ${BREATHER_LIGHT_COST} 소모 기록됨`}</p>
          <p>{pc?.exhaustion === undefined || breatherRoll !== null ? 'Exhaustion −2'
            : `Exhaustion ${pc.exhaustion} → ${Math.max(0, pc.exhaustion - 2)}`} · 긴장 {breatherDie}</p>
          {afterBreatherCheck && <p>하락 후 긴장 주사위 추가 판정</p>}
        </div>
        <div className="play-travel-choice">
          <strong>야영</strong>
          {camp.preview ? <>
            <p>{rationPlan}{supplies.ration !== null && ` · 현재 식량 ${supplies.ration}개`}</p>
            {campMaterials && <p>소모 · {campMaterials}</p>}
            <p>성공 D20 {campSuccessRange(camp.preview.threshold)} · 실패 시 조우</p>
            {camp.preview.activityExhaustion !== 0 && <p>활동 Exhaustion {camp.preview.activityExhaustion > 0
              ? `+${camp.preview.activityExhaustion}` : `−${Math.abs(camp.preview.activityExhaustion)}`}</p>}
          </> : <p>야영 활동의 수량과 보정을 확인하세요.</p>}
        </div>
      </section>
      <div className="seg play-wrap-nav" role="group" aria-label="정리할 항목">
        {combatEnded && <button type="button" aria-controls={`${paneId}-recovery`} aria-pressed={active === 'recovery'} onClick={() => setPane('recovery')}>전투 종료</button>}
        <button type="button" aria-controls={`${paneId}-loot`} aria-pressed={active === 'loot'} onClick={() => setPane('loot')}>전리품</button>
        <button type="button" aria-controls={`${paneId}-breather`} aria-pressed={active === 'breather'} onClick={() => setPane('breather')}>숨 고르기</button>
        <button type="button" aria-controls={`${paneId}-camp`} aria-pressed={active === 'camp'} onClick={() => setPane('camp')}>야영</button>
        <button type="button" aria-controls={`${paneId}-survival`} aria-pressed={active === 'survival'} onClick={() => setPane('survival')}>치료·성장</button>
        {extraPanes.map(({ id, label }) => (
          <button key={id} type="button" aria-controls={`${paneId}-${id}`} aria-pressed={active === id} onClick={() => setPane(id)}>{label}</button>
        ))}
      </div>
      {extraPanes.map(({ id, content }) => (
        <div key={id} className="play-wrap-slot" id={`${paneId}-${id}`} hidden={active !== id}>{content}</div>
      ))}
      <div className="play-wrap-slot" id={`${paneId}-loot`} hidden={active !== 'loot'}>
        <PlaySpoils groups={groups} onReport={updateLoot} />
      </div>
      <div className="play-wrap-slot" id={`${paneId}-breather`} hidden={active !== 'breather'}>
        <PlayLight supplies={supplies} onOpenGear={onOpenGear} />
        {breatherRoll === null && remainingLight !== null && remainingLight < BREATHER_LIGHT_COST &&
          <p className="field-err" role="status">광원 {BREATHER_LIGHT_COST - remainingLight} 부족 · 숨 고르기 후 광원이 남지 않습니다.</p>}
        <JournalRoll die="D10" label="숨 고르기 회복" value={breatherRoll} onValue={setBreather} resultText={breather} />
        <p className="play-wrap-note">광원 {BREATHER_LIGHT_COST} 소모, 긴장 주사위 한 단계 하락.</p>
        <p className="play-wrap-note"><XRef id="once-per-rest">Once per Rest</XRef> 능력을 다시 쓸 수 있습니다.</p>
        {breatherRestId && <button type="button" className="btn ghost play-wrap-clear" disabled={draft?.slots.confirmedBreather === breatherRestId}
          onClick={() => ongoing.confirmRest('rest', breatherRestId)}>{draft?.slots.confirmedBreather === breatherRestId ? '숨 고르기 완료됨' : '숨 고르기 완료 확인'}</button>}
        {breather && (
          <>
            <label className="play-breather-option"><input type="checkbox" checked={keepTension} onChange={(event) => {
              setKeepTension(event.target.checked);
              setBreatherCheck(null);
              applyDarkness(null);
            }} /> 장신구 효과로 긴장 주사위 유지</label>
            {!keepTension && breatherTension === 4 && (
              <label className="field play-breather-size"><span>하락 처리 후 긴장 주사위</span>
                <select value={lowTension ?? ''} onChange={(event) => {
                  const chosen = [8, 6, 4].find((size) => String(size) === event.target.value) as TensionDie | undefined;
                  setLowTension(chosen ?? null);
                  setBreatherCheck(null);
                  applyDarkness(null);
                }}>
                  <option value="">현재 D4 · 적용할 주사위 선택</option>
                  {[8, 6, 4].map((size) => <option value={size} key={size}>D{size}</option>)}
                </select>
              </label>
            )}
            {extraCheck && (
              <section className="play-wrap-slot" aria-label="숨 고르기 후 긴장 판정">
                <p className="play-wrap-note">짙어지는 어둠 15–16 · 하락을 적용한 뒤 긴장 주사위를 굴립니다.</p>
                <TensionTool initialSides={lowered ?? breatherTension} value={breatherCheck} showDarknessLink={false} onResult={(result) => {
                  setBreatherCheck(result);
                  applyDarkness(null);
                }} />
                {breatherCheck?.darkness && (
                  <JournalRoll tableId="t-growing-darkness" value={darknessRoll} onValue={applyDarkness} />
                )}
                <PlayDraftScope name="breather-darkness-follow">
                  <ExplorationFollowUp key={darknessRoll} kind="darkness" row={darknessRow?.min}
                    darknessEffectCount={breatherDarknessEffectCount} onReport={setDarknessFollow} onCombat={onBreatherAmbush} />
                </PlayDraftScope>
                {darknessRow?.next?.some(({ id }) => id === 't-encounter-general') && (
                  onBreatherAmbush ? <button type="button" className="btn primary play-wrap-clear" onClick={onBreatherAmbush}>숨 고르기 중 매복 조우로</button>
                    : <XRef id="t-encounter-general">매복 조우 표 열기</XRef>
                )}
              </section>
            )}
            <button type="button" className="btn ghost play-wrap-clear" onClick={() => setBreather(null)}>숨 고르기 지우기</button>
          </>
        )}
        <div className="play-wrap-links"><XRef id="take-a-breather">숨 고르기 규칙</XRef>
          <button className="btn ghost" type="button" onClick={() => openRestRot('breather')}>부패병 판정</button>
        </div>
      </div>
      <div className="play-wrap-slot" id={`${paneId}-camp`} hidden={active !== 'camp'}>
        {pendingGrowth.length > 0 && (
          <div className="play-wrap-links" role="group" aria-label="야영 성장 대기">
            <p className="play-wrap-note">{pendingGrowth.join(' · ')}</p>
            <button className="btn ghost" type="button" onClick={() => openSurvival('growth')}>대기 중인 기술 성장으로</button>
          </div>
        )}
        <CampCalculator onEncounter={onCampEncounter} encounterResolved={campEncounterResolved} domainDarkness={campDarkness}
          attunementBlocked={campAttunementBlocked} inventory={inventory} onReport={setCamp} />
        <p className="play-wrap-note"><XRef id="once-per-rest">Once per Rest와 Once per Camp Rest</XRef> 능력의 사용 가능 여부를 확인하세요.</p>
        {campRestId && <button type="button" className="btn ghost play-wrap-clear" disabled={draft?.slots.confirmedCamp === campRestId}
          onClick={() => commit(() => ongoing.confirmRest('camp', campRestId), playAction('야영 완료'))}>
          {draft?.slots.confirmedCamp === campRestId ? '야영 완료됨' : '야영 완료 확인'}</button>}
        <div className="play-wrap-links">
          <button className="btn ghost" type="button" onClick={() => openSurvival('growth')}>야영 기술 성장</button>
          <button className="btn ghost" type="button" onClick={() => openRestRot('camp')}>부패병 판정</button>
        </div>
      </div>
      <div className="play-wrap-slot" id={`${paneId}-survival`} hidden={active !== 'survival'}>
        <PlayDraftScope name="survival"><PlaySurvival pane={survivalPane} onPane={setSurvivalPane} onReport={setSurvival} /></PlayDraftScope>
      </div>
      {combatEnded && (
        <div className="play-wrap-slot" id={`${paneId}-recovery`} hidden={active !== 'recovery'}>
          <JournalRoll key={battleId} die="D4" label="전투 후 Toughness 회복" rollContext={battleId} value={recovery} onValue={setRecovery}
            resultText={recovery !== null ? `Toughness +${recovery}` : undefined} />
          {bosses.map(({ id, name }) => <JournalRoll key={`${battleId}:${id}`} die="D4" label={`${name} 처치 후 Sanity 회복`} rollContext={`${battleId}:${id}`}
            value={sanity[id] ?? null} onValue={(value) => setSanity((previous) => ({ ...previous, [id]: value }))}
            resultText={sanity[id] ? `Sanity +${sanity[id]}` : undefined} />)}
          <section className="play-wrap-armor" aria-label="사용한 방어구 내구도">
            <h4>사용한 방어구 내구도</h4>
            <PlayDraftScope key={battleId} name={`${battleId}:armor`}>
              <PlayFightArmor items={inventory} rolls={armorRolls} onRoll={setArmorRolls} onReport={setArmorReport} />
            </PlayDraftScope>
          </section>
          <div className="play-wrap-links">
            <XRef id="combat-end">전투 종료 규칙</XRef>
            <button className="btn ghost" type="button" onClick={() => openSurvival('treatment')}>남은 지속 피해 처리</button>
          </div>
        </div>
      )}
    </section>
  );
}

function PlaySpoils({ groups, onReport }: { groups: ReturnType<typeof sourcesForBattle>; onReport: (id: string, report: LootReport) => void }) {
  const [choice, setChoice] = usePlayDraftState<Source | null>('loot-source', null);
  const discovery = useContext(PlayDiscoveryMode);
  const hasDefeated = groups.length > 0;
  const source = choice && (choice !== 'creature' || hasDefeated) ? choice : hasDefeated ? 'creature' : 't-spoils';
  const manual = manualSlots.find(({ tableId }) => tableId === source);
  return (
    <section className="play-spoils" aria-label="전리품 굴림">
      <label className="field play-spoils-source">
        <span>전리품 표</span>
        <select value={source} onChange={(event) => setChoice(event.target.value as Source)}>
          {hasDefeated && <option value="creature">{groups.length === 1 ? `${groups[0].label} 처치 보상` : '생물별 처치 보상'}</option>}
          {MANUAL_SOURCES.map((id) => <option key={id} value={id}>{titleOf(id).ko}</option>)}
        </select>
      </label>
      {manual && <SpoilsSlot key={manual.id} slot={manual} onReport={onReport} />}
      {source === 'creature' && groups.map(({ label, id, tables, overseer }) => (
        <section className="play-spoils-chain" key={id} aria-label={`${label} 처치 보상`}>
          {groups.length > 1 && <h3 className="play-spoils-heading">{label}</h3>}
          {tables.length === 0 ? <p className="play-wrap-note">이 생물의 처치 보상에 굴림 표가 없습니다.</p>
            : discovery && overseer ? <HiddenSpoils tables={tables} onReport={onReport} />
              : tables.map((slot) => <SpoilsSlot key={slot.id} slot={slot} onReport={onReport} />)}
        </section>
      ))}
    </section>
  );
}

function HiddenSpoils({ tables, onReport }: { tables: LootSlot[]; onReport: (id: string, report: LootReport) => void }) {
  const draft = usePlayDraft();
  const scope = usePlayDraftScope();
  const [revealed, setRevealed] = usePlayDraftState<boolean | null>(`spoils-revealed:${tables[0].id}`, null);
  const hasResult = tables.some(({ id }) => typeof draft?.slots[`${scope}${encodeURIComponent(id)}/roll`] === 'number');
  const open = revealed ?? hasResult;
  return (
    <details className="fold play-spoils-discovery" open={open} onToggle={(event) => {
      if (event.target === event.currentTarget && event.currentTarget.open !== open) setRevealed(event.currentTarget.open);
    }}>
      <summary>처치 보상 확인</summary>
      <div className="play-spoils-chain">
        {tables.map((slot) => <SpoilsSlot key={slot.id} slot={slot} onReport={onReport} />)}
      </div>
    </details>
  );
}

function SpoilsSlot({ slot, onReport }: { slot: LootSlot; onReport: (id: string, report: LootReport) => void }) {
  return (
    <PlayDraftScope name={slot.id}>
      <SpoilsSlotBody slot={slot} onReport={onReport} />
    </PlayDraftScope>
  );
}

function SpoilsSlotBody({ slot, onReport }: { slot: LootSlot; onReport: (id: string, report: LootReport) => void }) {
  const publish = useCallback((report: LootReport) => onReport(slot.id, report), [onReport, slot.id]);
  return <SpoilsRollBody tableId={slot.tableId} onReport={publish} />;
}

export function SpoilsRoll({ tableId, onReport, onSheetChange, onGearChange }: {
  tableId: string; onReport: (text: string) => void; onSheetChange?: (text: string) => void; onGearChange?: (gear: GearEffect | undefined) => void;
}) {
  const publish = useCallback((report: LootReport) => {
    onReport(report.journal);
    onSheetChange?.(report.sheet);
    onGearChange?.(report.gear);
  }, [onReport, onSheetChange, onGearChange]);
  return <SpoilsRollBody tableId={tableId} onReport={publish} />;
}

function SpoilsRollBody({ tableId, onReport }: { tableId: string; onReport: (report: LootReport) => void }) {
  const followId = useId();
  const [value, setValue] = usePlayDraftState<number | null>('roll', null);
  const [follow, setFollow] = usePlayDraftState('follow', '');
  const [followOpen, setFollowOpen] = usePlayDraftState('follow-open', false);
  const [followReport, setFollowReport] = usePlayDraftState<LootReport>('follow-report', EMPTY_LOOT);
  const [quantity, setQuantity] = usePlayDraftState<number | null>('quantity', null);
  const [gemValues, setGemValues] = usePlayDraftState<(number | null)[]>('gem-values', []);
  const clearScope = useClearPlayDraftScope();
  const [localFollowKey, setLocalFollowKey] = useState(0);
  const row = journalRow(tableId, value);
  const next = row?.next ?? [];
  const itemJournal = next.find(({ id }) => id === 'p-potion' || id === 'p-magic-item');
  const choices = itemJournal ? [itemJournal] : next.filter(({ id }) => FOLLOW_LOOT.has(id));
  const onlyRefs = next.filter(({ id }) => !choices.some((choice) => choice.id === id));
  const quantityRule = /^(.*?) (D4|D10)\.$/.exec(row?.ko ?? '');
  const quantityItem = quantityRule?.[1];
  const quantityDie = quantityRule?.[2] === 'D10' ? 'D10' : 'D4';
  const gemDice = /^(\d*)D100₵$/.exec(row?.ko ?? '');
  const gemCount = gemDice ? Number(gemDice[1] || '1') : 0;
  const gems = gemCount && gemValues.length === gemCount && gemValues.every((number) => number !== null)
    ? gemValues.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const effect = row?.ko.replace(/\.$/, '') ?? '';
  const outcome = row?.label && !effect.includes(row.label) ? `${row.label} · ${effect}` : effect;
  const journal = follow ? followReport.journal || outcome
    : quantityItem && quantity !== null ? `${quantityItem} ${quantity}`
    : gems !== null ? `${row?.label} ${gems}₵` : outcome;
  const counted = /^(.*?) (\d+)$/.exec(effect);
  const sheet = /^아무것도 없음|쓸모없음/.test(effect) ? ''
    : follow ? followReport.sheet
    : quantityItem ? quantity !== null ? `${quantityItem} +${quantity}` : ''
    : gemCount ? gems !== null ? `장신구 가치 ${gems}₵` : ''
    : choices.length ? '' : counted ? `${counted[1]} +${counted[2]}` : outcome;
  const quantityName = quantityItem ?? counted?.[1];
  const quantityValue = quantityItem ? quantity : counted ? Number(counted[2]) : null;
  const acquisition = useMemo(() => {
    if (!sheet) return undefined;
    if (follow) return followReport.gear;
    if (quantityName && quantityValue) return gearCount(quantityName, quantityValue);
    if (gems !== null) return { kind: 'count', name: `${row?.label ?? '보석'} (${gems}₵)`, amount: 1, weight: 'gems' } satisfies GearEffect;
    if (row && !choices.length) {
      const single = row.label ?? (tableId === 't-fragments' ? row.ko.split(':')[0] : undefined);
      if (single && (['t-mundane', 't-valuable', 't-container-loot', 't-fragments', 't-relics', 't-lore-books'].includes(tableId)
        || tableId.startsWith('t-random-') && row.label === row.ko)) {
        return tableId === 't-fragments' ? { kind: 'count', name: single, amount: 1, weight: 'light' } satisfies GearEffect : gearCount(single, 1);
      }
    }
    return undefined;
  }, [sheet, follow, followReport.gear, quantityName, quantityValue, gems, row, choices.length, tableId]);
  useEffect(() => { onReport({ journal, sheet, gear: acquisition }); }, [onReport, journal, sheet, acquisition]);
  const onItemReport = useCallback((text: string, gear?: GearEffect) => {
    setFollowReport((previous) => JSON.stringify(previous) === JSON.stringify({ journal: text, sheet: text, gear })
      ? previous : { journal: text, sheet: text, gear });
  }, [setFollowReport]);
  const onNestedReport = useCallback((report: LootReport) => {
    setFollowReport((previous) => JSON.stringify(previous) === JSON.stringify(report) ? previous : report);
  }, [setFollowReport]);
  const clearFollow = () => {
    clearScope('follow-up');
    setLocalFollowKey((key) => key + 1);
    setFollowReport(EMPTY_LOOT);
  };
  return (
    <div className="play-spoils-chain">
      <JournalRoll tableId={tableId} value={value} onValue={(roll) => {
        setValue(roll);
        setQuantity(null);
        setGemValues([]);
        setFollow('');
        setFollowOpen(false);
        clearFollow();
      }} resultText={outcome || undefined} />
      {quantityItem && (
        <JournalRoll die={quantityDie} label={`${quantityItem} 수량`} value={quantity} onValue={setQuantity}
          resultText={quantity !== null ? `${quantityItem} ${quantity}` : undefined} />
      )}
      {Array.from({ length: gemCount }, (_, index) => (
        <JournalRoll key={index} die="D100" label={`보석·장신구 가치 ${index + 1}`} value={gemValues[index] ?? null} onValue={(rolled) => {
          setGemValues((previous) => Array.from({ length: gemCount }, (_, i) => i === index ? rolled : previous[i] ?? null));
        }} />
      ))}
      {gems !== null && <p className="play-wrap-note">장신구 가치 {gems}₵</p>}
      {(choices.length > 0 || onlyRefs.length > 0) && (
        <div className="play-wrap-links">
          {choices.map(({ id }) => (
            <button className="btn ghost" key={id} type="button" aria-expanded={follow === id && followOpen}
              aria-controls={follow === id ? followId : undefined} onClick={() => {
              if (follow === id) setFollowOpen(!followOpen);
              else {
                clearFollow();
                setFollow(id);
                setFollowOpen(true);
              }
            }}>
              {titleOf(id).ko} {follow === id && followOpen ? '접기' : '이어서'}
            </button>
          ))}
          {onlyRefs.map(({ id }) => <XRef key={id} id={id} />)}
        </div>
      )}
      {follow && choices.some(({ id }) => id === follow) && (
        <div id={followId} hidden={!followOpen}>
          <PlayDraftScope key={localFollowKey} name="follow-up">
            {follow === 'p-potion' || follow === 'p-magic-item' ? (
              <LootJournal kind={follow === 'p-potion' ? 'potion' : 'magic-item'} onJournalChange={onItemReport} />
            ) : tableById.has(follow) ? <SpoilsRollBody tableId={follow} onReport={onNestedReport} /> : null}
          </PlayDraftScope>
        </div>
      )}
    </div>
  );
}
