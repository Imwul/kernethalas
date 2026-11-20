import { masteryCatalog } from '../content/entries/masteries';
import type { PlaySlots } from './play-roll-history';
import { usePlayDraft } from './play-draft';
import type { PaperChange } from './play-inventory';

export const PLAY_EFFECTS_SLOT = 'ongoingEffects';
export const PLAY_EFFECT_CHANGES_SLOT = 'ongoingEffectChanges';
export const LINGERING_CONDITIONS = [
  { id: 'bleeding', label: '출혈' }, { id: 'burning', label: '화상' }, { id: 'poisoned', label: '중독' },
] as const;

type Condition = typeof LINGERING_CONDITIONS[number]['id'];
export type RestKind = 'rest' | 'camp';
export type TrackedAbility = { id: string; name: string; used?: RestKind; reserved?: number };
export type PlayOngoing = { conditions: Condition[]; abilities: TrackedAbility[] };
const EMPTY: PlayOngoing = { conditions: [], abilities: [] };
const NO_CHANGES: PaperChange[] = [];
const known = masteryCatalog.flatMap(({ abilities }) => abilities);

export function abilityRestLimit(text: string): RestKind | undefined {
  if (/캠프 휴식당 1회|캠프당 1회|야영당 1회|Once per Camp Rest/i.test(text)) return 'camp';
  return /휴식당 1회|Once per Rest/i.test(text) ? 'rest' : undefined;
}

export function ongoingAbilityId(name: string) {
  const query = name.trim().toLowerCase();
  return known.find((ability) => ability.name.toLowerCase() === query)?.id ?? `manual:${query}`;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function condition(value: unknown): value is Condition {
  return LINGERING_CONDITIONS.some(({ id }) => value === id);
}

export function isPlayOngoing(value: unknown): value is PlayOngoing {
  if (!record(value) || !Array.isArray(value.conditions) || !Array.isArray(value.abilities) || value.abilities.length > 200) return false;
  return value.conditions.every(condition) && new Set(value.conditions).size === value.conditions.length
    && value.abilities.every((item: unknown) => record(item) && typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 200
      && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 80
      && (item.used === undefined || item.used === 'rest' || item.used === 'camp')
      && (item.reserved === undefined || typeof item.reserved === 'number' && Number.isSafeInteger(item.reserved) && item.reserved > 0)
      && (item.used !== undefined || item.reserved !== undefined))
    && new Set(value.abilities.map(({ id }) => id)).size === value.abilities.length;
}

export function readPlayOngoing(slots: PlaySlots): PlayOngoing {
  const stored = slots[PLAY_EFFECTS_SLOT];
  if (isPlayOngoing(stored)) return stored;
  const legacyConditions = slots['wrap/survival/lingering'];
  const conditions = Array.isArray(legacyConditions) ? [...new Set(legacyConditions.filter(condition))] : [];
  let abilities: TrackedAbility[] = [];
  for (const [slot, records] of Object.entries(slots)) {
    if (!slot.endsWith('/mastery-records') || !Array.isArray(records)) continue;
    for (const item of records) {
      if (!record(item)) continue;
      const ability = known.find(({ id }) => id === item.ability);
      if (!ability) continue;
      const used = abilityRestLimit(ability.text);
      const tracked = abilities.find(({ id }) => id === ability.id);
      const cost = item.sustained && Array.isArray(item.changes) ? item.changes.flatMap((change: unknown) => {
        if (!record(change) || typeof change.text !== 'string') return [];
        const amount = Number(/^최대 Aether −(\d+)/.exec(change.text)?.[1]);
        return Number.isSafeInteger(amount) && amount > 0 ? [amount] : [];
      })[0] : undefined;
      const current = { ...tracked, id: ability.id, name: ability.name, ...(used ? { used } : {}), reserved: cost };
      abilities = updateAbility(abilities, current);
    }
  }
  return conditions.length || abilities.length ? { conditions, abilities } : EMPTY;
}

function updateAbility(previous: TrackedAbility[], item: TrackedAbility) {
  const next = previous.filter(({ id }) => id !== item.id);
  if (item.used || item.reserved) next.push(item);
  return next;
}

export function usePlayOngoingEffects() {
  const draft = usePlayDraft();
  const current = draft ? readPlayOngoing(draft.slots) : EMPTY;
  const update = (change: (previous: PlayOngoing) => PlayOngoing) => {
    draft?.write(draft.generation, PLAY_EFFECTS_SLOT, change, current);
  };
  const trackAbility = (item: TrackedAbility) => {
    if (!item.used && !item.reserved) return;
    update((previous) => {
      const old = previous.abilities.find(({ id }) => id === item.id);
      if (!old && previous.abilities.length >= 200) return previous;
      return { ...previous, abilities: updateAbility(previous.abilities, { ...old, ...item }) };
    });
  };
  const release = (item: TrackedAbility, recordSheet = true) => {
    let amount = 0;
    update((previous) => {
      const tracked = previous.abilities.find(({ id }) => id === item.id);
      if (!tracked?.reserved) return previous;
      amount = tracked.reserved;
      return { ...previous, abilities: updateAbility(previous.abilities, { ...tracked, reserved: undefined }) };
    });
    if (!amount || !recordSheet) return;
    draft?.write(draft.generation, PLAY_EFFECT_CHANGES_SLOT, (previous) => [...previous, {
      id: `sustained-release-${crypto.randomUUID()}`, text: `최대 Aether +${amount} (${item.name} 유지 해제)`,
    }], NO_CHANGES);
  };
  return {
    current, trackAbility, release,
    setCondition: (id: Condition, checked: boolean) => update((previous) => ({
      ...previous, conditions: [...previous.conditions.filter((entry) => entry !== id), ...(checked ? [id] : [])],
    })),
    clearUsed: (item: TrackedAbility) => update((previous) => {
      const tracked = previous.abilities.find(({ id }) => id === item.id);
      return tracked ? { ...previous, abilities: updateAbility(previous.abilities, { ...tracked, used: undefined }) } : previous;
    }),
    confirmRest: (kind: RestKind, id: string) => {
      draft?.write(draft.generation, kind === 'rest' ? 'confirmedBreather' : 'confirmedCamp', id, '');
      update((previous) => ({ ...previous, abilities: previous.abilities.flatMap((item) => {
        const used = kind === 'camp' || item.used === 'rest' ? undefined : item.used;
        return used || item.reserved ? [{ ...item, used }] : [];
      }) }));
    },
  };
}
