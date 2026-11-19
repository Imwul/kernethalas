import { useEffect, useMemo } from 'react';
import { masteryCatalog } from '../../content/entries/masteries';
import { damagingMasteryAbilities, readMasteryInteger } from '../../lib/mastery-play';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';
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

export function PlayAdvancement({ onSheetChange, onJournalChange }: {
  onSheetChange?: (items: SheetItem[]) => void;
  onJournalChange?: (line: string) => void;
}) {
  const [draft, setDraft] = usePlayDraftState('advancement-draft', EMPTY_DRAFT);
  const [records, setRecords] = usePlayDraftState<AdvancementRecord[]>('advancement-records', []);
  const commit = usePlayRoll();
  const patch = (next: Partial<AdvancementDraft>) => setDraft((previous) => ({ ...previous, ...next }));
  const report = useMemo(() => ({
    journal: records.map(({ summary }) => summary).join(' / '),
    sheet: records.flatMap(({ changes, level }) => changes.map((text, index) => ({ id: `level-up-${level}-${index}`, text }))),
  }), [records]);
  useEffect(() => { onSheetChange?.(report.sheet); onJournalChange?.(report.journal); }, [report, onSheetChange, onJournalChange]);

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
        <div className="mastery-form-fields">
          <label className="field"><span>Ability Point 사용</span>
            <select value={draft.mastery} onChange={(event) => patch({ mastery: event.target.value, tier: '' })}>
              <option value="">새 포인트 보관</option>
              {masteryCatalog.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
            </select>
          </label>
          {mastery && <label className="field"><span>시트에서 마지막으로 연 Tier</span>
            <select value={draft.tier} onChange={(event) => patch({ tier: event.target.value })}>
              <option value="" disabled>선택</option><option value="0">Amulet · 아직 해금하지 않음</option>
              {mastery.abilities.map(({ tier: number, name }) => <option value={number} key={number}>Tier {number} · {name}</option>)}
            </select>
          </label>}
        </div>
        {nextAbility && <p className="mastery-rule"><strong>Tier {nextAbility.tier} · <span lang="en">{nextAbility.name}</span></strong><span>{nextAbility.text}</span></p>}
        {mastery && tier === 5 && <p className="mastery-note">Tier 5까지 열었습니다. 다른 Mastery를 고르거나 포인트를 보관하세요.</p>}
        <div className="mastery-form-fields">
          <label className="field"><span>레벨업 혜택 하나</span>
            <select value={draft.benefit} onChange={(event) => patch({ benefit: event.target.value as Benefit, die: null })}>
              <option value="" disabled>선택</option>
              {Object.entries(ROLLED_BENEFITS).map(([name, dice]) => <option value={name} key={name}>{name} +{dice}</option>)}
              <option value="능력 피해">배운 피해 능력 피해 +1</option><option value="Skill">Skill 하나 +5</option>
              <option value="Resistance">Resistance 세 가지 +5</option>
            </select>
          </label>
          {draft.benefit === '피해 풀' && <label className="field"><span>물리 피해 유형</span><select value={draft.type} onChange={(event) => patch({ type: event.target.value })}>
            <option value="">선택</option>{DAMAGE_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select></label>}
        </div>
        {dice && <JournalRoll die={dice} label={`${draft.benefit} 증가량`} value={draft.die} onValue={(die) => patch({ die })} />}
        {draft.benefit === 'Skill' && <div className="mastery-form-fields">
          <label className="field"><span>올릴 Skill</span><select value={draft.skill} onChange={(event) => patch({ skill: event.target.value, skillScore: '' })}>
            <option value="">선택</option>{SKILLS.map((skill) => <option key={skill}>{skill}</option>)}
          </select></label>
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
        {draft.benefit === '능력 피해' && <label className="field"><span>시트에서 배운 피해 능력</span>
          <select value={draft.ability} onChange={(event) => patch({ ability: event.target.value })}>
            <option value="">선택</option>
            {damagingMasteryAbilities.map(({ id, name, mastery: abilityMastery }) => <option value={id} key={id}>{name} · {abilityMastery}</option>)}
          </select>
        </label>}
        {!unlocksBattleForm && <label className="mastery-tick"><input type="checkbox" disabled={ownsBattleForm} checked={draft.battleForm || ownsBattleForm}
          onChange={(event) => patch({ battleForm: event.target.checked })} />이미 Battle Form을 배움 · Toughness +2</label>}
        {recorded && <p className="field-err" role="status">이번 장소에 같은 레벨업 기록이 있습니다.</p>}
        {changes && !recorded && <div className="mastery-result">
          <ul aria-label="시트에 옮길 레벨업 결과">{changes.map((line) => <li key={line}>{line}</li>)}</ul>
          <button className="btn primary" type="button" onClick={() => commit(() => {
            setRecords((previous) => [...previous, { level, changes, summary: `레벨업 · ${changes.join(' · ')}` }]);
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
