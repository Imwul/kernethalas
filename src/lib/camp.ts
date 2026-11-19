/**
 * Core pp.123–125 for the camp check and activities, p.212 for Bedroll,
 * and pp.120–122 for Growing Darkness 17–18.
 */
type CampResource =
  | 'Ration'
  | 'Crafting Supplies'
  | 'Cooking Ingredients'
  | 'Attunement Crystal'
  | 'Bandage'
  | 'Lamp Oil'
  | 'Lockpick'
  | 'Torch';

type Materials = Partial<Record<CampResource, number>>;

interface CampActivity {
  id: string;
  label: string;
  spend?: readonly [CampResource, number];
  produce?: CampResource;
  exhaustion: number;
  check: number;
  perUnit?: true;
}

export const CAMP_BARRICADE = {
  id: 'barricade', label: '방어벽 재료 수', spend: ['Crafting Supplies', 1], exhaustion: 1, check: 5, perUnit: true,
} as const satisfies CampActivity;

export const CAMP_ACTIVITIES = [
  { id: 'cooking', label: '요리할 Ration 수', spend: ['Cooking Ingredients', 1], produce: 'Ration', exhaustion: 1, check: -1 },
  { id: 'bandages', label: '제작할 Bandage 수', spend: ['Crafting Supplies', 1], produce: 'Bandage', exhaustion: 1, check: -1 },
  { id: 'lamp-oil', label: '제작할 Lamp Oil 수', spend: ['Crafting Supplies', 2], produce: 'Lamp Oil', exhaustion: 1, check: -2 },
  { id: 'lockpicks', label: '제작할 Lockpick 수', spend: ['Crafting Supplies', 1], produce: 'Lockpick', exhaustion: 1, check: -2 },
  { id: 'torches', label: '제작할 Torch 수', spend: ['Crafting Supplies', 1], produce: 'Torch', exhaustion: 1, check: -2 },
  { id: 'treat', label: '치료할 상태 수', spend: ['Bandage', 1], exhaustion: 1, check: 0, perUnit: true },
  { id: 'repair', label: '수리할 장비 수', spend: ['Crafting Supplies', 2], exhaustion: 2, check: -2 },
  { id: 'attune', label: '조율할 마법 아이템 수', spend: ['Attunement Crystal', 1], exhaustion: 1, check: 0, perUnit: true },
] as const satisfies readonly CampActivity[];

export type CampActivityId = typeof CAMP_BARRICADE.id | (typeof CAMP_ACTIVITIES)[number]['id'];
export type CampQuantities = Partial<Record<CampActivityId, number>>;

interface CampPlan {
  quantities: CampQuantities;
  hasRation: boolean;
  sleep: boolean;
  bedroll: boolean;
  darkness: boolean;
  extraCheck: number;
}

export function campTotals(plan: CampPlan) {
  const usedActivities: readonly (CampActivity & { id: CampActivityId })[] =
    plan.sleep ? [CAMP_BARRICADE] : [CAMP_BARRICADE, ...CAMP_ACTIVITIES];
  const spent: Materials = {};
  const produced: Materials = {};
  let exhaustion = plan.sleep ? -5 : 0;
  let check = plan.extraCheck + (plan.sleep ? 2 : 0) + Number(plan.bedroll) - Number(plan.darkness);

  for (const activity of usedActivities) {
    const count = plan.quantities[activity.id] ?? 0;
    if (!count) continue;
    if (activity.spend) {
      const [resource, units] = activity.spend;
      spent[resource] = (spent[resource] ?? 0) + units * count;
    }
    if (activity.produce) produced[activity.produce] = count;
    const batches = activity.perUnit ? count : 1;
    exhaustion += activity.exhaustion * batches;
    check += activity.check * batches;
  }

  const cookedRations = produced.Ration ?? 0;
  const ration = plan.hasRation ? 'carried' : cookedRations > 0 ? 'cooked' : 'missing';
  if (ration === 'carried') spent.Ration = 1;
  if (ration === 'cooked') {
    if (cookedRations === 1) delete produced.Ration;
    else produced.Ration = cookedRations - 1;
  }
  return { spent, produced, exhaustion, check, ration, sleepHealth: plan.sleep ? 1 : 0 } as const;
}

export function resolveCampCheck(roll: number, modifier: number, hasRation: boolean) {
  const total = roll + modifier;
  const passed = total >= 12;
  const benefits = passed ? (hasRation ? 'full' : 'half') : (hasRation ? 'half' : 'unclear');
  return { total, passed, benefits } as const;
}
