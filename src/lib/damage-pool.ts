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
