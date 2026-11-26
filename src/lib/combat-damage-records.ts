import { DAMAGE_TYPES, type DamageType } from './damage';

export type CombatDamageRecord = {
  id: string;
  target: string;
  source?: string;
  location?: string;
  type?: DamageType;
  amount: number;
  restored?: true;
  loss?: { toughness: number; health: number };
};

export function isCombatDamageSlot(key: string) {
  return /^combat\/[^/]+\/target-[^/]+\/damage-record:(pc|enemy):[^/]+$/.test(key);
}

const isAmount = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const isLabel = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;

export function isCombatDamageRecord(value: unknown): value is CombatDamageRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const { id, target, source, location, type, amount, restored, loss } = value as CombatDamageRecord;
  return isLabel(id) && isLabel(target) && (source === undefined || isLabel(source))
    && (location === undefined || isLabel(location)) && (type === undefined || DAMAGE_TYPES.includes(type))
    && isAmount(amount) && (restored === undefined || restored === true)
    && (loss === undefined || !!loss && isAmount(loss.toughness) && isAmount(loss.health) && loss.toughness + loss.health === amount && !restored);
}

export function readCombatDamageRecords(slots: Record<string, unknown>) {
  return Object.entries(slots).flatMap(([slot, value]) => isCombatDamageSlot(slot) && isCombatDamageRecord(value) ? [value] : []);
}

const decrease = (amount: number) => amount ? `−${amount}` : '0';

export function formatCombatDamage(record: Omit<CombatDamageRecord, 'id'>) {
  const { target, source, location, amount, type, restored, loss } = record;
  const effect = restored ? `Health +${amount} 회복` : `피해 ${amount}`;
  return [
    source ? `${source} → ${target}` : target,
    location,
    [effect, type].filter(Boolean).join(' '),
    loss && `Toughness ${decrease(loss.toughness)} · Health ${decrease(loss.health)}`,
  ].filter(Boolean).join(' · ');
}
