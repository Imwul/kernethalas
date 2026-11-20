import type { PlayRollEntry } from './play-roll-history';

export const PLAY_PENDING_ROLLS_SLOT = 'pendingRolls';
export const PLAY_PENDING_TARGET_LIMIT = 80;

export interface PendingPlayRoll {
  id: string;
  roomId: string;
  place: string;
  stage: PlayRollEntry['stage'];
  field: string;
  label: string;
  dice: string;
  target: string;
  wrapBattleId?: string;
}

export function isPlayPendingRolls(value: unknown): value is PendingPlayRoll[] {
  const entry = (item: unknown): item is PendingPlayRoll => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const roll = item as Record<string, unknown>;
    return typeof roll.id === 'string' && !!roll.id && typeof roll.roomId === 'string' && !!roll.roomId
      && typeof roll.place === 'string' && roll.place.length > 0 && roll.place.length <= 160
      && typeof roll.stage === 'string' && ['explore', 'combat', 'wrapup', 'journal'].includes(roll.stage)
      && typeof roll.field === 'string' && roll.field.length > 0 && roll.field.length <= 600
      && typeof roll.label === 'string' && roll.label.length > 0 && roll.label.length <= 240
      && typeof roll.dice === 'string' && roll.dice.length <= 48
      && typeof roll.target === 'string' && roll.target.length <= PLAY_PENDING_TARGET_LIMIT
      && (roll.wrapBattleId === undefined || roll.stage === 'wrapup' && typeof roll.wrapBattleId === 'string'
        && roll.wrapBattleId.length > 0 && roll.wrapBattleId.length <= 240);
  };
  return Array.isArray(value) && value.every(entry)
    && new Set(value.map(({ roomId, stage, field, wrapBattleId }) => JSON.stringify([roomId, stage, field, wrapBattleId]))).size === value.length
    && new Set(value.map(({ id }) => id)).size === value.length;
}
