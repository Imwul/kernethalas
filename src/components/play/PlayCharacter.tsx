import { useEffect, useState, type ReactNode } from 'react';
import { masteryCatalog } from '../../content/entries/masteries';
import { goalByName, type GearLine } from '../../lib/character-creation';
import { COUNTED_GOALS } from '../../lib/character-progress';
import {
  ACTIVE_GOAL_LIMIT, BASE_MASTERY_LIMIT, CHARACTER_DEFENSES, CHARACTER_WEAPONS, PERKS, XP_TO_LEVEL, usePlayCharacter, type CharacterMastery,
} from '../../lib/play-character';
import { usePlayCampaignId } from '../../lib/play-campaigns';
import { PlayDraftScope, usePlayDraft, usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { readGraveyard, storeGraveyard, type FallenSurvivor } from '../../lib/play-graveyard';
import { entryById } from '../../content';
import { GROWTH_SKILLS } from '../../lib/skill-growth';
import { CharacterCreator, GoalCards, perkText } from '../CharacterCreator';
import { MasteryBrowser, MasteryNodeDetail, MasteryTree, tierNumeral } from '../MasteryTree';
import { TogglePanel } from '../TogglePanel';
import { StatusIcon } from '../StatusIcon';
import { PlayExhaustion } from './PlayExhaustion';
import { PlaySanity } from './PlaySanity';
import '../../styles/edge-toggle.css';
import '../../styles/play-character.css';

const SHORT: Record<string, string> = {
  'Bladed Weapons': 'Bladed', 'Bludgeoning Weapons': 'Bludgeoning', 'Shafted Weapons': 'Shafted', 'Unarmed Combat & Fist Weapons': 'Unarmed / Fist',
};
const GROUPS = [
  { label: '기술', skills: GROWTH_SKILLS.filter((name) => !name.endsWith('Weapons')) },
  { label: '무기', skills: [...CHARACTER_WEAPONS, 'Parry'] },
  { label: '저항·기타', skills: ['Endurance', 'Resolve', 'Spellward', 'Initiative'] },
] as const;

export type CharacterSection = 'sheet' | 'state' | 'mastery' | 'goals';
/** Opens a section of the character tab from elsewhere on the desk (warnings in the bar). */
export const CHARACTER_SECTION_EVENT = 'kn:character-section';
/** Asks the combat stage to select a learned ability: detail { masteryId, tier, abilityId }. */
export const USE_ABILITY_EVENT = 'kn:play-use-ability';
/** Opens the level-up pane of the rest stage. */
export const LEVEL_UP_EVENT = 'kn:play-level-up';
const PERK_NOTES = new Map((entryById.get('perks')?.outcomes ?? []).map(({ label, text }) => [label, text]));

function ChoiceChips<T extends string>({ label, value, options, onChange, short }: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (value: T | undefined) => void;
  short?: Record<string, string>;
}) {
  return (
    <div className="field play-character-choice"><span>{label}</span>
      <div className="creator-filter-chips" role="group" aria-label={label}>
        {options.map((option) => <button key={option} type="button" aria-pressed={value === option} lang="en"
          onClick={() => onChange(value === option ? undefined : option)}>{short?.[option] ?? option}</button>)}
      </div>
    </div>
  );
}

const readScore = (raw: string, digits = 3) => {
  const value = raw.trim();
  return new RegExp(`^\\d{1,${digits}}$`).test(value) ? Number(value) : null;
};

/** The paper sheet's survivor, typed once (or made with the creator) and reused by every check in play mode. */
export function PlayCharacter({ onApplyGear }: { onApplyGear?: (lines: GearLine[]) => Promise<boolean> }) {
  return <PlayDraftScope root name="character"><CharacterSheet onApplyGear={onApplyGear} /></PlayDraftScope>;
}

function CharacterSheet({ onApplyGear }: { onApplyGear?: (lines: GearLine[]) => Promise<boolean> }) {
  const pc = usePlayCharacter();
  const [creating, setCreating] = usePlayDraftState('creating', false);
  const [section, setSection] = usePlayDraftState<CharacterSection>('section', 'sheet');
  useEffect(() => {
    const open = (event: Event) => {
      const next = (event as CustomEvent<CharacterSection>).detail;
      if (next === 'sheet' || next === 'state' || next === 'mastery' || next === 'goals') { setCreating(false); setSection(next); }
    };
    document.addEventListener(CHARACTER_SECTION_EVENT, open);
    return () => document.removeEventListener(CHARACTER_SECTION_EVENT, open);
  }, [setCreating, setSection]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  if (!pc) return null;
  const { character, room } = pc;
  if (creating) {
    return (
      <section className="play-character" aria-label="새 생존자 만들기">
        <button type="button" className="linkbtn play-character-back" onClick={() => setCreating(false)}>‹ 캐릭터 탭으로</button>
        <CharacterCreator onApplyGear={onApplyGear} onDone={() => setCreating(false)} />
      </section>
    );
  }
  const text = (key: string, saved: string) => typed[key] ?? saved;
  const type = (key: string, value: string, save: (score: number | undefined) => void, digits = 3) => {
    setTyped((previous) => ({ ...previous, [key]: value }));
    if (!value.trim()) save(undefined);
    else {
      const score = readScore(value, digits);
      if (score !== null) save(score);
    }
  };
  const settle = (key: string) => setTyped(({ [key]: _, ...rest }) => rest);
  const invalid = (key: string, digits = 3) => typed[key] !== undefined && !!typed[key].trim() && readScore(typed[key], digits) === null;
  const skillField = (name: string) => (
    <label className="field" key={name}><span lang="en">{SHORT[name] ?? name}</span>
      <input inputMode="numeric" value={text(name, pc.skill(name))} maxLength={3} aria-label={`${name} 수치`}
        aria-invalid={invalid(name) || undefined} onBlur={() => settle(name)}
        onChange={(event) => type(name, event.target.value, (score) => pc.setSkill(name, score))} />
    </label>
  );
  const empty = character.level === undefined && !character.masteries?.length;
  const xp = pc.xp;

  return (
    <section className="play-character" aria-label="캐릭터 기본값">
      <CharacterTabs section={section} onSection={setSection} />
      <div className="play-character-section" hidden={section !== 'sheet'} role="group" aria-label="기본·Skill">
        <div className="play-character-top">
          <button type="button" className={empty ? 'btn primary' : 'btn ghost'} onClick={() => setCreating(true)}>새 생존자 만들기</button>
        </div>
        <div className="play-character-head">
          <label className="field play-character-name"><span>이름</span>
            <input value={character.name ?? ''} maxLength={40} autoComplete="off" placeholder="선택"
              onChange={(event) => pc.update({ name: event.target.value.trim() ? event.target.value.slice(0, 40) : undefined })} />
          </label>
          <label className="field"><span>PC 레벨</span>
            <input inputMode="numeric" maxLength={2} value={text('level', pc.level)} aria-invalid={invalid('level') || undefined}
              onBlur={() => settle('level')} placeholder="예 3"
              onChange={(event) => type('level', event.target.value, (level) => pc.update({ level: level && level <= 99 ? level : undefined }))} />
          </label>
          <label className="field"><span>XP</span>
            <input inputMode="numeric" maxLength={7} value={text('xp', xp === undefined ? '' : String(xp))} aria-invalid={invalid('xp', 7) || undefined}
              onBlur={() => settle('xp')} placeholder="예 340"
              onChange={(event) => type('xp', event.target.value, (score) => pc.update({ xp: score === undefined ? undefined : score - room.xp }), 7)} />
          </label>
        </div>
        <XpProgress />
        <ChoiceChips label="공격 무기" value={character.weapon as (typeof CHARACTER_WEAPONS)[number] | undefined} options={CHARACTER_WEAPONS}
          short={SHORT} onChange={(weapon) => pc.update({ weapon })} />
        <ChoiceChips label="방어 기술" value={character.defense as (typeof CHARACTER_DEFENSES)[number] | undefined} options={CHARACTER_DEFENSES}
          short={SHORT} onChange={(defense) => pc.update({ defense })} />
        {GROUPS.map(({ label, skills }) => (
          <fieldset className="play-character-skills" key={label}>
            <legend>{label}</legend>
            {skills.map(skillField)}
          </fieldset>
        ))}
        <Graveyard />
      </div>
      <div className="play-character-section" hidden={section !== 'state'} role="group" aria-label="상태">
        <DeathCheck onCreate={() => setCreating(true)} />
        <PlayExhaustion />
        <PlaySanity onDeath={() => setSection('state')} />
      </div>
      <div className="play-character-section" hidden={section !== 'mastery'}><MasteryTrees /></div>
      <div className="play-character-section" hidden={section !== 'goals'}><PersonalGoals /><Perks /></div>
    </section>
  );
}

/** Section tabs that double as the character's at-a-glance status. */
function CharacterTabs({ section, onSection }: { section: CharacterSection; onSection: (section: CharacterSection) => void }) {
  const pc = usePlayCharacter();
  if (!pc) return null;
  const { character, points } = pc;
  const xp = pc.xp;
  const exhaustion = pc.exhaustion;
  const sanity = pc.sanity;
  const levelUp = xp !== undefined && xp >= XP_TO_LEVEL;
  const stateLevel = (exhaustion !== undefined && exhaustion >= 16) || sanity === 0 ? 'danger' : exhaustion !== undefined && exhaustion >= 11 ? 'warn' : undefined;
  const goals = pc.goals;
  const tab = (id: CharacterSection, label: string, detail: ReactNode, level?: string) => (
    <button key={id} type="button" aria-pressed={section === id} data-level={level} onClick={() => onSection(id)}>
      <span className="play-character-tab-label">{label}</span><span className="play-character-tab-detail">{detail}</span>
    </button>
  );
  return (
    <div className="play-character-tabs" role="group" aria-label="캐릭터 항목">
      {tab('sheet', '기본', <>{character.level ? `Lv ${character.level}` : 'Lv —'}{levelUp ? ' · 레벨업' : xp !== undefined ? ` · XP ${xp}` : ''}</>, levelUp ? 'good' : undefined)}
      {tab('state', '상태', <><StatusIcon kind="exhaustion" size={12} />{exhaustion ?? '—'} <StatusIcon kind="sanity" size={12} />{sanity ?? '—'}</>, stateLevel)}
      {tab('mastery', 'Mastery', points.left === undefined ? `AP ${points.used}` : points.left > 0 ? `AP ${points.left} 남음` : `AP ${points.used}/${points.total}`,
        points.left !== undefined && points.left > 0 ? 'good' : undefined)}
      {tab('goals', 'Goal', goals.length ? goals.map(({ name, progress }) => `${progress}/${goalByName.get(name)?.target ?? 1}`).join(' · ') : '—')}
    </div>
  );
}

function XpProgress() {
  const pc = usePlayCharacter();
  if (!pc) return null;
  const { room } = pc;
  const xp = pc.xp;
  if (xp === undefined && !room.xpItems.length) return null;
  const ready = xp !== undefined && xp >= XP_TO_LEVEL;
  return (
    <div className="play-character-xp" role="status">
      {xp !== undefined && <div className="play-character-xp-bar" aria-hidden="true">
        <span style={{ inlineSize: `${Math.min(100, xp / XP_TO_LEVEL * 100)}%` }} />
      </div>}
      <p>
        {xp !== undefined ? <>XP <b>{xp.toLocaleString('ko-KR')}</b> / {XP_TO_LEVEL.toLocaleString('ko-KR')}
          {ready ? ' · 레벨업 가능' : ` · 레벨업까지 ${(XP_TO_LEVEL - xp).toLocaleString('ko-KR')}`}</>
          : 'XP를 적으면 이번 장소 기록과 합산합니다.'}
        {ready && <> <button type="button" className="btn primary" onClick={() => document.dispatchEvent(new Event(LEVEL_UP_EVENT))}>레벨업 기록하기</button></>}
        {room.xpItems.length > 0 && <span className="play-character-xp-room"> 이번 장소 {room.xp >= 0 ? '+' : '−'}{Math.abs(room.xp).toLocaleString('ko-KR')} 포함 ({room.xpItems.join(', ')})</span>}
      </p>
    </div>
  );
}

type Column = { key: string; label: string; entry: CharacterMastery; amulet: boolean };

function MasteryTrees() {
  const pc = usePlayCharacter();
  const [selected, setSelected] = useState<{ key: string; node: number | 'feature' } | null>(null);
  const [adding, setAdding] = useState<'base' | 'amulet' | null>(null);
  const [browse, setBrowse] = useState(masteryCatalog[0].id);
  if (!pc) return null;
  const { character, points } = pc;
  const base = character.masteries ?? [];
  const columns: Column[] = [
    ...base.map((entry, index) => ({ key: entry.id, label: index < BASE_MASTERY_LIMIT ? `기본 ${index + 1}` : `추가 ${index + 1}`, entry, amulet: false })),
    ...(character.amulet ? [{ key: `amulet:${character.amulet.id}`, label: 'Amulet', entry: character.amulet, amulet: true }] : []),
  ];
  const setTier = ({ entry, amulet }: Column, tier: number) => amulet
    ? pc.update({ amulet: { id: entry.id, tier } })
    : pc.update({ masteries: base.map((item) => item.id === entry.id ? { id: item.id, tier } : item) });
  const remove = ({ entry, amulet }: Column) => {
    setSelected(null);
    if (amulet) pc.update({ amulet: undefined });
    else pc.update({ masteries: base.filter((item) => item.id !== entry.id) });
  };
  const toAmulet = (column: Column) => pc.update({
    masteries: base.filter((item) => item.id !== column.entry.id), amulet: { ...column.entry },
  });
  const owned = new Set([...base.map(({ id }) => id), ...(character.amulet ? [character.amulet.id] : [])]);
  const pick = (id: string) => {
    if (adding === 'amulet') {
      // Swapping keeps the number of unlocked Amulet abilities (p.63).
      if (!base.some((item) => item.id === id)) pc.update({ amulet: { id, tier: character.amulet?.tier ?? 0 } });
    } else if (!owned.has(id)) pc.update({ masteries: [...base, { id, tier: 1 }] });
    setAdding(null);
  };
  const active = selected && columns.find(({ key }) => key === selected.key);
  const activeInfo = active && masteryCatalog.find(({ id }) => id === active.entry.id);

  return (
    <section className="play-character-masteries" aria-labelledby="play-character-masteries-title">
      <div className="play-character-section-head">
        <h3 id="play-character-masteries-title">Mastery 테크트리</h3>
        <p className="play-character-points" role="status">{points.total === undefined
          ? `Ability Point 사용 ${points.used} · 레벨을 적으면 남은 점수를 계산합니다`
          : <>Ability Point <b>{points.used}</b> / {points.total} 사용{points.left! > 0 ? ` · ${points.left}점 남음` : points.left! < 0 ? ` · ${-points.left!}점 초과` : ''}</>}</p>
      </div>
      {base.length > BASE_MASTERY_LIMIT && <p className="play-character-warn">규칙상 기본 Mastery는 2개, 세 번째는 Amulet으로만 얻습니다. 하나를 Amulet으로 옮기거나 지우세요.</p>}
      {columns.length > 0 ? <div className="play-character-trees">
        {columns.map((column) => {
          const info = masteryCatalog.find(({ id }) => id === column.entry.id);
          if (!info) return null;
          return (
            <div className="play-character-tree" key={column.key} data-amulet={column.amulet || undefined}>
              <div className="play-character-tree-head">
                <span className="play-character-tree-slot">{column.label}</span>
                <span className="play-character-tree-name" lang="en">{info.name}</span>
                <span className="play-character-tree-count">Tier {column.entry.tier}/5</span>
              </div>
              <MasteryTree mastery={info} learned={column.entry.tier} featureOpen={column.amulet || column.entry.tier > 0}
                selected={selected?.key === column.key ? selected.node : null} label={`${column.label} ${info.name} 테크트리`}
                onSelect={(node) => setSelected(selected?.key === column.key && selected.node === node ? null : { key: column.key, node })} />
            </div>
          );
        })}
      </div> : <p className="play-character-note">배운 Mastery가 없습니다. 아래에서 고르거나 새 생존자를 만드세요.</p>}
      {active && activeInfo && selected && <MasteryNodeDetail mastery={activeInfo} node={selected.node}>
        <div className="play-character-node-actions">
          {selected.node === 'feature' ? <span className="play-character-note">{active.amulet
            ? 'Amulet을 처음 얻을 때 열리고, 착용하는 동안 켜져 있습니다.' : '이 Mastery의 Tier I을 열 때 함께 열립니다.'}</span>
            : selected.node > active.entry.tier ? <>
              <button type="button" className="btn primary" onClick={() => setTier(active, selected.node as number)}>
                Tier {tierNumeral(selected.node)}까지 배움으로 표시 · Ability Point {selected.node - active.entry.tier}</button>
              {points.left !== undefined && points.left < selected.node - active.entry.tier &&
                <span className="play-character-warn">남은 Ability Point({points.left})보다 많습니다.</span>}
            </> : selected.node > (active.amulet ? 0 : 1) || active.amulet
              ? <button type="button" className="btn ghost" onClick={() => setTier(active, (selected.node as number) - 1)}>
                Tier {tierNumeral(selected.node)}부터 배우지 않음으로</button>
              : <span className="play-character-note">Tier I은 이 Mastery를 고를 때 열립니다.</span>}
          {selected.node !== 'feature' && selected.node <= active.entry.tier && <button type="button" className="btn ghost" onClick={() =>
            document.dispatchEvent(new CustomEvent(USE_ABILITY_EVENT, { detail: {
              masteryId: activeInfo.id, tier: active.entry.tier, abilityId: `${activeInfo.id}:${selected.node}` } }))}>전투에서 쓰기</button>}
          <span className="play-character-node-more">
            {!active.amulet && !character.amulet && base.length > BASE_MASTERY_LIMIT &&
              <button type="button" className="linkbtn" onClick={() => toAmulet(active)}>Amulet으로 옮기기</button>}
            <button type="button" className="linkbtn" onClick={() => remove(active)}>{active.amulet ? 'Amulet 빼기' : `${activeInfo.name} 지우기`}</button>
          </span>
        </div>
      </MasteryNodeDetail>}
      <div className="play-character-mastery-add">
        {base.length < BASE_MASTERY_LIMIT && <button type="button" className="btn ghost" aria-expanded={adding === 'base'}
          onClick={() => setAdding(adding === 'base' ? null : 'base')}>+ 기본 Mastery 고르기</button>}
        <button type="button" className="btn ghost" aria-expanded={adding === 'amulet'} onClick={() => setAdding(adding === 'amulet' ? null : 'amulet')}>
          {character.amulet ? 'Amulet 교체' : '+ Amulet Mastery'}</button>
      </div>
      {adding && <div className="play-character-browser">
        <p className="play-character-note">{adding === 'amulet'
          ? `Amulet은 세 번째 Mastery를 줍니다. 교체는 야영 중에만 할 수 있고, 연 Ability 수(${character.amulet?.tier ?? 0})는 그대로 이어집니다.`
          : '고르면 Tier I이 열린 상태로 더합니다. 넘기며 모든 Tier를 확인하세요.'}</p>
        <MasteryBrowser current={browse} onCurrent={setBrowse} chosen={[]} limit={1} onToggle={pick} unavailable={[...owned]}
          learnedFor={() => adding === 'amulet' ? character.amulet?.tier ?? 0 : 1} />
      </div>}
    </section>
  );
}

function PersonalGoals() {
  const pc = usePlayCharacter();
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState<Record<string, string>>({});
  if (!pc) return null;
  const goals = pc.goals;
  const stored = pc.character.goals ?? [];
  const done = pc.character.completedGoals ?? [];
  const fromRoom = (name: string) => pc.room.goals[name] ?? 0;
  const setProgress = (name: string, progress: number) => pc.update({ goals: stored.map((goal) => goal.name === name
    ? { name, progress: Math.max(0, Math.min(progress, 1_000_000)) - fromRoom(name) } : goal) });
  const achieve = (name: string) => {
    const perk = PERKS.find((item) => goalByName.get(name)?.reward === `${item} Perk`);
    const perks = pc.character.perks ?? [];
    pc.update({
      goals: stored.filter((goal) => goal.name !== name), completedGoals: [...done.filter((goal) => goal !== name), name],
      ...(perk && !perks.includes(perk) ? { perks: [...perks, perk] } : {}),
    });
  };
  return (
    <section className="play-character-goals" aria-labelledby="play-character-goals-title">
      <div className="play-character-section-head">
        <h3 id="play-character-goals-title">Personal Goal</h3>
        <span className="play-character-note">동시에 {ACTIVE_GOAL_LIMIT}개 · 고른 뒤 바꿀 수 없음</span>
      </div>
      {goals.length > 0 && <ul className="play-character-goal-list">
        {goals.map(({ name, progress }) => {
          const info = goalByName.get(name);
          const target = info?.target ?? 1;
          const perk = info && perkText(info.reward);
          return <li key={name} className="play-character-goal">
            <div className="play-character-goal-head"><span lang="en">{name}</span>
              <span className="play-character-goal-count">{progress.toLocaleString('ko-KR')} / {target.toLocaleString('ko-KR')}</span></div>
            {info && <p className="play-character-note"><b>목표</b> {info.objective} · <b>보상</b> {info.reward}{perk ? ` — ${perk}` : ''}</p>}
            <div className="play-character-goal-bar" aria-hidden="true"><span style={{ inlineSize: `${Math.min(100, progress / target * 100)}%` }} /></div>
            {(fromRoom(name) > 0 || COUNTED_GOALS.has(name)) && <p className="play-character-goal-auto">
              {COUNTED_GOALS.has(name) ? '기록에서 자동 집계' : ''}{fromRoom(name) > 0 ? ` · 이번 장소 +${fromRoom(name)}` : ''}</p>}
            <div className="play-character-goal-actions">
              <div className="edge-toggle" role="group" aria-label={`${name} 진행`}>
                <button type="button" className="edge-btn" aria-label={`${name} 진행 1 빼기`} disabled={!progress} onClick={() => setProgress(name, progress - 1)}>−</button>
                <input inputMode="numeric" aria-label={`${name} 진행`} value={typed[name] ?? String(progress)} maxLength={7}
                  onBlur={() => setTyped(({ [name]: _, ...rest }) => rest)} onChange={(event) => {
                    setTyped((previous) => ({ ...previous, [name]: event.target.value }));
                    if (/^\d{1,7}$/.test(event.target.value.trim())) setProgress(name, Number(event.target.value.trim()));
                  }} />
                <button type="button" className="edge-btn" aria-label={`${name} 진행 1 더하기`} onClick={() => setProgress(name, progress + 1)}>+</button>
              </div>
              <button type="button" className={progress >= target ? 'btn primary' : 'btn ghost'} onClick={() => achieve(name)}>이룸 · 보상 받기</button>
            </div>
          </li>;
        })}
      </ul>}
      {done.length > 0 && <p className="play-character-note">이룬 목표: <span lang="en">{done.join(', ')}</span></p>}
      {goals.length < ACTIVE_GOAL_LIMIT && <TogglePanel label="목표 고르기" open={picking} onOpenChange={setPicking}>
        <GoalCards chosen={[]} limit={1} exclude={[...goals.map(({ name }) => name), ...done]} onToggle={(name) => {
          pc.update({ goals: [...stored, { name, progress: 0 }] });
          setPicking(false);
        }} />
      </TogglePanel>}
    </section>
  );
}

/** Perks the survivor has (mostly from Personal Goals); their effects reach the matching checks. */
function Perks() {
  const pc = usePlayCharacter();
  const [adding, setAdding] = useState(false);
  if (!pc) return null;
  const perks = pc.character.perks ?? [];
  return (
    <section className="play-character-goals" aria-labelledby="play-character-perks-title">
      <div className="play-character-section-head"><h3 id="play-character-perks-title">Perk</h3></div>
      {perks.length ? <ul className="play-character-perks">
        {perks.map((perk) => <li key={perk}><b lang="en">{perk}</b> <span>{PERK_NOTES.get(perk)}</span>
          <button type="button" className="linkbtn" onClick={() => pc.update({ perks: perks.filter((item) => item !== perk) })}>지우기</button></li>)}
      </ul> : <p className="play-character-note">Perk를 주는 Goal을 이루면 여기에 붙고, 해당 판정 칸에 반영됩니다.</p>}
      {perks.length < PERKS.length && <TogglePanel label="Perk 직접 추가" open={adding} onOpenChange={setAdding}>
        <div className="creator-filter-chips" role="group" aria-label="추가할 Perk">
          {PERKS.filter((perk) => !perks.includes(perk)).map((perk) => <button key={perk} type="button" lang="en"
            onClick={() => { pc.update({ perks: [...perks, perk] }); setAdding(false); }}>{perk}</button>)}
        </div>
      </TogglePanel>}
    </section>
  );
}

const GRAVEYARD_EVENT = 'kn:graveyard';
const CAUSES = ['Health 0', '부패병', '기타'] as const;

/** Death by Exhaustion 21+ or Madness 1 is detected; any other death is recorded by hand. */
function DeathCheck({ onCreate }: { onCreate: () => void }) {
  const pc = usePlayCharacter();
  const play = usePlayDraft();
  const campaignId = usePlayCampaignId();
  const commit = usePlayRoll();
  const [manual, setManual] = useState(false);
  const [buried, setBuried] = useState<{ entry: FallenSurvivor; character: typeof pc extends null ? never : NonNullable<typeof pc>['character']; presets: Record<string, number> } | null>(null);
  if (!pc || !play) return null;
  const { character } = pc;
  const auto = pc.exhaustion !== undefined && pc.exhaustion >= 21 ? 'Exhaustion 21 이상' : pc.madness.dead ? '광기 (결과 1)' : null;
  const bury = (cause: string) => {
    const entry: FallenSurvivor = {
      id: crypto.randomUUID(), name: character.name ?? '이름 없음', level: character.level ?? 1, cause,
      masteries: [...(character.masteries ?? []).map(({ id }) => id), ...(character.amulet ? [character.amulet.id] : [])],
      goalsDone: character.completedGoals ?? [],
      places: Number(play.slots.roomNumber) || 1, domains: Array.isArray(play.slots.domains) ? play.slots.domains.length : 1,
      date: new Date().toISOString().slice(0, 10),
    };
    storeGraveyard([entry, ...readGraveyard(campaignId)], campaignId);
    document.dispatchEvent(new Event(GRAVEYARD_EVENT));
    setBuried({ entry, character, presets: pc.presets });
    setManual(false);
    commit(() => pc.restore({}, {}));
  };
  if (buried) {
    return (
      <div className="play-alert" role="status">
        <p className="play-alert-title">{buried.entry.name} · 레벨 {buried.entry.level} · {buried.entry.cause}로 사망 기록</p>
        <div className="play-character-node-actions">
          <button type="button" className="btn primary" onClick={onCreate}>새 생존자 만들기</button>
          <button type="button" className="linkbtn" onClick={() => {
            storeGraveyard(readGraveyard(campaignId).filter(({ id }) => id !== buried.entry.id), campaignId);
            document.dispatchEvent(new Event(GRAVEYARD_EVENT));
            commit(() => pc.restore(buried.character, buried.presets));
            setBuried(null);
          }}>되돌리기</button>
        </div>
        <p className="play-exhaustion-note">장비 장부는 그대로 남아 있습니다.</p>
      </div>
    );
  }
  if (character.level === undefined && !character.masteries?.length) return null;
  return auto ? (
    <div className="play-alert is-danger" role="alert">
      <p className="play-alert-title status-label"><StatusIcon kind="death" />사망 · {auto}</p>
      <div className="play-character-node-actions">
        <button type="button" className="btn primary" onClick={() => bury(auto)}>사망 기록 · 새 생존자로</button>
        <span className="play-exhaustion-note">값이 잘못됐다면 아래에서 고치세요.</span>
      </div>
    </div>
  ) : (
    <div className="play-character-death">
      <button type="button" className="linkbtn" aria-expanded={manual} onClick={() => setManual((open) => !open)}>사망 처리</button>
      {manual && <div className="creator-filter-chips" role="group" aria-label="사망 원인">
        {CAUSES.map((cause) => <button key={cause} type="button" onClick={() => bury(cause)}>{cause}</button>)}
      </div>}
    </div>
  );
}

function Graveyard() {
  const campaignId = usePlayCampaignId();
  const [list, setList] = useState(() => readGraveyard(campaignId));
  useEffect(() => {
    const refresh = () => setList(readGraveyard(campaignId));
    refresh();
    document.addEventListener(GRAVEYARD_EVENT, refresh);
    return () => document.removeEventListener(GRAVEYARD_EVENT, refresh);
  }, [campaignId]);
  if (!list.length) return null;
  return (
    <TogglePanel label="지난 생존자" badge={list.length}>
      <ul className="play-character-graveyard">
        {list.map((item) => <li key={item.id}>
          <b>{item.name}</b> · 레벨 {item.level} · {item.cause} · 장소 {item.places} · 도메인 {item.domains}
          {item.masteries.length > 0 && <span lang="en"> · {item.masteries.map((id) => masteryCatalog.find((mastery) => mastery.id === id)?.name ?? id).join(', ')}</span>}
          {item.goalsDone.length > 0 && <span> · 이룬 목표 {item.goalsDone.length}</span>}
          <span className="play-character-note"> {item.date}</span>
        </li>)}
      </ul>
    </TogglePanel>
  );
}
