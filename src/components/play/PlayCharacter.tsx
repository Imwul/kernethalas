import { useState } from 'react';
import { masteryCatalog } from '../../content/entries/masteries';
import {
  CHARACTER_DEFENSES, CHARACTER_MASTERY_LIMIT, CHARACTER_WEAPONS, usePlayCharacter,
} from '../../lib/play-character';
import { GROWTH_SKILLS } from '../../lib/skill-growth';
import '../../styles/play-character.css';

const SHORT: Record<string, string> = {
  'Bladed Weapons': 'Bladed', 'Bludgeoning Weapons': 'Bludgeoning', 'Shafted Weapons': 'Shafted', 'Unarmed Combat & Fist Weapons': 'Unarmed / Fist',
};
const GROUPS = [
  { label: '기술', skills: GROWTH_SKILLS.filter((name) => !name.endsWith('Weapons')) },
  { label: '무기', skills: [...CHARACTER_WEAPONS, 'Parry'] },
  { label: '저항·기타', skills: ['Endurance', 'Resolve', 'Spellward', 'Initiative'] },
] as const;

const readScore = (raw: string) => {
  const value = raw.trim();
  return /^\d{1,3}$/.test(value) ? Number(value) : null;
};

/** The paper sheet's level, skills and Masteries, typed once and reused by every check in play mode. */
export function PlayCharacter() {
  const pc = usePlayCharacter();
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  if (!pc) return null;
  const { character } = pc;
  const learned = character.masteries ?? [];
  const text = (key: string, saved: string) => typed[key] ?? saved;
  const type = (key: string, value: string, save: (score: number | undefined) => void) => {
    setTyped((previous) => ({ ...previous, [key]: value }));
    if (!value.trim()) save(undefined);
    else {
      const score = readScore(value);
      if (score !== null) save(score);
    }
  };
  const settle = (key: string) => setTyped(({ [key]: _, ...rest }) => rest);
  const invalid = (key: string) => typed[key] !== undefined && !!typed[key].trim() && readScore(typed[key]) === null;
  const skillField = (name: string) => (
    <label className="field" key={name}><span lang="en">{SHORT[name] ?? name}</span>
      <input inputMode="numeric" value={text(name, pc.skill(name))} maxLength={3} aria-label={`${name} 수치`}
        aria-invalid={invalid(name) || undefined} onBlur={() => settle(name)}
        onChange={(event) => type(name, event.target.value, (score) => pc.setSkill(name, score))} />
    </label>
  );

  return (
    <section className="play-character" aria-label="캐릭터 기본값">
      <p className="play-character-note">종이 시트의 값을 한 번 적어 두면 판정 칸과 레벨 칸에 미리 채워집니다. 장소를 넘겨도 유지됩니다.</p>
      <div className="play-character-head">
        <label className="field"><span>PC 레벨</span>
          <input inputMode="numeric" maxLength={2} value={text('level', pc.level)} aria-invalid={invalid('level') || undefined}
            onBlur={() => settle('level')} placeholder="예 3"
            onChange={(event) => type('level', event.target.value, (level) => pc.update({ level: level && level <= 99 ? level : undefined }))} />
        </label>
        <label className="field"><span>공격 무기</span>
          <select value={character.weapon ?? ''} onChange={(event) => pc.update({ weapon: event.target.value || undefined })}>
            <option value="">선택</option>
            {CHARACTER_WEAPONS.map((name) => <option key={name} value={name}>{SHORT[name] ?? name}</option>)}
          </select>
        </label>
        <label className="field"><span>방어 기술</span>
          <select value={character.defense ?? ''} onChange={(event) => pc.update({ defense: event.target.value || undefined })}>
            <option value="">선택</option>
            {CHARACTER_DEFENSES.map((name) => <option key={name} value={name}>{SHORT[name] ?? name}</option>)}
          </select>
        </label>
      </div>
      {GROUPS.map(({ label, skills }) => (
        <fieldset className="play-character-skills" key={label}>
          <legend>{label}</legend>
          {skills.map(skillField)}
        </fieldset>
      ))}
      <fieldset className="play-character-masteries">
        <legend>배운 Mastery</legend>
        {learned.length > 0 && <ul>
          {learned.map(({ id, tier }) => {
            const mastery = masteryCatalog.find((item) => item.id === id);
            if (!mastery) return null;
            return <li key={id}>
              <span lang="en">{mastery.name}</span>
              <select aria-label={`${mastery.name} 배운 Tier`} value={tier} onChange={(event) => pc.update({
                masteries: learned.map((item) => item.id === id ? { id, tier: Number(event.target.value) } : item),
              })}>
                {mastery.abilities.map(({ tier: value, name }) => <option key={value} value={value}>Tier {value} · {name}</option>)}
              </select>
              <button type="button" className="linkbtn" aria-label={`${mastery.name} 지우기`}
                onClick={() => pc.update({ masteries: learned.filter((item) => item.id !== id) })}>지우기</button>
            </li>;
          })}
        </ul>}
        {learned.length < CHARACTER_MASTERY_LIMIT && <div className="play-character-add">
          <label className="field"><span>Mastery 추가</span>
            <select value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">선택</option>
              {masteryCatalog.filter(({ id }) => !learned.some((item) => item.id === id))
                .map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <button type="button" className="btn ghost" disabled={!adding} onClick={() => {
            pc.update({ masteries: [...learned, { id: adding, tier: 1 }] });
            setAdding('');
          }}>추가</button>
        </div>}
      </fieldset>
    </section>
  );
}
