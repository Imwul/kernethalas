import { useId } from 'react';
import { PART_KO, type CreatureRecord } from '../content/entries/creatures';
import { ADAPTED_STATS, calculateCreatureAdaptation, readCreatureLevel } from '../lib/creature-adaptation';
import '../styles/creature-adaptation.css';

interface CreatureAdaptationProps {
  creature: CreatureRecord;
  levelText: string;
  onLevelChange: (value: string) => void;
}

const statIds = Object.keys(ADAPTED_STATS) as (keyof typeof ADAPTED_STATS)[];
const shortStat = { health: 'Health', combatSkill: 'CS', magicResistance: 'MR' } as const;

export function CreatureAdaptation({ creature, levelText, onLevelChange }: CreatureAdaptationProps) {
  const fieldId = useId();
  const level = readCreatureLevel(levelText);
  const invalid = levelText.trim() !== '' && level === null;
  const supportsAdaptation = !!creature.levelAdaptation || statIds.some((stat) => creature[stat].includes('⅃'));
  const { stats, activeTiers, armorBonuses, damageBonuses, unresolved } = calculateCreatureAdaptation(creature, level);
  const ratings = statIds.map((stat) => {
    const { base, value, unknown } = stats[stat];
    const formula = base.replace(/\s*\+\s*/g, ' + ').replace(/\s+per\s+⅃/, ' × 레벨');
    return { stat, formula, rating: unknown ? '확인 필요' : (value?.toString() ?? formula) };
  });
  const baseValues = ratings
    .filter(({ formula, rating }) => formula !== rating)
    .map(({ stat, formula }) => `${shortStat[stat]} ${formula}`);

  return (
    <>
      {supportsAdaptation && (
        <div className="creature-level">
          <label htmlFor={fieldId}>PC 레벨</label>
          <input
            id={fieldId}
            inputMode="numeric"
            autoComplete="off"
            placeholder="미입력"
            value={levelText}
            onChange={(event) => onLevelChange(event.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${fieldId}-error` : undefined}
          />
          {invalid ? <span id={`${fieldId}-error`}>1 이상의 정수를 입력하세요.</span>
            : activeTiers.length > 0 && <span>{activeTiers.map(({ after }) => after).join('·')}레벨 초과 보정 적용</span>}
          {baseValues.length > 0 && <small>기본 {baseValues.join(' · ')}</small>}
        </div>
      )}
      <dl className="creature-adaptation-stats" aria-label="전투 수치" aria-live="polite">
        {ratings.map(({ stat, rating }) => (
          <div key={stat}>
            <dt>
              <span className="sr-only">{ADAPTED_STATS[stat]}</span>
              <abbr className="creature-stat-short" aria-hidden="true" title={ADAPTED_STATS[stat]}>{shortStat[stat]}</abbr>
            </dt>
            <dd><strong>{rating}</strong></dd>
          </div>
        ))}
      </dl>
      {(damageBonuses.length > 0 || armorBonuses.length > 0 || unresolved.length > 0) && (
        <ul className="creature-adaptation-mods" aria-live="polite">
          {damageBonuses.length > 0 && <li><b>피해 보정</b> {damageBonuses.join(' · ')}</li>}
          {armorBonuses.map(({ amount, except }, index) => (
            <li key={index}>
              <b>Armor 보정</b> {amount > 0 ? '+' : ''}{amount} {except ? `(전 부위, ${PART_KO.get(except) ?? except} 제외)` : '(전 부위)'}
            </li>
          ))}
          {unresolved.map((change, index) => <li key={`${index}-${change}`} className="creature-adaptation-check"><b>원문 확인</b> {change}</li>)}
        </ul>
      )}
    </>
  );
}
