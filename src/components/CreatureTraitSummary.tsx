import { describeCreatureTrait } from '../content/entries/creatures';
import { XRef } from './bits';
import '../styles/creature-traits.css';

export function CreatureTraitSummary({ traits }: { traits: string[] }) {
  if (!traits.length) return null;

  return (
    <section className="creature-traits" aria-label="생물 특성 효과">
      <h3>상시·발동 특성</h3>
      <ul>
        {traits.map((trait) => {
          const rule = describeCreatureTrait(trait);
          return (
            <li key={trait}>
              <XRef id={rule?.reference ?? 'creature-traits'}>{trait}</XRef>
              {rule && <span>{rule.text}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
