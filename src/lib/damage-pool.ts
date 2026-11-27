import type { ActionDamage } from '../content/creature-action-rules';
import type { DamageType } from './damage';
import { parseDice } from './dice';

export interface ActionDamagePool {
  /** All of the action's damage dice rolled together, e.g. 'D8+D4'. */
  dice: string;
  /** Damage type of each die, in roll order. */
  types: readonly DamageType[];
  /** True when the dice carry more than one damage type, so the choice of die matters. */
  mixed: boolean;
}

/**
 * Core p.81: a creature's damage dice form one Damage Pool and only one die counts.
 * Fixed amounts are not rolled and stay separate.
 */
export function splitActionDamage(damage: readonly ActionDamage[]) {
  const fixed = damage.filter((entry): entry is readonly [DamageType, number] => typeof entry[1] === 'number');
  const rolled = damage.filter((entry): entry is readonly [DamageType, string] => typeof entry[1] === 'string');
  if (!rolled.length) return { fixed, pool: null };
  const types = rolled.flatMap(([type, dice]) => Array.from({ length: parseDice(dice)?.count ?? 1 }, () => type));
  const pool: ActionDamagePool = { dice: rolled.map(([, dice]) => dice).join('+'), types, mixed: new Set(types).size > 1 };
  return { fixed, pool };
}

function addFixed(dice: string, amount: number) {
  const match = /^(\d*D\d+)([+-]\d+)?$/i.exec(dice);
  if (!match) return `${dice}+${amount}`;
  const total = Number(match[2] ?? 0) + amount;
  return total ? `${match[1]}${total > 0 ? '+' : ''}${total}` : match[1];
}

/**
 * Level Adaptation "+D6 damage" (Core pp.131–132) puts another die of the action's damage type into its Damage Pool;
 * a fixed "+2 damage" adds to the die that counts. Returns the bonuses it applied.
 */
export function withDamageBonuses(damage: readonly ActionDamage[], bonuses: readonly string[]) {
  if (!damage.length) return { damage, applied: [] as string[] };
  const result = [...damage];
  const applied: string[] = [];
  const type = (damage.find(([, amount]) => typeof amount === 'string') ?? damage[0])[0];
  for (const bonus of bonuses) {
    const match = /^\+(\d*D\d+)?(?:\+?(\d+))?$/i.exec(bonus.trim());
    if (!match || (!match[1] && !match[2])) continue;
    const fixed = Number(match[2] ?? 0);
    if (match[1]) {
      result.push([type, fixed ? `${match[1].toUpperCase()}+${fixed}` : match[1].toUpperCase()]);
    } else {
      const rolled = result.findIndex(([, amount]) => typeof amount === 'string');
      const index = rolled >= 0 ? rolled : 0;
      const [entryType, amount] = result[index];
      result[index] = [entryType, typeof amount === 'string' ? addFixed(amount, fixed) : amount + fixed];
    }
    applied.push(bonus);
  }
  return { damage: result as readonly ActionDamage[], applied };
}
