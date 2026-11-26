import { useEffect, useRef, useState, type ReactNode } from 'react';
import { entryById } from '../content';
import { masteryCatalog } from '../content/entries/masteries';
import {
  ALLOTMENTS, CREATION_ATTRIBUTES, CREATION_SKILLS, CREATION_STEPS, EMPTY_CREATION, PERSONAL_GOALS, RECOMMENDED_GOAL, RESISTANCES,
  STARTING_SUPPLIES, STARTING_WEAPONS, allotmentErrors, allotmentUse, armorFor, armorPiece, autoCreate, creationLines, creationRecord,
  crimeName, fillAllotment, isWeaponSkill, mainWeaponSkill, masteryFromRoll, resistanceScores, rollArmor, rollMasteries, skillBase,
  skillScores, startingGear, stepStatus, type CreationDraft, type CreationStep, type GearLine, type SupplyId,
} from '../lib/character-creation';
import { roll, type RollResult } from '../lib/dice';
import { CHARACTER_WEAPONS, usePlayCharacter, type SurvivorSnapshot } from '../lib/play-character';
import { usePlayDraftState, usePlayRoll } from '../lib/play-draft';
import { Link } from '../lib/router';
import { XRef } from './bits';
import { JournalRoll } from './LootJournal';
import { MasteryBrowser } from './MasteryTree';
import { PhysicalDiceRoll } from './PhysicalDiceRoll';
import { RollButton } from './RollButton';
import '../styles/character-creator.css';

const outcomeText = (entry: string) => new Map((entryById.get(entry)?.outcomes ?? []).map(({ label, text }) => [label.replace(/\s*\(.*\)$/, ''), text]));
const SKILL_NOTES = outcomeText('skills');
const RESISTANCE_NOTES = outcomeText('resistances');
const PERK_NOTES = outcomeText('perks');
const TRAIT_NOTES = outcomeText('weapon-traits');
const skillNote = (skill: string) => SKILL_NOTES.get(skill)
  ?? (isWeaponSkill(skill) ? SKILL_NOTES.get('Bladed / Bludgeoning / Shafted Weapons') : undefined);
const SHORT_WEAPON: Record<string, string> = {
  'Bladed Weapons': 'Bladed', 'Bludgeoning Weapons': 'Bludgeoning', 'Shafted Weapons': 'Shafted', 'Unarmed Combat & Fist Weapons': 'Unarmed / Fist',
};
const perkOf = (reward: string) => /^(.+) Perk$/.exec(reward)?.[1];

/**
 * Builds a level 1 survivor step by step (pp.16–21, 64, 67). Every die can be typed from the table or rolled here,
 * one step can be rolled at once, or "완전 자동" fills whatever is still empty; every result stays editable.
 */
export function CharacterCreator({ onApplyGear, onUndoGear, onDone, doneLabel = '캐릭터 탭 보기' }: {
  onApplyGear?: (lines: GearLine[], source: string) => Promise<boolean>;
  onUndoGear?: (source: string) => Promise<boolean>;
  onDone?: () => void;
  doneLabel?: string;
}) {
  const [draft, setDraft] = usePlayDraftState<CreationDraft>('creation', EMPTY_CREATION);
  const [step, setStep] = usePlayDraftState<CreationStep>('creation-step', 'attributes');
  const [browse, setBrowse] = usePlayDraftState('creation-browse', masteryCatalog[0].id);
  const [masteryRoll, setMasteryRoll] = usePlayDraftState<number | null>('creation-mastery-roll', null);
  const [weaponSkill, setWeaponSkill] = useState('');
  const [cleared, setCleared] = useState<CreationDraft | null>(null);
  const [withGear, setWithGear] = useState(true);
  const [applied, setApplied] = usePlayDraftState<(SurvivorSnapshot & { gearSource?: string }) | null>('creation-applied', null);
  const [savingGear, setSavingGear] = useState(false);
  const [gearSaved, setGearSaved] = useState(false);
  const [message, setMessage] = useState('');
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const stepStrip = useRef<HTMLOListElement>(null);
  // Keeps the current step visible in the strip when it scrolls sideways on narrow screens.
  useEffect(() => {
    const strip = stepStrip.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return;
    const box = strip.getBoundingClientRect();
    const node = current.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollLeft + node.left - box.left - (box.width - node.width) / 2 });
  }, [step]);
  const commit = usePlayRoll();
  const pc = usePlayCharacter();
  const status = stepStatus(draft);
  const index = CREATION_STEPS.findIndex(({ id }) => id === step);
  const change = (update: (previous: CreationDraft) => CreationDraft) => setDraft(update);
  const patch = (next: Partial<CreationDraft>) => change((previous) => ({ ...previous, ...next }));
  const go = (id: CreationStep) => {
    setStep(id);
    requestAnimationFrame(() => stepTitle.current?.focus());
  };
  const auto = () => {
    const next = autoCreate(draft);
    const moved = CREATION_SKILLS.some((skill) => draft.allot[skill] && next.allot[skill] !== draft.allot[skill]);
    commit(() => setDraft(next), { label: '캐릭터 완전 자동 생성', dice: '—', source: 'app',
      value: CREATION_ATTRIBUTES.map(({ id }) => `${id} ${next.attributes[id]?.total}`).join(' · ') });
    setCleared(null);
    setMessage(moved ? '+60과 +40을 무기 기술에 배분하기 위해 기존 배분 일부를 옮겼습니다. Skill 단계에서 확인할 수 있습니다.' : '');
    go('summary');
  };
  const rolled = (dice: string) => roll(dice)!;

  const attributes = (
    <>
      <label className="field creator-name"><span>이름 (선택)</span>
        <input value={draft.name} maxLength={40} autoComplete="off" onChange={(event) => patch({ name: event.target.value })} placeholder="예: Erthos" />
      </label>
      <div className="creator-step-actions">
        <RollButton disabled={CREATION_ATTRIBUTES.every(({ id }) => draft.attributes[id])} onClick={() => {
          const next = { ...draft.attributes };
          for (const { id, dice } of CREATION_ATTRIBUTES) next[id] ??= rolled(dice);
          commit(() => patch({ attributes: next }), { label: '속성 모두 굴리기', dice: '—', source: 'app',
            value: CREATION_ATTRIBUTES.map(({ id }) => `${id} ${next[id]?.total}`).join(' · ') });
        }}>빈 속성 모두 굴리기</RollButton>
        <span className="creator-fixed is-inline">Exhaustion <b>0</b> <small>시작값 고정</small></span>
      </div>
      <div className="creator-dice">
        {CREATION_ATTRIBUTES.map(({ id, dice }) => (
          <PhysicalDiceRoll key={id} label={id} dice={dice} value={draft.attributes[id]}
            onValue={(value) => change((previous) => ({ ...previous, attributes: { ...previous.attributes, [id]: value } }))}
            resultText={(value) => `${id} ${value.total}`} />
        ))}
      </div>
      <JournalRoll tableId="t-crime" label="죄목 (선택 · 규칙 효과 없음)" value={draft.crime} onValue={(crime) => patch({ crime })}
        resultText={crimeName(draft.crime)} />
    </>
  );

  const use = allotmentUse(draft.allot);
  // One chip per allotment (+60, +40, +30 ×3 …) showing the Skill it went to, or that it is still free.
  const tokens = ALLOTMENTS.flatMap(({ amount, count, weapon }) => {
    const holders = CREATION_SKILLS.filter((skill) => draft.allot[skill] === amount);
    return Array.from({ length: count }, (_, slot) => ({ amount, weapon, skill: holders[slot] }));
  });
  const errors = allotmentErrors(draft.allot);
  const scores = skillScores(draft.allot);
  const skills = (
    <>
      <div className="creator-allot-board" role="status" aria-label="분배 칸">
        <span className="creator-allot-count"><b>{tokens.filter(({ skill }) => !skill).length}</b>/{tokens.length} 남음</span>
        {ALLOTMENTS.map(({ amount, weapon }) => (
          <span className="creator-allot-group" key={amount}>
            <b>+{amount}</b>{weapon && <small>무기</small>}
            {tokens.filter((token) => token.amount === amount).map(({ skill }, slot) => skill
              ? <span key={slot} className="creator-slot is-used" lang="en">{SHORT_WEAPON[skill] ?? skill}</span>
              : <span key={slot} className="creator-slot"><span className="sr-only">비어 있음</span></span>)}
          </span>
        ))}
      </div>
      <div className="creator-skill-list">
        {CREATION_SKILLS.map((skill) => {
          const current = draft.allot[skill];
          return (
            <div className="creator-skill" key={skill}>
              <div className="creator-skill-name"><span><span lang="en">{SHORT_WEAPON[skill] ?? skill}</span>
                {skillBase(skill) > 0 && <span className="creator-skill-base">기본 {skillBase(skill)}</span>}</span>
                <span className="creator-skill-note">{skillNote(skill)}</span></div>
              <div className="creator-skill-chips" role="group" aria-label={`${skill} 분배`}>
                {use.filter(({ weapon }) => !weapon || isWeaponSkill(skill)).map(({ amount, left }) => (
                  <button key={amount} type="button" aria-pressed={current === amount} disabled={current !== amount && left <= 0}
                    onClick={() => change((previous) => {
                      const allot = { ...previous.allot };
                      if (allot[skill] === amount) delete allot[skill];
                      else allot[skill] = amount;
                      return { ...previous, allot };
                    })}><span>+{amount}</span></button>
                ))}
              </div>
              <span className="creator-skill-score" aria-label={`${skill} 합계`}>
                {current ? <small>+{current} → </small> : null}<b>{scores[skill]}</b></span>
            </div>
          );
        })}
      </div>
      {errors.length > 0 && <ul className="field-err" role="alert">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      <div className="creator-step-actions">
        <button type="button" className="btn ghost" onClick={() => patch({ allot: fillAllotment(draft.allot) })}>남은 분배 무작위로</button>
        <button type="button" className="btn ghost" disabled={!Object.keys(draft.allot).length} onClick={() => patch({ allot: {} })}>분배 지우기</button>
      </div>
    </>
  );

  const resistance = (
    <>
      <div className="creator-cards" role="group" aria-label="40으로 시작할 Resistance">
        {RESISTANCES.map((id) => (
          <button key={id} type="button" className="creator-card" aria-pressed={draft.resistance === id}
            onClick={() => patch({ resistance: draft.resistance === id ? '' : id })}>
            <span className="creator-card-title" lang="en">{id}</span>
            <span className="creator-card-score">{draft.resistance ? resistanceScores(draft.resistance)[id] : '40 / 20'}</span>
            <span className="creator-card-text">{RESISTANCE_NOTES.get(id)}</span>
          </button>
        ))}
      </div>
    </>
  );

  const toggleMastery = (id: string) => change((previous) => {
    if (previous.masteries.includes(id)) return { ...previous, masteries: previous.masteries.filter((item) => item !== id) };
    return previous.masteries.length >= 2 ? previous : { ...previous, masteries: [...previous.masteries, id] };
  });
  const randomMastery = masteryRoll === null ? undefined : masteryFromRoll(masteryRoll);
  const masteries = (
    <>
      <div className="creator-picked" aria-label="고른 Mastery">
        {[0, 1].map((slot) => {
          const mastery = masteryCatalog.find(({ id }) => id === draft.masteries[slot]);
          return <span key={slot} className="creator-picked-slot">
            선택 {slot + 1}: {mastery ? <>
              <button type="button" className="linkbtn" lang="en" onClick={() => setBrowse(mastery.id)}>{mastery.name}</button>
              <button type="button" className="creator-unpick" aria-label={`${mastery.name} 선택 해제`} onClick={() => toggleMastery(mastery.id)}>×</button>
            </> : <span className="creator-empty">비어 있음</span>}
          </span>;
        })}
        <button type="button" className="btn ghost" disabled={draft.masteries.length >= 2} onClick={() => {
          const next = rollMasteries(draft.masteries);
          patch({ masteries: next });
          setBrowse(next[next.length - 1]);
        }}>빈 칸 무작위로</button>
      </div>
      <JournalRoll tableId="t-random-mastery" label="무작위 Mastery" value={masteryRoll} onValue={(value) => {
        setMasteryRoll(value);
        const id = masteryFromRoll(value);
        if (!id) return;
        setBrowse(id);
        if (!draft.masteries.includes(id) && draft.masteries.length < 2) patch({ masteries: [...draft.masteries, id] });
      }} resultText={randomMastery ? draft.masteries.includes(randomMastery)
        ? `${masteryCatalog.find(({ id }) => id === randomMastery)?.name} · 선택함` : `${masteryCatalog.find(({ id }) => id === randomMastery)?.name} · 이미 두 개를 골라 넣지 않았습니다. 다시 굴리거나 하나를 해제하세요.` : undefined} />
      <MasteryBrowser current={browse} onCurrent={setBrowse} chosen={draft.masteries} limit={2} onToggle={toggleMastery}
        learnedFor={(id) => draft.masteries.includes(id) ? 1 : 0} />
    </>
  );

  const goals = (
    <>
      <div className="creator-picked" aria-label="고른 Personal Goal">
        {[0, 1].map((slot) => <span key={slot} className="creator-picked-slot">선택 {slot + 1}: {draft.goals[slot]
          ? <><span lang="en">{draft.goals[slot]}</span><button type="button" className="creator-unpick" aria-label={`${draft.goals[slot]} 선택 해제`}
            onClick={() => patch({ goals: draft.goals.filter((goal) => goal !== draft.goals[slot]) })}>×</button></>
          : <span className="creator-empty">비어 있음</span>}</span>)}
        <button type="button" className="btn ghost" disabled={draft.goals.length >= 2} onClick={() => {
          const next = autoCreate({ ...EMPTY_CREATION, start: 'empty', goals: draft.goals });
          patch({ goals: next.goals });
        }}>빈 칸 채우기</button>
      </div>
      <GoalCards chosen={draft.goals} limit={2}
        onToggle={(name) => patch({ goals: draft.goals.includes(name) ? draft.goals.filter((goal) => goal !== name) : [...draft.goals, name] })} />
    </>
  );

  const preferredSkill = mainWeaponSkill({ ...draft, weapon: '' }) ?? CHARACTER_WEAPONS[0];
  const shownSkill = weaponSkill || STARTING_WEAPONS.find(({ name }) => name === draft.weapon)?.skill || preferredSkill;
  const weapon = STARTING_WEAPONS.find(({ name }) => name === draft.weapon);
  const piece = armorPiece(draft.armorPiece);
  const armor = armorFor(draft);
  const gear = (
    <>
      <div className="creator-cards creator-start" role="group" aria-label="시작 방식">
        <button type="button" className="creator-card" aria-pressed={draft.start === 'gear'} onClick={() => patch({ start: 'gear' })}>
          <span className="creator-card-title">시작 장비 받기</span>
          <span className="creator-card-text">무기 하나(선택), 무작위 방어구 하나, Torch 1, Cooking Ingredients D10, Crafting Supplies D10+5, D20₵</span>
        </button>
        <button type="button" className="creator-card" aria-pressed={draft.start === 'empty'} onClick={() => patch({ start: 'empty' })}>
          <span className="creator-card-title">장비 없이 시작</span>
          <span className="creator-card-text">장비를 탐험 중에 따로 마련할 때</span>
        </button>
      </div>
      {draft.start === 'gear' && <>
        <fieldset className="creator-weapons">
          <legend>무기 하나 고르기</legend>
          <div className="creator-filter-chips" role="group" aria-label="무기 Skill">
            {CHARACTER_WEAPONS.map((skill) => (
              <button key={skill} type="button" aria-pressed={shownSkill === skill} onClick={() => setWeaponSkill(skill)}>
                <span lang="en">{SHORT_WEAPON[skill]}</span> {scores[skill]}</button>
            ))}
          </div>
          <div className="creator-weapon-list" role="group" aria-label={`${SHORT_WEAPON[shownSkill]} 무기`}>
            {STARTING_WEAPONS.filter(({ skill }) => skill === shownSkill).map((item) => (
              <button key={item.name} type="button" className="creator-weapon" aria-pressed={draft.weapon === item.name}
                onClick={() => patch({ weapon: draft.weapon === item.name ? '' : item.name })}>
                <span className="creator-card-title" lang="en">{item.name}</span>
                <span className="creator-weapon-meta">D6 {item.damage} · Speed {item.speed} · {item.traits.join(', ')}</span>
              </button>
            ))}
          </div>
          {weapon && <ul className="creator-traits" aria-label={`${weapon.name} 특성`}>
            {weapon.traits.map((trait) => <li key={trait}><b lang="en">{trait}</b> {TRAIT_NOTES.get(trait)}</li>)}
            <li><b>무게</b> {weapon.heavy ? '양손 무기라 가방에 넣으면 Heavy' : '한손 무기라 가방에 넣으면 Normal'}</li>
          </ul>}
        </fieldset>
        <JournalRoll tableId="t-random-armor" label="무작위 방어구" value={draft.armorPiece}
          onValue={(value) => patch({ armorPiece: value, armorGrade: null })} />
        {piece && <JournalRoll key={piece.piece} tableId={piece.grades} label={`${piece.piece} 등급`} value={draft.armorGrade}
          onValue={(value) => patch({ armorGrade: value })} resultText={armor ? `${armor.name} · ${armor.detail}` : undefined} />}
        {armor?.magic && <p className="creator-note">마법 흉갑입니다. <XRef id="p-magic-item">마법 아이템 생성</XRef>으로 속성을 정하거나 등급을 다시 굴리세요.</p>}
        <div className="creator-dice">
          {STARTING_SUPPLIES.map(({ id, name, dice }) => (
            <PhysicalDiceRoll key={id} label={name} dice={dice} value={draft.supplies[id]}
              onValue={(value: RollResult) => change((previous) => ({ ...previous, supplies: { ...previous.supplies, [id]: value } }))}
              resultText={(value) => id === 'coins' ? `${value.total}₵` : `${name} ${value.total}개`} />
          ))}
          <div className="creator-fixed"><span>Torch</span><b>1</b></div>
        </div>
        <div className="creator-step-actions">
          <RollButton onClick={() => {
            const supplies = { ...draft.supplies };
            for (const { id, dice } of STARTING_SUPPLIES) supplies[id as SupplyId] ??= rolled(dice);
            const armorRoll = draft.armorPiece !== null && draft.armorGrade !== null ? {} : rollArmor();
            commit(() => patch({ supplies, ...armorRoll }), { label: '시작 장비 굴리기', dice: '—', source: 'app',
              value: STARTING_SUPPLIES.map(({ id, name }) => `${name} ${supplies[id]?.total}`).join(' · ') });
          }}>빈 장비 주사위 모두 굴리기</RollButton>
        </div>
      </>}
    </>
  );

  const lines = creationLines(draft);
  const missing = CREATION_STEPS.filter(({ id }) => id !== 'summary' && !status[id]);
  /** Writes the survivor into the character tab (and the starting gear into the ledger); true once everything landed. */
  const record = async () => {
    if (!pc || !status.summary || applied || savingGear) return false;
    const { character, skills: values } = creationRecord(draft);
    const previous = pc.snapshot();
    const items = withGear ? startingGear(draft) : [];
    const gearSource = items.length && onApplyGear ? `creation:${crypto.randomUUID()}` : undefined;
    commit(() => {
      pc.replace(character, values);
      setApplied(gearSource ? { ...previous, gearSource } : previous);
    });
    setGearSaved(false);
    setMessage('');
    if (!gearSource || !onApplyGear) return true;
    setSavingGear(true);
    const saved = await onApplyGear(items, gearSource).catch(() => false);
    setGearSaved(saved);
    setMessage(saved ? '' : '장비 장부에 넣지 못했습니다. 장비 탭에서 직접 추가하세요.');
    setSavingGear(false);
    return saved;
  };
  // One button records the survivor and moves on; a failed gear grant keeps the player here with the message and undo.
  const finish = async () => {
    if (await record()) onDone?.();
  };
  const summary = (
    <>
      {missing.length > 0 && <div className="creator-missing" role="status">
        <span>남은 단계</span>
        {missing.map(({ id, numeral, label }) => <button key={id} type="button" className="linkbtn" onClick={() => go(id)}>{numeral}. {label}</button>)}
      </div>}
      {pc && !applied && <label className="field creator-name"><span>이름</span>
        <input value={draft.name} maxLength={40} autoComplete="off" onChange={(event) => patch({ name: event.target.value })} placeholder="비워 두어도 됩니다" />
      </label>}
      <dl className="creator-lines" aria-label="종이에 적을 값">
        {lines.map(({ label, text }) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}
      </dl>
      <div className="creator-step-actions">
        <button type="button" className="btn ghost" onClick={() => {
          void navigator.clipboard?.writeText(lines.map(({ label, text }) => `${label}: ${text}`).join('\n'))
            .then(() => setMessage('종이에 옮길 값을 복사했습니다.'), () => setMessage('복사하지 못했습니다. 화면의 값을 직접 옮기세요.'));
        }}>값 복사</button>
        {pc && <>
          {draft.start === 'gear' && onApplyGear && <label className="creator-check"><input type="checkbox" checked={withGear} disabled={!!applied}
            onChange={(event) => setWithGear(event.target.checked)} />시작 장비도 장비 장부에 넣기</label>}
          {!applied && <button type="button" className="btn primary" disabled={!status.summary || savingGear} onClick={() => void finish()}>
            {onDone ? doneLabel : '캐릭터 탭에 채우기'}</button>}
        </>}
      </div>
      {pc && !applied && (pc.character.level !== undefined || pc.character.masteries?.length) && status.summary &&
        <p className="creator-note">지금 캐릭터 탭의 기록(레벨 {pc.character.level ?? '?'})을 새 생존자로 바꿉니다. 바꾼 뒤에도 이 화면을 다시 열면 되돌릴 수 있습니다.</p>}
      {applied && pc && <div className="creator-step-actions">
        <p className="creator-done" role="status">캐릭터 탭에 채웠습니다{savingGear ? ' · 시작 장비 저장 중' : gearSaved ? ' · 시작 장비를 장부에 넣었습니다' : ''}.</p>
        <button type="button" className="linkbtn" disabled={savingGear} onClick={async () => {
          if (applied.gearSource && onUndoGear) {
            setSavingGear(true);
            const restored = await onUndoGear(applied.gearSource).catch(() => false);
            setSavingGear(false);
            if (!restored) { setMessage('시작 장비 지급을 되돌릴 수 없습니다. 장비 탭에서 이후 변경을 확인하세요.'); return; }
          }
          commit(() => { pc.restore(applied); setApplied(null); });
          setGearSaved(false);
          setMessage('');
        }}>캐릭터 기록 되돌리기</button>
        {onDone && <button type="button" className="btn primary" disabled={savingGear} onClick={onDone}>{doneLabel}</button>}
      </div>}
      {!pc && <p className="creator-note">플레이 화면의 <Link to="/play">캐릭터 탭</Link>에서 만들면 판정 칸·Mastery 테크트리·장비 장부에 바로 채워집니다.</p>}
      {message && <p className="creator-note" role="status">{message}</p>}
    </>
  );

  const panes: Record<CreationStep, ReactNode> = { attributes, skills, resistance, masteries, goals, gear, summary };
  const current = CREATION_STEPS[index];
  return (
    <section className="creator" aria-label="새 생존자 만들기">
      <div className="creator-head">
        <div className="creator-step-actions">
          <RollButton className={draft === EMPTY_CREATION ? 'primary' : undefined} disabled={!!applied} onClick={auto}
            title="빈 칸을 채우고 필요하면 무기 기술 배분을 조정합니다">완전 자동 생성</RollButton>
          <button type="button" className="btn ghost" disabled={draft === EMPTY_CREATION || savingGear} onClick={() => {
            setCleared(draft);
            setDraft(EMPTY_CREATION);
            setMasteryRoll(null);
            setApplied(null);
            go('attributes');
          }}>처음부터</button>
        </div>
        {cleared && <p className="creator-done" role="status">입력을 지웠습니다. <button type="button" className="linkbtn" onClick={() => {
          setDraft(cleared);
          setCleared(null);
        }}>되돌리기</button></p>}
      </div>
      <ol className="creator-steps" aria-label="생성 단계" ref={stepStrip}>
        {CREATION_STEPS.map(({ id, numeral, label }) => (
          <li key={id}><button type="button" aria-current={id === step ? 'step' : undefined} data-done={status[id] || undefined} disabled={!!applied && id !== step} onClick={() => go(id)}>
            <span className="creator-step-num" aria-hidden="true">{numeral}</span>{label}{status[id] && <span className="sr-only"> 완료</span>}
          </button></li>
        ))}
      </ol>
      <div className="creator-pane">
        <h3 ref={stepTitle} tabIndex={-1}>{current.numeral}. {current.label}</h3>
        {panes[step]}
      </div>
      <div className="creator-nav">
        {index > 0 && <button type="button" className="btn ghost" disabled={!!applied} onClick={() => go(CREATION_STEPS[index - 1].id)}>
          ‹ {CREATION_STEPS[index - 1].numeral}. {CREATION_STEPS[index - 1].label}</button>}
        {index < CREATION_STEPS.length - 1 && <button type="button" className={status[step] ? 'btn primary' : 'btn ghost'}
          onClick={() => go(CREATION_STEPS[index + 1].id)}>{CREATION_STEPS[index + 1].numeral}. {CREATION_STEPS[index + 1].label} ›</button>}
      </div>
    </section>
  );
}


/** Every Personal Goal with its objective and reward (Perk effects spelled out), searchable, at most `limit` chosen. */
export function GoalCards({ chosen, limit, exclude = [], onToggle }: {
  chosen: string[];
  limit: number;
  exclude?: string[];
  onToggle: (name: string) => void;
}) {
  const [goalQuery, setGoalQuery] = useState('');
  const query = goalQuery.trim().toLowerCase();
  const goalList = [...PERSONAL_GOALS].sort((a, b) => Number(b.name === RECOMMENDED_GOAL) - Number(a.name === RECOMMENDED_GOAL))
    .filter((goal) => !exclude.includes(goal.name))
    .filter((goal) => !query || `${goal.name} ${goal.objective} ${goal.reward}`.toLowerCase().includes(query));
  return (
    <>
      <label className="field creator-goal-search"><span>목표 찾기</span>
        <input value={goalQuery} onChange={(event) => setGoalQuery(event.target.value)} placeholder="예: Undead, 피해, Perk" /></label>
      <div className="creator-cards creator-goals" role="group" aria-label="Personal Goal 목록">
        {goalList.map((goal) => {
          const picked = chosen.includes(goal.name);
          const perk = perkOf(goal.reward);
          return (
            <button key={goal.name} type="button" className="creator-card" aria-pressed={picked}
              disabled={!picked && chosen.length >= limit} onClick={() => onToggle(goal.name)}>
              <span className="creator-card-title" lang="en">{goal.name}{goal.name === RECOMMENDED_GOAL && <span className="creator-badge" lang="ko">권장</span>}</span>
              <span className="creator-card-text"><b>목표</b> {goal.objective}</span>
              <span className="creator-card-text"><b>보상</b> {goal.reward}{perk && PERK_NOTES.get(perk) ? ` — ${PERK_NOTES.get(perk)}` : ''}</span>
            </button>
          );
        })}
        {!goalList.length && <p className="creator-note">맞는 목표가 없습니다. 검색어를 지우세요.</p>}
      </div>
    </>
  );
}

export const perkText = (reward: string) => {
  const perk = perkOf(reward);
  return perk ? PERK_NOTES.get(perk) : undefined;
};
