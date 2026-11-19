export interface PartyMember {
  id: string;
  name: string;
}

export function targetAllocation(enemies: number, pcs: number, allies: number, picks: string[]) {
  const base = Math.floor(enemies / (pcs + allies));
  const extra = enemies % (pcs + allies);
  const members = (id: string, label: string, count: number): PartyMember[] => Array.from({ length: count }, (_, index) => ({
    id: `${id}-${index + 1}`, name: count === 1 ? label : `${label} ${index + 1}`,
  }));
  const pcGroup = members('pc', 'PC', pcs);
  const allyGroup = members('ally', '동료·Minion', allies);
  const automatic = extra >= pcs ? pcGroup.map(({ id }) => id) : [];
  const eligible = extra >= pcs ? allyGroup : pcGroup;
  const remaining = extra - automatic.length;
  const chosen = new Set([...automatic, ...picks]);
  const candidates = remaining > picks.length ? eligible.filter(({ id }) => !chosen.has(id)) : [];
  const sides = [4, 6, 8, 10, 12, 20].find((die) => die >= candidates.length) ?? 20;
  return {
    candidates, sides, remaining: Math.max(0, remaining - picks.length),
    counts: [...pcGroup, ...allyGroup].map((member) => ({ ...member, count: base + Number(chosen.has(member.id)) })),
  };
}
