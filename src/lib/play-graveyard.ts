import { campaignStorageKey } from './play-campaigns';

/** Survivors who died in this campaign, newest first. Kept on the device and in the full-site backup. */
export type FallenSurvivor = {
  id: string;
  name: string;
  level: number;
  cause: string;
  masteries: string[];
  goalsDone: string[];
  places: number;
  domains: number;
  date: string;
};

const KEY = 'kn-play-graveyard-v1';

function isFallen(value: unknown): value is FallenSurvivor {
  if (!value || typeof value !== 'object') return false;
  const item = value as FallenSurvivor;
  return typeof item.id === 'string' && typeof item.name === 'string' && Number.isSafeInteger(item.level)
    && typeof item.cause === 'string' && Array.isArray(item.masteries) && item.masteries.every((id) => typeof id === 'string')
    && Array.isArray(item.goalsDone) && item.goalsDone.every((goal) => typeof goal === 'string')
    && Number.isSafeInteger(item.places) && Number.isSafeInteger(item.domains) && typeof item.date === 'string';
}

export function readGraveyard(campaignId?: string): FallenSurvivor[] {
  try {
    const data = JSON.parse(localStorage.getItem(campaignStorageKey(KEY, campaignId)) ?? '[]') as unknown;
    return Array.isArray(data) ? data.filter(isFallen).slice(0, 200) : [];
  } catch { return []; }
}

export function storeGraveyard(list: FallenSurvivor[], campaignId?: string) {
  try { localStorage.setItem(campaignStorageKey(KEY, campaignId), JSON.stringify(list.slice(0, 200))); return true; }
  catch { return false; }
}
