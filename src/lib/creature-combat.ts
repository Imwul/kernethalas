import { tableById } from '../content';
import { creatureActionKo } from '../content/creature-actions';
import { creatureActionRule } from '../content/creature-action-rules';
import type { CreatureAction, CreatureRecord } from '../content/entries/creatures';
import type { Entry, OracleTable } from '../content/schema';
import { adaptationArmorBonus, type ArmorBonus } from './creature-adaptation';
import { DAMAGE_TYPES, type DamageType } from './damage';

const SPOILS_TABLES: Record<string, string[]> = {
  'Spoils table': ['t-spoils'],
  'Resources table': ['t-resources'],
  '1 roll on the Valuable table, 1 roll on the Precious table': ['t-valuable', 't-precious'],
};

export function creatureSpoilsTables(creature: CreatureRecord): string[] {
  return creature.spoils ? SPOILS_TABLES[creature.spoils] ?? [] : [];
}

export function creatureActionTable(creature: CreatureRecord, entry: Entry): OracleTable {
  const effects = creatureActionKo[creature.id] ?? [];
  return {
    id: creature.id,
    ko: '행동',
    en: `${creature.name} Actions`,
    aliases: [],
    dice: creature.actionDice ?? 'D6',
    group: 'creatures',
    usage: '',
    mode: 'summary',
    columns: [{ key: 'kind', ko: '처리' }],
    rows: creature.actions.map((action, index) => {
      const { resistance, after, summons } = creatureActionRule(creature, action);
      const next = summons?.kind === 'roster' ? summons.creatureId : undefined;
      const check = action.tag === 'Physical' ? '공격 판정' : resistance ? `${resistance} 판정` : '행동 효과 적용';
      const kind = [action.tag, check, after && `추가 ${after}`].filter(Boolean).join(' · ');
      return {
        min: action.min,
        max: action.max,
        label: action.name,
        ko: effects[index] ?? '',
        cols: { kind },
        ...(next ? { next: [{ id: next, note: '소환수 능력치' }] } : {}),
      };
    }),
    related: [],
    source: entry.source,
    verification: entry.verification,
  };
}

function armorAt(armor: string, location: string | null, bonuses: readonly ArmorBonus[]): number | null {
  const match = /^(\d+)\s*\(([^)]+)\)$/.exec(armor);
  const bonus = adaptationArmorBonus(bonuses, location);
  if (bonus === null) return null;
  if (/^[–—-]$/.test(armor)) return bonus;
  if (!match) return null;
  const appliesToAll = /^all( hit)? locations$/i.test(match[2]);
  if (!location && !appliesToAll) return null;
  const applies = appliesToAll || match[2].split(',').some((part) => part.trim() === location);
  return (applies ? Number(match[1]) : 0) + bonus;
}

export function creatureHitImpact(creature: CreatureRecord, location: string | null, bonuses: readonly ArmorBonus[]) {
  return { armor: armorAt(creature.armor, location, bonuses), weak: location !== null && location === creature.weakSpot };
}

export function creatureHitTable(creature: CreatureRecord, entry: Entry, bonuses: readonly ArmorBonus[]): OracleTable | undefined {
  const table = tableById.get(entry.tables?.[0] ?? '');
  if (!table) return;
  return {
    ...table,
    columns: [{ key: 'armor', ko: 'Armor' }, { key: 'weak', ko: '약점' }],
    rows: table.rows.map((row) => {
      const { armor, weak } = creatureHitImpact(creature, row.label ?? '', bonuses);
      return { ...row, cols: { armor: String(armor ?? '능력치 확인'), weak: weak ? '해당' : '—' } };
    }),
  };
}

/** The damage one creature attack deals on a hit, before Level Adaptation. */
export interface CreatureAttackDamage {
  /** Damage dice, e.g. 'D6' or '3D6'. Empty when the attack deals a fixed amount. */
  dice: string;
  /** Fixed amount added to the chosen die, or the whole damage when there are no dice. */
  mod: number;
  type: DamageType;
  /** When an action offers more than one attack, the situation each one is for. */
  when?: string;
}

const attack = (dice: string, type: DamageType, when?: string): CreatureAttackDamage => ({ ...readDamageAmount(dice), type, when });

/**
 * Attacks the action text alone cannot settle: alternatives, or an attack inside an action that is not tagged Physical.
 * Keyed by creature id and the action's lowest roll.
 */
const ATTACK_OVERRIDES: Record<string, Record<number, CreatureAttackDamage[]>> = {
  'cr-cavebound-leech': { 5: [
    attack('2D8', 'Acid', 'Constricting Grasp로 붙잡은 대상'),
    attack('D6', 'Piercing', '붙잡은 대상 없음 · 피해 절반만큼 Health 회복'),
  ] },
  // Shrieking Assault ends with a free melee attack on one creature the shriek affected.
  'cr-bladewings': { 5: [attack('D6', 'Slashing', '비명 뒤 자유 행동 근접 공격')] },
};

const DAMAGE_PHRASE = new RegExp(`(\\d*D\\d+(?:[+-]\\d+)?|\\d+) (${DAMAGE_TYPES.join('|')}) 피해`);

function readDamageAmount(text: string): Pick<CreatureAttackDamage, 'dice' | 'mod'> {
  const match = /^(\d*D\d+)?([+-]?\d+)?$/i.exec(text.trim());
  return { dice: match?.[1]?.toUpperCase() ?? '', mod: Number(match?.[2] ?? 0) };
}

/** Core pp.136–203: a Physical action is an attack; its first damage in the action text is what a hit deals. */
export function creatureAttackDamage(creature: Pick<CreatureRecord, 'id' | 'actions'>, action: CreatureAction): CreatureAttackDamage[] {
  const override = ATTACK_OVERRIDES[creature.id]?.[action.min];
  if (override) return override;
  if (action.tag !== 'Physical') return [];
  const index = creature.actions.findIndex(({ min }) => min === action.min);
  const match = DAMAGE_PHRASE.exec(creatureActionKo[creature.id]?.[index] ?? '');
  return match ? [attack(match[1], match[2] as DamageType)] : [];
}

/** One attack's Damage Pool with Level Adaptation dice added: one die counts (Core p.81), fixed bonuses add to it. */
export interface CreatureAttackPool {
  /** Every die and the fixed total as one roll, e.g. 'D6+D6+2'; null when there is nothing to roll. */
  dice: string | null;
  mod: number;
  type: DamageType;
  /** Level Adaptation bonuses included, as printed. */
  bonuses: string[];
}

export function creatureAttackPool(damage: CreatureAttackDamage, damageBonuses: readonly string[]): CreatureAttackPool {
  const dice = damage.dice ? [damage.dice] : [];
  const bonuses: string[] = [];
  let mod = damage.mod;
  for (const bonus of damageBonuses) {
    if (!bonus.startsWith('+')) continue;
    const amount = readDamageAmount(bonus.slice(1));
    if (!amount.dice && !amount.mod) continue;
    if (amount.dice) dice.push(amount.dice);
    mod += amount.mod;
    bonuses.push(bonus);
  }
  const fixed = mod > 0 ? `+${mod}` : mod < 0 ? String(mod) : '';
  return { dice: dice.length ? dice.join('+') + fixed : null, mod, type: damage.type, bonuses };
}

/** "Penetrating (1)" → 1. The creature's attacks ignore that much Armor. */
export function creaturePenetration(creature: Pick<CreatureRecord, 'traits'>) {
  const trait = creature.traits.map((name) => /^Penetrating \((\d+)\)$/i.exec(name)).find(Boolean);
  return trait ? Number(trait[1]) : 0;
}

/** Dice in a pool expression: 'D6+2D4+1' → 3. */
export function poolDieCount(dice: string | null) {
  return dice ? [...dice.matchAll(/(\d*)D\d+/gi)].reduce((total, [, count]) => total + Number(count || 1), 0) : 0;
}

/** "D6+D6 Piercing · 레벨 적응 +D6 포함 · 가장 높은 눈 · Armor 1 무시" */
export function formatAttackDamage(pool: CreatureAttackPool, penetration = 0) {
  return [
    `${pool.dice ?? pool.mod} ${pool.type}`,
    pool.bonuses.length > 0 && `레벨 적응 ${pool.bonuses.join(' ')} 포함`,
    poolDieCount(pool.dice) > 1 && '가장 높은 눈',
    penetration > 0 && `Armor ${penetration} 무시`,
  ].filter(Boolean).join(' · ');
}
