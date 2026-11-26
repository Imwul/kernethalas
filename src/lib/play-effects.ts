import { masteryCatalog } from '../content/entries/masteries';
import { activeConditionOrigin, type ConditionOrigin } from './play-combat-timing';
import type { PlaySlots } from './play-roll-history';
import { usePlayDraft } from './play-draft';
import type { PaperChange } from './play-inventory';

export const PLAY_EFFECTS_SLOT = 'ongoingEffects';
export const PLAY_EFFECT_CHANGES_SLOT = 'ongoingEffectChanges';
export const LINGERING_ENTRY_SLOT = 'lingeringAtEntry';
export const LINGERING_RECORDED_SLOT = 'lingering-recorded';
export const LINGERING_CONDITIONS = [
  { id: 'bleeding', label: '출혈' }, { id: 'burning', label: '화상' }, { id: 'poisoned', label: '중독' },
] as const;

type Condition = typeof LINGERING_CONDITIONS[number]['id'];
export type RestKind = 'rest' | 'camp';
export type TrackedAbility = { id: string; name: string; used?: RestKind; reserved?: number };
/** Bleeding and Poisoned use their levels in combat, and deal one damage per room outside combat. */
export type PlayOngoing = {
  conditions: Condition[];
  abilities: TrackedAbility[];
  levels?: Partial<Record<Condition, number>>;
  poisonOrigin?: ConditionOrigin;
};
export type LingeringCondition = Condition;
/** Conditions named in a creature action's text, with their (X) when given. */
export function conditionsInText(text: string): { id: Condition; level: number }[] {
  const found: { id: Condition; level: number }[] = [];
  const bleeding = /Bleeding\s*\((\d+)\)/.exec(text);
  if (bleeding) found.push({ id: 'bleeding', level: Number(bleeding[1]) });
  const poisoned = /Poisoned\s*\((\d+)\)/.exec(text);
  if (poisoned) found.push({ id: 'poisoned', level: Number(poisoned[1]) });
  if (/Burning/.test(text)) found.push({ id: 'burning', level: 1 });
  return found;
}
export const EMPTY_PLAY_ONGOING: PlayOngoing = { conditions: [], abilities: [] };
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
  if (value.levels !== undefined && !(record(value.levels) && Object.entries(value.levels).every(([id, level]) =>
    condition(id) && Number.isSafeInteger(level) && (level as number) >= 1 && (level as number) <= 99))) return false;
  if (value.poisonOrigin !== undefined && !(value.conditions.includes('poisoned') && record(value.poisonOrigin)
    && typeof value.poisonOrigin.encounter === 'string' && value.poisonOrigin.encounter.length <= 600
    && Number.isSafeInteger(value.poisonOrigin.round) && Number(value.poisonOrigin.round) >= 1)) return false;
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
  return conditions.length || abilities.length ? { conditions, abilities } : EMPTY_PLAY_ONGOING;
}

function withoutConditions(previous: PlayOngoing, ids: readonly Condition[]): PlayOngoing {
  if (!previous.conditions.some((id) => ids.includes(id))) return previous;
  const levels = { ...previous.levels };
  for (const id of ids) delete levels[id];
  return {
    ...previous,
    conditions: previous.conditions.filter((id) => !ids.includes(id)),
    levels: Object.keys(levels).length ? levels : undefined,
    poisonOrigin: ids.includes('poisoned') ? undefined : previous.poisonOrigin,
  };
}

function updateAbility(previous: TrackedAbility[], item: TrackedAbility) {
  const next = previous.filter(({ id }) => id !== item.id);
  if (item.used || item.reserved) next.push(item);
  return next;
}

export function usePlayOngoingEffects() {
  const draft = usePlayDraft();
  const current = draft ? readPlayOngoing(draft.slots) : EMPTY_PLAY_ONGOING;
  const origin = draft && activeConditionOrigin(draft.slots);
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
    setCondition: (id: Condition, checked: boolean) => update((previous) => !checked ? withoutConditions(previous, [id])
      : previous.conditions.includes(id) ? previous : {
        ...previous, conditions: [...previous.conditions, id],
        ...(id === 'poisoned' && origin ? { poisonOrigin: origin } : {}),
      }),
    removeConditions: (ids: readonly Condition[]) => update((previous) => withoutConditions(previous, ids)),
    /** Gives the PC a condition; Bleeding and Poisoned stack their X (p.88–89), Burning does not. */
    addCondition: (id: Condition, level = 1) => update((previous) => {
      const before = previous.conditions.includes(id) ? previous.levels?.[id] ?? 1 : 0;
      const next = id === 'burning' ? 1 : Math.min(99, before + level);
      return {
        ...previous, conditions: before ? previous.conditions : [...previous.conditions, id], levels: { ...previous.levels, [id]: next },
        ...(id === 'poisoned' && !before && origin ? { poisonOrigin: origin } : {}),
      };
    }),
    setLevel: (id: Condition, level: number) => update((previous) => previous.conditions.includes(id)
      ? { ...previous, levels: { ...previous.levels, [id]: Math.max(1, Math.min(99, level)) } } : previous),
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
