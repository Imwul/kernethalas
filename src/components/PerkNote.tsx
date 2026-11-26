import type { ReactNode } from 'react';
import { usePlayCharacter, type PERKS } from '../lib/play-character';

/** A reminder where a Perk the survivor has changes what happens (p.63); nothing outside play mode. */
export function PerkNote({ perk, children }: { perk: (typeof PERKS)[number]; children: ReactNode }) {
  const pc = usePlayCharacter();
  if (!pc?.hasPerk(perk)) return null;
  return <p className="perk-note"><b lang="en">{perk}</b> Perk · {children}</p>;
}
