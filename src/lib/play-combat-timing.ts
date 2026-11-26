import { usePlayDraftState } from './play-draft';
import type { PlaySlots } from './play-roll-history';

export type CombatTiming = 'start' | 'end' | 'round';
export type CombatPosition = { round: number; timing: CombatTiming; actor: string | null };
export type ConditionOrigin = { encounter: string; round: number };

const FIRST_ROUND: CombatPosition = { round: 1, timing: 'round', actor: null };
const ROUND_SLOT = 'round-position';

export function combatToolsScope(encounterId: string | null) {
  return `combat-tools-${encounterId}`;
}

export function useCombatPosition() {
  return usePlayDraftState(ROUND_SLOT, FIRST_ROUND);
}

/** Finds the same persisted clock as the round board, including when a condition is added from the drawer. */
export function activeConditionOrigin(slots: PlaySlots): ConditionOrigin | undefined {
  if (slots.active !== 'combat') return;
  const battleId = typeof slots.combat === 'string' ? slots.combat : 'place';
  const battles = slots.battles as Record<string, { outcome?: unknown; seed?: { creatureIds?: string[] } }> | undefined;
  const battle = battles?.[battleId];
  if (battle?.outcome) return;
  const scope = `combat/${encodeURIComponent(battleId)}/`;
  const lineup = slots[`${scope}lineup`] as { encounterId: string | null } | undefined;
  const encounterId = lineup ? lineup.encounterId : battle?.seed?.creatureIds?.length ? 'initial-1' : null;
  if (typeof encounterId !== 'string') return;
  const encounter = JSON.stringify([slots.roomLedgerId ?? slots.roomNumber ?? 1, battleId, encounterId]);
  const position = slots[`${scope}${encodeURIComponent(combatToolsScope(encounterId))}/${ROUND_SLOT}`] as CombatPosition | undefined;
  return { encounter, round: position?.round ?? FIRST_ROUND.round };
}
