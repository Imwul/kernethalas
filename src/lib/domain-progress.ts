import { DICE_CHAIN } from './dice';
import { resolveUsageDie, type UsageDie } from './usage-die';

type DomainRollKind = 'lair' | 'exit';
type DomainPlace = { id: string; name: string };
type Discovery = DomainPlace & { source: 'roll' | 'map' };

export interface DomainProgress {
  mode: 'standard' | 'intro';
  corridorLair: boolean;
  entryPlaceId: string | null;
  lairDie: UsageDie;
  exitDie: UsageDie;
  lair: Discovery | null;
  exit: Discovery | null;
  lastCheck: { kind: DomainRollKind; placeId: string; die: UsageDie; value: number } | null;
}

export function newDomainProgress(entryPlaceId?: string): DomainProgress {
  return {
    mode: 'standard', corridorLair: false, entryPlaceId: entryPlaceId ?? null,
    lairDie: 'D10', exitDie: 'D8', lair: null, exit: null, lastCheck: null,
  };
}

export const DEFAULT_DOMAIN_PROGRESS = newDomainProgress();

export function domainCheckKind(progress: DomainProgress, place: 'room' | 'corridor', revisit: boolean, placeId: string): DomainRollKind | null {
  if (progress.lastCheck?.placeId === placeId) return progress.lastCheck.kind;
  if (revisit || progress.mode === 'intro' || progress.exit || progress.lair?.id === placeId) return null;
  if (progress.lair) return 'exit';
  return place === 'room' || progress.corridorLair ? 'lair' : null;
}

export function applyDomainCheck(progress: DomainProgress, kind: DomainRollKind, place: DomainPlace, value: number): DomainProgress {
  const field = kind === 'lair' ? 'lairDie' : 'exitDie';
  const die = progress[field];
  if (progress[kind] || progress.lastCheck?.placeId === place.id || progress.mode === 'intro') return progress;
  if (kind === 'exit' && (!progress.lair || progress.lair.id === place.id)) return progress;
  const result = resolveUsageDie(kind === 'lair' ? 'lair-check' : 'domain-exit-check', die, value);
  if (!result) return progress;
  const lastCheck = { kind, placeId: place.id, die, value };
  return result.kind === 'trigger'
    ? { ...progress, [kind]: { ...place, source: 'roll' }, lastCheck }
    : { ...progress, [field]: result.next, lastCheck };
}

export function markDomainPlace(progress: DomainProgress, kind: DomainRollKind, place: DomainPlace): DomainProgress {
  if (progress[kind]) return progress;
  return { ...progress, [kind]: { ...place, source: 'map' } };
}

export function removeDomainMark(progress: DomainProgress, kind: DomainRollKind, placeId: string): DomainProgress {
  const found = progress[kind];
  if (found?.id !== placeId || found.source !== 'map' || (kind === 'lair' && progress.exit)) return progress;
  return { ...progress, [kind]: null };
}

export function activeDomainDie(progress: DomainProgress) {
  if (progress.mode === 'intro' || progress.exit) return null;
  return progress.lair ? 'exitDie' as const : 'lairDie' as const;
}

export function stepDomainDie(progress: DomainProgress, by: -1 | 1): DomainProgress {
  const field = activeDomainDie(progress);
  if (!field) return progress;
  const index = DICE_CHAIN.indexOf(progress[field]);
  const next = DICE_CHAIN[index + by];
  return next ? { ...progress, [field]: next } : progress;
}

export function domainPlaceLabel(placeId: string, placeName?: string) {
  return placeName?.trim() || `장소 ${placeId}`;
}

export function nameDomainDiscoveries(progress: DomainProgress | undefined, placeId: string, placeName: string) {
  const name = placeName.trim();
  if (!progress || !name || (progress.lair?.id !== placeId && progress.exit?.id !== placeId)) return progress;
  return { ...progress,
    lair: progress.lair?.id === placeId ? { ...progress.lair, name } : progress.lair,
    exit: progress.exit?.id === placeId ? { ...progress.exit, name } : progress.exit,
  };
}

export function introEncounterCreature(roll: number) {
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) return null;
  // Core p. 244, first-domain encounter ranges.
  return roll <= 7 ? 'cr-blightfang-rats' : roll <= 14 ? 'cr-skeletal-horrors' : 'cr-flesh-eater';
}
