import { tableById } from '../content';
import type { CheckOutcome } from './dice';

export function isSkillDouble(outcome: CheckOutcome): outcome is 'critical' | 'fumble' {
  return outcome === 'critical' || outcome === 'fumble';
}

export function skillCriticalEffect(skill: string, outcome: CheckOutcome) {
  if (!isSkillDouble(outcome)) return undefined;
  const name = skill.toLowerCase().trim();
  const key = name === 'scavenge' ? 'scavenging' : name;
  const row = tableById.get('t-noncombat-crits')?.rows.find(({ label }) => label?.toLowerCase() === key);
  return row?.cols?.[outcome === 'critical' ? 'crit' : 'fumble'];
}
