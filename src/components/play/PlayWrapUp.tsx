import { useCallback, useEffect, useMemo, useState } from 'react';
import { tableById, titleOf } from '../../content';
import { creatureById, type CreatureRecord } from '../../content/entries/creatures';
import { creatureSpoilsTables } from '../../lib/creature-combat';
import { journalRow } from '../../lib/loot-journal';
import { PlayDraftScope, useClearPlayDraftScope, usePlayDraftState } from '../../lib/play-draft';
import { gearCount, type GearEffect, type GearItem, type PaperChange } from '../../lib/play-inventory';
import { usePendingSkillGrowth } from '../../lib/skill-growth';
import { XRef } from '../bits';
import { CampCalculator, type CampReport } from '../CampCalculator';
import { JournalRoll, LootJournal } from '../LootJournal';
import { TensionTool, type TensionDie, type TensionResult } from '../TensionTool';
import { EMPTY_FOLLOW_UP, ExplorationFollowUp } from './ExplorationFollowUp';
import { armorRollChanges, PlayFightArmor, type ArmorRolls } from './PlayFightArmor';
import { PlaySurvival, type SurvivalPane, type SurvivalReport } from './PlaySurvival';
import '../../styles/play-wrapup.css';

interface Props {
  creature: CreatureRecord | null;
  combatEnded: boolean;
  battleId?: string;
  victoryCreatures?: CreatureRecord[];
  victoryLabels?: readonly string[];
  victoryXp?: number;
  inventory?: GearItem[];
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
  onBreatherAmbush?: () => void;
}

type Pane = 'loot' | 'breather' | 'camp' | 'survival' | 'recovery';
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
    return { label, id: `${creature.id}:${index}`, tables };
  });
  return creatureGroups;
}

const manualSlots: LootSlot[] = MANUAL_SOURCES.map((tableId) => ({ tableId, id: `loot:${tableId}`, owner: '' }));

export function PlayWrapUp({
  creature, combatEnded, battleId = 'battle', victoryCreatures, victoryLabels, victoryXp, onBattleJournalChange, onJournalChange, onSheetChange,
  inventory = [],
  onCampEncounter, campEncounterResolved, campDarkness, campAttunementBlocked,
  afterBreatherCheck = false, breatherTension = 8, breatherDarknessEffectCount, onBreatherTensionChange, onBreatherDarknessChange, onBreatherAmbush,
}: Props) {
  const pendingGrowth = usePendingSkillGrowth();
  const [pane, setPane] = usePlayDraftState<Pane>('pane', 'loot');
  const [survivalPane, setSurvivalPane] = usePlayDraftState<SurvivalPane>('survival-pane', 'treatment');
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
  const [armorOpen, setArmorOpen] = usePlayDraftState(`${battleId}:armor-open`, false);
  const clearScope = useClearPlayDraftScope();
  const active = !combatEnded && pane === 'recovery' ? 'loot' : pane;
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

  const breather = breatherRoll !== null ? `Toughness +${breatherRoll + 2}, Health +1, Exhaustion −2` : '';
  const lowered = keepTension ? breatherTension : breatherTension === 8 ? 6 : breatherTension === 6 ? 4 : lowTension;
  const extraCheck = !!breather && (afterBreatherCheck || breatherCheck !== null);
  const darknessRow = extraCheck && breatherCheck?.darkness ? journalRow('t-growing-darkness', darknessRoll) : undefined;
  const darknessForDomain = darknessRow ? darknessRoll : null;
  const darknessItems = darknessRow ? darknessFollow.items : EMPTY_FOLLOW_UP.items;
  const nextTension = !breather ? null : extraCheck
    ? breatherCheck && (!breatherCheck.darkness || darknessRow) ? breatherCheck.nextDie : null
    : lowered;
  const combatLoot = lootText(battleSlots);
  const manualLoot = lootText(manualSlots);
  const battleLine = [
    combatEnded && recovery !== null ? `전투 후 Toughness +${recovery}` : '',
    ...bosses.flatMap(({ id, name }) => sanity[id] ? [`${name} 처치 Sanity +${sanity[id]}`] : []),
    ...armorChanges.map(({ text }) => text),
    combatLoot ? `전리품 ${combatLoot}` : '',
  ].filter(Boolean).join(' · ');
  const sharedLine = [
    breather ? `숨 고르기 ${breather}, 광원 −5` : '',
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
      { id: 'breather:light', text: '광원 −5 (숨 고르기)', gear: gearCount('광원', -5) },
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
  useEffect(() => { onBattleJournalChange?.(battleLine); }, [onBattleJournalChange, battleLine]);
  const journalLine = onBattleJournalChange ? sharedLine : [battleLine, sharedLine].filter(Boolean).join(' · ');
  useEffect(() => { onJournalChange(journalLine); }, [journalLine, onJournalChange]);
  useEffect(() => { onSheetChange?.(sheet); }, [onSheetChange, sheet]);
  useEffect(() => {
    if (!combatEnded) {
      setRecovery(null);
      setArmorOpen(false);
      if (Object.keys(armorRolls).length) setArmorRolls(EMPTY_ARMOR);
      if (armorReport) {
        setArmorReport('');
        clearScope(`${battleId}:armor`);
      }
    }
  }, [combatEnded, setRecovery, setArmorOpen, armorReport, setArmorReport, armorRolls, setArmorRolls, battleId, clearScope]);
  useEffect(() => {
    if (victoryIds) return;
    if (Object.keys(sanity).length) setSanity({});
    const removed = Object.keys(lootReports).filter((id) => id.startsWith(`${battleId}:loot:`));
    if (!removed.length) return;
    removed.forEach(clearScope);
    setLootReports((previous) => {
      const remaining = { ...previous };
      removed.forEach((id) => delete remaining[id]);
      return remaining;
    });
  }, [victoryIds, battleId, lootReports, clearScope, setLootReports, sanity, setSanity]);

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
  return (
    <section className="play-wrapup" aria-label="휴식과 전리품 정리">
      {combatEnded && <section className="play-fight-checklist" aria-label="전투 종료 처리 목록">
        <h3>전투 직후</h3>
        <dl>
          <div><dt>Toughness</dt><dd>{recovery === null ? 'D4 회복' : `+${recovery}`}</dd></div>
          <div><dt>방어구</dt><dd>{armorChanges.length ? `${armorChanges.length}개 판정` : armorReport || '사용한 장비 내구도 확인'}</dd></div>
          {bosses.length > 0 && <div><dt>Overseer 처치</dt><dd>{bosses.every(({ id }) => sanity[id])
            ? `Sanity +${bosses.reduce((total, { id }) => total + sanity[id], 0)}` : 'Sanity D4 회복'}</dd></div>}
          {!!victoryXp && <div><dt>승리 보상</dt><dd>XP +{victoryXp} · 전리품</dd></div>}
        </dl>
      </section>}
      <div className="seg play-wrap-nav" role="group" aria-label="정리할 항목">
        <button type="button" aria-pressed={active === 'loot'} onClick={() => setPane('loot')}>전리품</button>
        <button type="button" aria-pressed={active === 'breather'} onClick={() => setPane('breather')}>숨 고르기</button>
        <button type="button" aria-pressed={active === 'camp'} onClick={() => setPane('camp')}>야영</button>
        <button type="button" aria-pressed={active === 'survival'} onClick={() => setPane('survival')}>치료·성장</button>
        {combatEnded && <button type="button" aria-pressed={active === 'recovery'} onClick={() => setPane('recovery')}>전투 종료</button>}
      </div>
      <div className="play-wrap-slot" hidden={active !== 'loot'}>
        <PlaySpoils groups={groups} onReport={updateLoot} />
      </div>
      <div className="play-wrap-slot" hidden={active !== 'breather'}>
        <JournalRoll die="D10" label="숨 고르기 회복" value={breatherRoll} onValue={setBreather} resultText={breather} />
        <p className="play-wrap-note">광원 5 소모, 긴장 주사위 한 단계 하락.</p>
        <p className="play-wrap-note"><XRef id="once-per-rest">Once per Rest</XRef> 능력을 다시 쓸 수 있습니다.</p>
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
          <button className="btn ghost" type="button" onClick={() => openSurvival('rot')}>부패병 판정</button>
        </div>
      </div>
      <div className="play-wrap-slot" hidden={active !== 'camp'}>
        {pendingGrowth.length > 0 && (
          <div className="play-wrap-links" role="group" aria-label="야영 성장 대기">
            <p className="play-wrap-note">{pendingGrowth.join(' · ')}</p>
            <button className="btn ghost" type="button" onClick={() => openSurvival('growth')}>대기 중인 기술 성장으로</button>
          </div>
        )}
        <CampCalculator onEncounter={onCampEncounter} encounterResolved={campEncounterResolved} domainDarkness={campDarkness}
          attunementBlocked={campAttunementBlocked} onReport={setCamp} />
        <p className="play-wrap-note"><XRef id="once-per-rest">Once per Rest와 Once per Camp Rest</XRef> 능력의 사용 가능 여부를 확인하세요.</p>
        <div className="play-wrap-links">
          <button className="btn ghost" type="button" onClick={() => openSurvival('growth')}>야영 기술 성장</button>
          <button className="btn ghost" type="button" onClick={() => openSurvival('rot')}>부패병 판정</button>
        </div>
      </div>
      <div className="play-wrap-slot" hidden={active !== 'survival'}>
        <PlayDraftScope name="survival"><PlaySurvival pane={survivalPane} onPane={setSurvivalPane} onReport={setSurvival} /></PlayDraftScope>
      </div>
      {combatEnded && (
        <div className="play-wrap-slot" hidden={active !== 'recovery'}>
          <JournalRoll key={battleId} die="D4" label="전투 후 Toughness 회복" value={recovery} onValue={setRecovery}
            resultText={recovery !== null ? `Toughness +${recovery}` : undefined} />
          {bosses.map(({ id, name }) => <JournalRoll key={`${battleId}:${id}`} die="D4" label={`${name} 처치 후 Sanity 회복`}
            value={sanity[id] ?? null} onValue={(value) => setSanity((previous) => ({ ...previous, [id]: value }))}
            resultText={sanity[id] ? `Sanity +${sanity[id]}` : undefined} />)}
          <details className="fold play-wrap-armor" open={armorOpen} onToggle={(event) => setArmorOpen(event.currentTarget.open)}>
            <summary>사용한 방어구 내구도</summary>
            <PlayDraftScope key={battleId} name={`${battleId}:armor`}>
              <PlayFightArmor items={inventory} rolls={armorRolls} onRoll={setArmorRolls} onReport={setArmorReport} />
            </PlayDraftScope>
          </details>
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
      {source === 'creature' && groups.map(({ label, id, tables }) => (
        <section className="play-spoils-chain" key={id} aria-label={`${label} 처치 보상`}>
          {groups.length > 1 && <h3 className="play-spoils-heading">{label}</h3>}
          {tables.length === 0 ? <p className="play-wrap-note">이 생물의 처치 보상에 굴림 표가 없습니다.</p>
            : tables.map((slot) => <SpoilsSlot key={slot.id} slot={slot} onReport={onReport} />)}
        </section>
      ))}
    </section>
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
            <button className="btn ghost" key={id} type="button" aria-expanded={follow === id && followOpen} onClick={() => {
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
        <div hidden={!followOpen}>
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
