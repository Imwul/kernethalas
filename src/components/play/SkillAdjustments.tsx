import { useState } from 'react';
import { usePlayDraft } from '../../lib/play-draft';
import { encounterInteger } from '../../lib/encounter-start';
import {
  formatSkillBreakdown, PLAY_SKILL_PRESETS, SKILL_MODIFIER_REASONS, SKILL_PRESETS_SLOT, skillBreakdown, skillPresetName,
  type SkillModifier, type SkillTerm,
} from '../../lib/play-skill';
import '../../styles/play-skill.css';

const EMPTY: Record<string, number> = {};

export function SkillAdjustments({ skill, base, onBase, modifiers, onModifiers, fixed, disabled, label }: {
  skill?: string;
  base: string;
  onBase: (value: string) => void;
  modifiers: SkillModifier[];
  onModifiers: (items: SkillModifier[]) => void;
  fixed?: SkillTerm[];
  disabled?: boolean;
  label?: string;
}) {
  const play = usePlayDraft();
  const [chosen, setChosen] = useState('');
  if (!play) return null;
  const known = skillPresetName(skill);
  const selected = known ?? skillPresetName(chosen);
  const presets = (play.slots[SKILL_PRESETS_SLOT] as Record<string, number> | undefined) ?? EMPTY;
  const saved = selected && Object.hasOwn(presets, selected) ? presets[selected] : undefined;
  const original = encounterInteger(base);
  const breakdown = skillBreakdown(base, modifiers, fixed);
  const patch = (index: number, change: Partial<SkillModifier>) => onModifiers(modifiers.map((entry, at) => (
    index === at ? { ...entry, ...change } : entry
  )));
  const setPreset = (value: number | undefined) => {
    if (!selected) return;
    play.write(play.generation, SKILL_PRESETS_SLOT, (previous) => {
      const next = { ...previous };
      if (value === undefined) delete next[selected];
      else next[selected] = value;
      return next;
    }, EMPTY);
  };

  return (
    <details className="fold play-skill-adjustments">
      <summary>{label ? `${label} 기본값·보정` : '기본값·보정'}</summary>
      <div className="play-skill-preset">
        {!known && <label className="field"><span>저장할 기술</span>
          <select value={chosen} disabled={disabled} onChange={(event) => setChosen(event.target.value)}>
            <option value="">기술 선택</option>
            {PLAY_SKILL_PRESETS.map((entry) => <option key={entry}>{entry}</option>)}
          </select>
        </label>}
        <div className="play-skill-buttons">
          {saved !== undefined && <button type="button" className="btn ghost" disabled={disabled} onClick={() => onBase(String(saved))}>
            {selected} {saved} 불러오기
          </button>}
          <button type="button" className="btn ghost" disabled={disabled || !selected || original === null || original < 0 || saved === original}
            onClick={() => { if (original !== null) setPreset(original); }}>현재 수치를 기본값으로 저장</button>
          {saved !== undefined && <button type="button" className="linkbtn" disabled={disabled} onClick={() => setPreset(undefined)}>저장한 기본값 지우기</button>}
        </div>
      </div>
      {modifiers.length > 0 && <ol className="play-skill-terms">
        {modifiers.map(({ reason, amount }, index) => (
          <li key={index}>
            <label className="field"><span>보정 이유 {index + 1}</span>
              <select value={reason} disabled={disabled} onChange={(event) => patch(index, { reason: event.target.value })}>
                {SKILL_MODIFIER_REASONS.map((entry) => <option key={entry}>{entry}</option>)}
              </select>
            </label>
            <label className="field"><span>보정값 {index + 1}</span>
              <input value={amount} maxLength={24} disabled={disabled} onChange={(event) => patch(index, { amount: event.target.value })}
                aria-invalid={!!amount.trim() && encounterInteger(amount) === null || undefined} placeholder="예 −10" />
            </label>
            <button type="button" className="btn ghost" aria-label={`보정 ${index + 1} 삭제`} disabled={disabled}
              onClick={() => onModifiers(modifiers.filter((_, at) => at !== index))}>삭제</button>
          </li>
        ))}
      </ol>}
      <div className="play-skill-buttons">
        <button type="button" className="btn ghost" disabled={disabled || modifiers.length >= 8}
          onClick={() => onModifiers([...modifiers, { reason: '상태·어둠', amount: '' }])}>보정 추가</button>
        {breakdown && <output aria-label="Skill 계산" className="play-skill-total">{formatSkillBreakdown(breakdown)}</output>}
      </div>
    </details>
  );
}
