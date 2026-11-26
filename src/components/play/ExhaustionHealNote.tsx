import { exhaustionHalfHealing } from '../../lib/character-progress';
import { usePlayCharacter } from '../../lib/play-character';
import { XRef } from '../bits';

/** Exhaustion 11+ halves every Wounds recovery (p.90; halves round up, p.70). Shown where recovery is recorded. */
export function ExhaustionHealNote() {
  const pc = usePlayCharacter();
  if (!pc || !exhaustionHalfHealing(pc.exhaustion)) return null;
  return <p className="perk-note exhaustion-heal-note">Exhaustion {pc.exhaustion} · Wounds 회복량 절반(올림) <XRef id="exhaustion">규칙</XRef></p>;
}
