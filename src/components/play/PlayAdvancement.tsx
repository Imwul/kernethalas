import { useEffect, useMemo, useState } from 'react';
import { masteryCatalog } from '../../content/entries/masteries';
import { damagingMasteryAbilities, readMasteryInteger } from '../../lib/mastery-play';
import { usePlayCharacter } from '../../lib/play-character';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
import { TogglePanel } from '../TogglePanel';
import '../../styles/play-mastery.css';

type SheetItem = { id: string; text: string };

const ROLLED_BENEFITS = {
  Health: 'D4', Toughness: 'D6', Sanity: 'D4', Aether: 'D6', '피해 풀': 'D6',
} as const;
const SKILLS = ['Acrobatics', 'Athletics', 'Bladed Weapons', 'Bludgeoning Weapons', 'Dodge', 'Medicine',
  'Perception', 'Reason', 'Scavenge', 'Shafted Weapons', 'Stealth', 'Thievery', 'Unarmed Combat & Fist Weapons'];
const RESISTANCES = ['Endurance', 'Resolve', 'Spellward'] as const;
const DAMAGE_TYPES = ['Slashing', 'Bludgeoning', 'Piercing'];

type Benefit = keyof typeof ROLLED_BENEFITS | '능력 피해' | 'Skill' | 'Resistance';
interface AdvancementDraft {
  level: string;
  xp: string;
  mastery: string;
  tier: string;
  benefit: Benefit | '';
  die: number | null;
  type: string;
  skill: string;
  skillScore: string;
  resistances: Record<(typeof RESISTANCES)[number], string>;
  ability: string;
  battleForm: boolean;
}
const EMPTY_DRAFT: AdvancementDraft = {
  level: '', xp: '', mastery: '', tier: '', benefit: '', die: null, type: '', skill: '', skillScore: '', ability: '',
  resistances: { Endurance: '', Resolve: '', Spellward: '' }, battleForm: false,
};
interface AdvancementRecord {
  level: number;
  summary: string;
  changes: string[];
  /** XP the level-up used up (XP returns to 0) */
  xp?: number;
}

function gainedBenefit(draft: AdvancementDraft): string | null {
  const { benefit, die } = draft;
  if (benefit === 'Skill') {
    const score = readMasteryInteger(draft.skillScore, 0, 80);
    return draft.skill && score !== null && score < 80 ? `${draft.skill} ${score} → ${Math.min(80, score + 5)}` : null;
  }
  if (benefit === 'Resistance') {
    const scores = RESISTANCES.map((id) => readMasteryInteger(draft.resistances[id], 0, 80));
    if (scores.some((score) => score === null) || scores.every((score) => score === 80)) return null;
    return RESISTANCES.map((id, index) => `${id} ${scores[index]} → ${Math.min(80, scores[index]! + 5)}`).join(' · ');
  }
  if (benefit === '능력 피해') {
    const ability = damagingMasteryAbilities.find(({ id }) => id === draft.ability);
    return ability ? `${ability.name} 피해 +1` : null;
  }
  if (benefit === '피해 풀') return draft.type && die !== null ? `물리 비능력 피해 풀 +${die} ${draft.type}` : null;
  return benefit && die !== null ? `${benefit} 최대치 +${die}` : null;
}

/** One-tap choices instead of a dropdown. */
function Chips({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string; lang?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field advancement-choice"><span>{label}</span>
      <div className="creator-filter-chips" role="group" aria-label={label}>
        {options.map((option) => <button key={option.value} type="button" aria-pressed={value === option.value} lang={option.lang}
          onClick={() => onChange(option.value)}>{option.label}</button>)}
      </div>
    </div>
  );
}

export function PlayAdvancement({ onSheetChange, onJournalChange, onXpSpent }: {
  onSheetChange?: (items: SheetItem[]) => void;
  onJournalChange?: (line: string) => void;
  onXpSpent?: (xp: number) => void;
}) {
  const [saved, setDraft] = usePlayDraftState('advancement-draft', EMPTY_DRAFT);
  const pc = usePlayCharacter();
  const [otherMastery, setOtherMastery] = useState(false);
  // Level, XP and the Mastery's current tier come from the character tab until the player types something else.
  const learnedTier = (id: string) => {
    const base = pc?.character.masteries?.find((item) => item.id === id);
    if (base) return String(base.tier);
    return pc?.character.amulet?.id === id ? String(pc.character.amulet.tier) : '';
  };
  const draft = {
    ...saved,
    level: saved.level || pc?.level || '',
    xp: saved.xp || (pc?.xp === undefined ? '' : String(pc.xp)),
    tier: saved.tier || (saved.mastery ? learnedTier(saved.mastery) : ''),
  };
  const [records, setRecords] = usePlayDraftState<AdvancementRecord[]>('advancement-records', []);
  const commit = usePlayRoll();
  const patch = (next: Partial<AdvancementDraft>) => setDraft((previous) => ({ ...previous, ...next }));
  const report = useMemo(() => ({
    journal: records.map(({ summary }) => summary).join(' / '),
    sheet: records.flatMap(({ changes, level }) => changes.map((text, index) => ({ id: `level-up-${level}-${index}`, text }))),
  }), [records]);
  useEffect(() => { onSheetChange?.(report.sheet); onJournalChange?.(report.journal); }, [report, onSheetChange, onJournalChange]);
  const spent = records.reduce((total, { xp: used }) => total + (used ?? 0), 0);
  useEffect(() => { onXpSpent?.(spent); }, [spent, onXpSpent]);
  const own = new Set([...(pc?.character.masteries ?? []).map(({ id }) => id), ...(pc?.character.amulet ? [pc.character.amulet.id] : [])]);
  const masteryOptions = [...masteryCatalog].sort((a, b) => Number(own.has(b.id)) - Number(own.has(a.id)));
  const learnedIds = new Set([...(pc?.character.masteries ?? []), ...(pc?.character.amulet ? [pc.character.amulet] : [])]
    .flatMap(({ id, tier }) => Array.from({ length: tier }, (_, index) => `${id}:${index + 1}`)));
  const learnedDamaging = damagingMasteryAbilities.filter(({ id }) => learnedIds.has(id));
  const updateCharacter = () => {
    if (!pc || level === null) return;
    const patchCharacter: Parameters<typeof pc.update>[0] = { level: Math.min(99, level + 1) };
    if (mastery && nextAbility) {
      const base = pc.character.masteries ?? [];
      if (base.some(({ id }) => id === mastery.id)) {
        patchCharacter.masteries = base.map((item) => item.id === mastery.id ? { id: item.id, tier: nextAbility.tier } : item);
      } else if (pc.character.amulet?.id === mastery.id || draft.tier === '0') {
        patchCharacter.amulet = { id: mastery.id, tier: nextAbility.tier };
      } else if (base.length < 2) patchCharacter.masteries = [...base, { id: mastery.id, tier: nextAbility.tier }];
    }
    if (draft.benefit === 'Sanity' && draft.die !== null && pc.character.sanityMax !== undefined) {
      patchCharacter.sanityMax = pc.character.sanityMax + draft.die;
      if (pc.character.sanity !== undefined) patchCharacter.sanity = pc.character.sanity + draft.die;
    }
    pc.update(patchCharacter);
    const raise = (name: string, raw: string) => {
      const score = readMasteryInteger(raw, 0, 80);
      if (score !== null) pc.setSkill(name, Math.min(80, score + 5));
    };
    if (draft.benefit === 'Skill' && draft.skill) raise(draft.skill, draft.skillScore);
    if (draft.benefit === 'Resistance') for (const id of RESISTANCES) raise(id, draft.resistances[id]);
  };

  const level = readMasteryInteger(draft.level, 1, Number.MAX_SAFE_INTEGER - 1);
  const xp = readMasteryInteger(draft.xp);
  const eligible = level !== null && xp !== null && xp >= 1000;
  const mastery = masteryCatalog.find(({ id }) => id === draft.mastery);
  const tier = readMasteryInteger(draft.tier, 0, 5);
  const nextAbility = mastery && tier !== null ? mastery.abilities[tier] : undefined;
  const unlocksBattleForm = nextAbility?.name === 'Battle Form';
  const ownsBattleForm = mastery?.id === 'm-bulwark' && tier !== null && tier >= 4;
  const dice = draft.benefit && draft.benefit in ROLLED_BENEFITS
    ? ROLLED_BENEFITS[draft.benefit as keyof typeof ROLLED_BENEFITS] : undefined;
  const benefit = gainedBenefit(draft);
  const recorded = level !== null && records.some((record) => record.level === level);
  const changes = eligible && benefit && (!mastery || nextAbility) ? [
    `레벨 ${level} → ${level + 1}`,
    `XP ${xp.toLocaleString('ko-KR')} → 0`,
    nextAbility ? `Ability Point +1 · ${nextAbility.name} 해금에 사용` : 'Ability Point +1 보관',
    ...(nextAbility ? [`${mastery!.name} Tier ${nextAbility.tier} · ${nextAbility.name} 해금`] : []),
    ...(nextAbility?.tier === 1 ? [`${mastery!.feature.name} 특성 확인`] : []),
    benefit,
    ...(unlocksBattleForm ? [`Toughness 최대치 +${level + 1} (Battle Form 획득)`]
      : draft.battleForm || ownsBattleForm ? ['Toughness 최대치 +2 (Battle Form)'] : []),
  ] : null;

  return (
    <section className="play-mastery-card play-advancement" aria-label="레벨업과 능력 해금">
      <h3>레벨업과 능력 해금</h3>
      <div className="mastery-form-fields">
        <label className="field"><span>종이 시트 레벨</span><input inputMode="numeric" value={draft.level} onChange={(event) => patch({ level: event.target.value })}
          aria-invalid={!!draft.level && level === null || undefined} placeholder="예 2" /></label>
        <label className="field"><span>보유 XP</span><input inputMode="numeric" value={draft.xp} onChange={(event) => patch({ xp: event.target.value })}
          aria-invalid={!!draft.xp && xp === null || undefined} placeholder="레벨업 1,000 XP" /></label>
      </div>
      {((draft.level && level === null) || (draft.xp && xp === null)) && <p className="field-err" role="alert">레벨은 1 이상, XP는 0 이상의 정수로 입력하세요.</p>}
      {xp !== null && xp < 1000 && <p className="mastery-note" role="status">레벨업까지 {(1000 - xp).toLocaleString('ko-KR')} XP 남았습니다.</p>}
      {eligible && <>
        <Chips label="Ability Point 사용" value={draft.mastery} onChange={(id) => patch({ mastery: id, tier: '' })} options={[
          { value: '', label: '새 포인트 보관' },
          ...masteryOptions.filter(({ id }) => own.has(id)).map(({ id, name }) => ({ value: id, label: `${name} · Tier ${learnedTier(id)}`, lang: 'en' })),
          ...(draft.mastery && !own.has(draft.mastery) ? [{ value: draft.mastery, label: mastery?.name ?? draft.mastery, lang: 'en' }] : []),
        ]} />
        <TogglePanel label="다른 Mastery" open={otherMastery} onOpenChange={setOtherMastery}>
          <Chips label="다른 Mastery" value={draft.mastery} onChange={(id) => { patch({ mastery: id, tier: '' }); setOtherMastery(false); }}
            options={masteryOptions.filter(({ id }) => !own.has(id)).map(({ id, name }) => ({ value: id, label: name, lang: 'en' }))} />
        </TogglePanel>
        {mastery && !own.has(mastery.id) && <Chips label="시트에서 마지막으로 연 Tier" value={draft.tier} onChange={(value) => patch({ tier: value })} options={[
          { value: '0', label: 'Amulet · 아직 없음' },
          ...mastery.abilities.map(({ tier: number, name }) => ({ value: String(number), label: `Tier ${number} · ${name}` })),
        ]} />}
        {nextAbility && <p className="mastery-rule"><strong>Tier {nextAbility.tier} · <span lang="en">{nextAbility.name}</span></strong><span>{nextAbility.text}</span></p>}
        {mastery && tier === 5 && <p className="mastery-note">Tier 5까지 열었습니다. 다른 Mastery를 고르거나 포인트를 보관하세요.</p>}
        <Chips label="레벨업 혜택 하나" value={draft.benefit} onChange={(benefit) => patch({ benefit: benefit as Benefit, die: null,
          ...(benefit === 'Skill' ? { skill: '', skillScore: '' } : {}),
          ...(benefit === 'Resistance' && pc ? { resistances: { Endurance: pc.skill('Endurance'), Resolve: pc.skill('Resolve'), Spellward: pc.skill('Spellward') } } : {}) })}
          options={[
            ...Object.entries(ROLLED_BENEFITS).map(([name, dice]) => ({ value: name, label: `${name} +${dice}` })),
            { value: '능력 피해', label: '배운 피해 능력 +1' }, { value: 'Skill', label: 'Skill 하나 +5' }, { value: 'Resistance', label: 'Resistance 셋 +5' },
          ]} />
        {draft.benefit === '피해 풀' && <Chips label="물리 피해 유형" value={draft.type} onChange={(type) => patch({ type })}
          options={DAMAGE_TYPES.map((type) => ({ value: type, label: type, lang: 'en' }))} />}
        {dice && <JournalRoll die={dice} label={`${draft.benefit} 증가량`} value={draft.die} onValue={(die) => patch({ die })} />}
        {draft.benefit === 'Skill' && <div className="mastery-form-fields">
          <Chips label="올릴 Skill" value={draft.skill} onChange={(skill) => patch({ skill, skillScore: pc?.skill(skill) ?? '' })}
            options={SKILLS.map((skill) => ({ value: skill, label: pc?.skill(skill) ? `${skill} ${pc.skill(skill)}` : skill, lang: 'en' }))} />
          <label className="field"><span>현재 기본 Skill</span><input autoComplete="off" inputMode="numeric" value={draft.skillScore} onChange={(event) => patch({ skillScore: event.target.value })}
            aria-invalid={!!draft.skillScore && readMasteryInteger(draft.skillScore, 0, 80) === null || undefined} placeholder="0–80" /></label>
          {readMasteryInteger(draft.skillScore) === 80 && <p className="mastery-note">이 Skill은 상한 80에 도달했습니다.</p>}
        </div>}
        {draft.benefit === 'Resistance' && <div className="mastery-form-fields">
          {RESISTANCES.map((id) => <label className="field" key={id}><span>현재 기본 {id}</span>
            <input inputMode="numeric" value={draft.resistances[id]} onChange={(event) => patch({ resistances: { ...draft.resistances, [id]: event.target.value } })}
              aria-invalid={!!draft.resistances[id] && readMasteryInteger(draft.resistances[id], 0, 80) === null || undefined} placeholder="0–80" />
          </label>)}
          <p className="mastery-note">각 Resistance는 상한 80을 적용합니다.</p>
        </div>}
        {draft.benefit === '능력 피해' && (learnedDamaging.length ? <Chips label="시트에서 배운 피해 능력" value={draft.ability}
          onChange={(ability) => patch({ ability })} options={learnedDamaging.map(({ id, name }) => ({ value: id, label: name, lang: 'en' }))} />
          : <label className="field"><span>시트에서 배운 피해 능력</span>
            <select value={draft.ability} onChange={(event) => patch({ ability: event.target.value })}>
              <option value="">선택</option>
              {damagingMasteryAbilities.map(({ id, name, mastery: abilityMastery }) => <option value={id} key={id}>{name} · {abilityMastery}</option>)}
            </select>
          </label>)}
        {!unlocksBattleForm && <label className="mastery-tick"><input type="checkbox" disabled={ownsBattleForm} checked={draft.battleForm || ownsBattleForm}
          onChange={(event) => patch({ battleForm: event.target.checked })} />이미 Battle Form을 배움 · Toughness +2</label>}
        {recorded && <p className="field-err" role="status">이번 장소에 같은 레벨업 기록이 있습니다.</p>}
        {changes && !recorded && <div className="mastery-result">
          <ul aria-label="시트에 옮길 레벨업 결과">{changes.map((line) => <li key={line}>{line}</li>)}</ul>
          <button className="btn primary" type="button" onClick={() => commit(() => {
            setRecords((previous) => [...previous, { level, changes, summary: `레벨업 · ${changes.join(' · ')}`, xp }]);
            updateCharacter();
            setDraft(EMPTY_DRAFT);
          })}>레벨업 기록</button>
        </div>}
      </>}
      {records.length > 0 && <ul className="mastery-records" aria-label="이번 장소 레벨업 기록">
        {records.map(({ level: from, summary }) => <li key={from}>{summary}</li>)}
      </ul>}
      <div className="play-wrap-links"><XRef id="leveling-up">레벨업과 경험치 규칙</XRef><XRef id="masteries">Mastery 해금 규칙</XRef></div>
    </section>
  );
}
