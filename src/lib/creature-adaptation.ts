import type { CreatureRecord } from '../content/entries/creatures';

export const ADAPTED_STATS = {
  health: 'Health',
  combatSkill: 'Combat Skill',
  magicResistance: 'Magic Resistance',
} as const;

type Stat = keyof typeof ADAPTED_STATS;
type AdaptableCreature = Pick<CreatureRecord, Stat | 'levelAdaptation'>;

interface StatValue {
  base: string;
  value: number | null;
  unknown: boolean;
}

export interface ArmorBonus {
  amount: number;
  except?: string;
}

type AdaptationChange =
  | { kind: 'stat'; stat: Stat; amount: number }
  | { kind: 'armor'; bonus: ArmorBonus }
  | { kind: 'damage'; expression: string }
  | { kind: 'unresolved'; source: string; stat?: Stat };

interface AdaptationTier {
  after: number;
  changes: AdaptationChange[];
}

export function readCreatureLevel(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const level = Number(text);
  return Number.isSafeInteger(level) && level > 0 ? level : null;
}

function readBaseStat(source: string, level: number | null): number | null {
  const base = /^(\d+)(?:\s*\+\s*(\d+)\s+per\s+⅃)?$/.exec(source.trim());
  if (!base || (base[2] && level === null)) return null;
  const value = Number(base[1]) + Number(base[2] ?? 0) * (level ?? 0);
  return Number.isSafeInteger(value) ? value : null;
}

const statNames = new Map(Object.entries(ADAPTED_STATS).map(([id, label]) => [label.toLowerCase(), id as Stat]));

function readChange(source: string): AdaptationChange {
  const number = /^([+-]?\d+)\s+(.+)$/.exec(source);
  const stat = number && statNames.get(number[2].toLowerCase());
  if (number && stat) {
    // Glacial Burrower's printed “10 Health” leaves the sign unspecified.
    return /^[+-]/.test(number[1]) ? { kind: 'stat', stat, amount: Number(number[1]) } : { kind: 'unresolved', stat, source };
  }

  const armor = /^([+-]\d+)\s+Armor\s+\(all Hit Locations(?: except ([^)]+))?\)$/i.exec(source);
  if (armor) return { kind: 'armor', bonus: { amount: Number(armor[1]), except: armor[2] } };

  const damage = /^([+-](?:\d+|\d*D\d+(?:[+-]\d+)?))\s+damage$/i.exec(source);
  return damage ? { kind: 'damage', expression: damage[1] } : { kind: 'unresolved', source };
}

/** Core pp.131–132. Each listed threshold applies only after that level. */
export function calculateCreatureAdaptation(creature: AdaptableCreature, level: number | null) {
  const source = creature.levelAdaptation?.trim() ?? '';
  const activeTiers: AdaptationTier[] = [];
  const armorBonuses: ArmorBonus[] = [];
  const damageBonuses: string[] = [];
  const unresolved: string[] = [];
  const stats: Record<Stat, StatValue> = {
    health: { base: creature.health, value: readBaseStat(creature.health, level), unknown: false },
    combatSkill: { base: creature.combatSkill, value: readBaseStat(creature.combatSkill, level), unknown: false },
    magicResistance: { base: creature.magicResistance, value: readBaseStat(creature.magicResistance, level), unknown: false },
  };

  const tiers = [...source.matchAll(/After level (\d+):\s*([^]+?)(?=\s*After level |$)/gi)];
  if (source && !tiers.length) unresolved.push(source);
  for (const [, threshold, text] of tiers) {
    const after = Number(threshold);
    if (level === null || level <= after) continue;
    const changes = text.split(',').map((change) => readChange(change.trim()));
    activeTiers.push({ after, changes });
    for (const change of changes) {
      switch (change.kind) {
        case 'stat': {
          const target = stats[change.stat];
          if (target.value !== null) {
            const value = target.value + change.amount;
            target.value = Number.isSafeInteger(value) ? value : null;
          }
          break;
        }
        case 'armor':
          armorBonuses.push(change.bonus);
          break;
        case 'damage':
          damageBonuses.push(change.expression);
          break;
        case 'unresolved':
          if (change.stat) stats[change.stat].unknown = true;
          unresolved.push(change.source);
          break;
      }
    }
  }

  return { stats, activeTiers, armorBonuses, damageBonuses, unresolved };
}

/** Keep location-restricted bonuses separate when the body part is unknown. */
export function adaptationArmorBonus(bonuses: readonly ArmorBonus[], hitLocation: string | null): number | null {
  const part = hitLocation?.trim().toLowerCase();
  if (!part && bonuses.some((bonus) => bonus.except)) return null;
  return bonuses.reduce((total, { amount, except }) => total + (except && part === except.trim().toLowerCase() ? 0 : amount), 0);
}
