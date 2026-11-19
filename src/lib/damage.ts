export const DAMAGE_TYPES = [
  'Acid', 'Arcane', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Holy', 'Infernal',
  'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Slashing',
] as const;

export type DamageType = typeof DAMAGE_TYPES[number];

const PHYSICAL_DAMAGE = new Set<DamageType>(['Bludgeoning', 'Piercing', 'Slashing']);

export function isPhysicalDamage(type: DamageType) {
  return PHYSICAL_DAMAGE.has(type);
}

export function ignoresArmor(type: DamageType) {
  // Acid has its own Armor effect. Core p.82 does not say it bypasses Armor.
  return type !== 'Acid' && !isPhysicalDamage(type);
}

export interface DamageReactions {
  vulnerable: boolean;
  resistant: boolean;
  immune: boolean;
  restored: boolean;
}

export function splitPcDamage(amount: number, toughness: number, directHealth: boolean) {
  const toughnessLoss = directHealth ? 0 : Math.min(amount, toughness);
  return { toughnessLoss, healthLoss: amount - toughnessLoss };
}

interface DirectDamage {
  roll: number;
  modifier: number;
  type: DamageType;
  critical: 1 | 2 | 3;
  weak: boolean;
  armor: number;
  extraArmorIgnore: number;
  reduction: number;
  reactions: DamageReactions;
}

/** Core pp.80–84. Calculate one selected die's direct attack damage. */
export function calculateDirectDamage(input: DirectDamage) {
  const { roll, modifier, type, critical, weak, armor, extraArmorIgnore, reduction, reactions } = input;
  const base = Math.max(0, roll + modifier);
  const multiplier = Math.max(critical, weak ? 2 : 1);
  const piercing = type === 'Piercing' && critical > 1 ? 2 : 0;
  const beforeArmor = base * multiplier + piercing;
  const armorIgnore = ignoresArmor(type) ? armor : Math.min(armor, extraArmorIgnore + (type === 'Bludgeoning' ? 1 : 0));
  const absorbed = Math.min(beforeArmor, armor - armorIgnore);
  const afterArmor = beforeArmor - absorbed;
  const slashing = type === 'Slashing' && afterArmor <= 3 ? 1 : 0;
  const afterType = afterArmor + slashing;
  const reacted = reactions.immune ? 0
    : reactions.vulnerable === reactions.resistant ? afterType
      : reactions.vulnerable ? 2 * afterType : Math.ceil(afterType / 2);
  const amount = Math.max(0, reacted - reduction);

  return { base, multiplier, piercing, beforeArmor, armorIgnore, absorbed, afterArmor, slashing, afterType, reacted, amount,
    restored: reactions.restored && !reactions.immune };
}
