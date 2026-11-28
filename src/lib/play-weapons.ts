import { STARTING_WEAPONS, type StartingWeapon } from './character-creation';
import { DAMAGE_TYPES, type DamageType } from './damage';
import type { GearItem } from './play-inventory';

/** What a carried weapon changes in an attack (Core pp.79, 208–209). */
export interface PcWeapon {
  name: string;
  skill: StartingWeapon['skill'];
  type: DamageType;
  /** Subtracted from the target's Combat Skill when attacking. */
  speed: number;
  /** Powerful +1, Two-Handed +2, added to the chosen damage die. */
  damageBonus: number;
  damageNotes: string[];
  /** Simple: +10 Combat Skill. */
  attackBonus: number;
  /** Quick: +10 Initiative. */
  quick: boolean;
}

const DAMAGE_TRAITS: Record<string, number> = { Powerful: 1, 'Two-Handed': 2 };

export function weaponProfile(weapon: StartingWeapon): PcWeapon | null {
  const type = DAMAGE_TYPES.find((item) => item === weapon.damage);
  if (!type) return null;
  const damageNotes = weapon.traits.filter((trait) => DAMAGE_TRAITS[trait]).map((trait) => `${trait} +${DAMAGE_TRAITS[trait]}`);
  return {
    name: weapon.name,
    skill: weapon.skill,
    type,
    speed: Number(weapon.speed) || 0,
    damageBonus: weapon.traits.reduce((total, trait) => total + (DAMAGE_TRAITS[trait] ?? 0), 0),
    damageNotes,
    attackBonus: weapon.traits.includes('Simple') ? 10 : 0,
    quick: weapon.traits.includes('Quick'),
  };
}

const byName = new Map(STARTING_WEAPONS.map((weapon) => [weapon.name.toLowerCase(), weapon]));

/** Weapons from the weapon table that the gear ledger holds (unbroken, at least one), each once. */
export function carriedWeapons(items: readonly GearItem[]): PcWeapon[] {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const weapon = item.count > 0 && item.integrity !== 'broken' ? byName.get(item.name.trim().toLowerCase()) : undefined;
    const profile = weapon && !seen.has(weapon.name) ? weaponProfile(weapon) : null;
    if (!profile) return [];
    seen.add(profile.name);
    return [profile];
  });
}

/** The weapon an attack uses: the one picked, else one for the main weapon Skill, else the first carried. */
export function attackWeapon(weapons: readonly PcWeapon[], picked: string, mainSkill?: string) {
  return weapons.find(({ name }) => name === picked) ?? weapons.find(({ skill }) => skill === mainSkill) ?? weapons[0];
}
