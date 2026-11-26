import { createContext, useContext, useSyncExternalStore } from 'react';
import { PAPER_MAP_SLOT, paperMapKey } from './paper-map';

export const DEFAULT_PLAY_CAMPAIGN = 'default';
export const PLAY_CAMPAIGN_PARAM = 'campaign';
export const PLAY_ROOM_STORAGE_KEY = 'kn-play-room-v1';
export const CAMPAIGN_NAME_MAX = 56;

const REGISTRY_KEY = 'kn-play-campaigns-v1';
const TAB_KEY = 'kn-active-play-campaign-v1';
const MIGRATION_KEY = 'kn-play-room-migrated-v1';
const LEGACY_SHARED_KEYS = ['kn-play-gear-v1', 'kn-play-custom-encounters-v2', 'kn-play-custom-encounters-v1', 'kn-play-checkpoints-v1'];

export interface PlayCampaign {
  id: string;
  name: string;
  playedAt: number;
  needsCharacterSetup?: true;
}

interface Registry {
  campaigns: PlayCampaign[];
  last: string | null;
}

const BASE: Registry = { campaigns: [{ id: DEFAULT_PLAY_CAMPAIGN, name: '기본 캠페인', playedAt: 0 }], last: null };
let registry: Registry | undefined;
let temporary = false;
let tabCampaign: string | null = null;
const listeners = new Set<() => void>();

export const PlayCampaignContext = createContext(DEFAULT_PLAY_CAMPAIGN);
export const usePlayCampaignId = () => useContext(PlayCampaignContext);

const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-z0-9-]{1,64}$/.test(id);
const cleanName = (name: string) => name.normalize('NFC').trim();

export function campaignStorageKey(key: string, campaignId = DEFAULT_PLAY_CAMPAIGN) {
  return campaignId === DEFAULT_PLAY_CAMPAIGN ? key : `${key}:${campaignId}`;
}

export function campaignHref(campaignId: string, search?: URLSearchParams) {
  const params = new URLSearchParams(search);
  params.set(PLAY_CAMPAIGN_PARAM, campaignId);
  return `/play?${params.toString()}`;
}

function readRegistry(): Registry {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return BASE;
    const value = JSON.parse(raw) as Partial<Registry> | null;
    const seen = new Set<string>();
    const campaigns = (Array.isArray(value?.campaigns) ? value.campaigns : []).flatMap((item) => {
      if (!item || !validId(item.id) || seen.has(item.id) || typeof item.name !== 'string'
        || !item.name.trim() || item.name.length > CAMPAIGN_NAME_MAX || !Number.isFinite(item.playedAt)) return [];
      seen.add(item.id);
      return [{ id: item.id, name: item.name, playedAt: item.playedAt,
        ...(item.needsCharacterSetup === true ? { needsCharacterSetup: true as const } : {}) }];
    });
    if (!seen.has(DEFAULT_PLAY_CAMPAIGN)) campaigns.unshift(BASE.campaigns[0]);
    return { campaigns, last: campaigns.some(({ id }) => id === value?.last) ? value!.last! : null };
  } catch { return BASE; }
}

const snapshot = () => registry ??= readRegistry();

function publish(next: Registry) {
  registry = next;
  listeners.forEach((listener) => listener());
}

function updateRegistry(change: (current: Registry) => Registry) {
  const current = temporary ? snapshot() : readRegistry();
  const next = change(current);
  if (next === current) return temporary;
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(next));
    temporary = false;
  } catch { temporary = true; }
  publish(next);
  return temporary;
}

function onStorage(event: StorageEvent) {
  if (!temporary && (event.key === REGISTRY_KEY || event.key === null)) publish(readRegistry());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('storage', onStorage);
    if (!temporary) publish(readRegistry());
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener('storage', onStorage);
  };
}

export const usePlayCampaigns = () => useSyncExternalStore(subscribe, snapshot, () => BASE);

export function readTabCampaign() {
  try { return tabCampaign ?? sessionStorage.getItem(TAB_KEY); }
  catch { return tabCampaign; }
}

export function activateCampaign(id: string) {
  tabCampaign = id;
  try { sessionStorage.setItem(TAB_KEY, id); }
  catch { /* preserve active selection in memory */ }
  return updateRegistry((current) => ({ last: id, campaigns: current.campaigns.map((campaign) =>
    campaign.id === id ? { ...campaign, playedAt: Date.now() } : campaign) }));
}

export function saveCampaignName(raw: string, id?: string): { error: string } | { id: string; temporary: boolean } {
  const name = cleanName(raw);
  if (!name || name.length > CAMPAIGN_NAME_MAX) return { error: `캠페인 이름을 ${CAMPAIGN_NAME_MAX}자 이내로 입력하세요.` };
  const chosen = id ?? crypto.randomUUID();
  let duplicate = false;
  const inMemory = updateRegistry((current) => {
    if (current.campaigns.some((campaign) => campaign.id !== chosen && campaign.name === name)) {
      duplicate = true;
      return current;
    }
    return { ...current, campaigns: id
      ? current.campaigns.map((campaign) => campaign.id === chosen ? { ...campaign, name } : campaign)
      : [...current.campaigns, { id: chosen, name, playedAt: 0, needsCharacterSetup: true }] };
  });
  return duplicate ? { error: '같은 이름의 캠페인이 있습니다.' } : { id: chosen, temporary: inMemory };
}

export function finishCampaignCharacterSetup(id: string) {
  return updateRegistry((current) => ({ ...current, campaigns: current.campaigns.map((campaign) => {
    if (campaign.id !== id || !campaign.needsCharacterSetup) return campaign;
    const { needsCharacterSetup: _, ...ready } = campaign;
    return ready;
  }) }));
}

function roomSlots(raw: string | null) {
  try {
    const { slots } = JSON.parse(raw ?? 'null') ?? {};
    return slots && typeof slots === 'object' && !Array.isArray(slots) ? slots as Record<string, unknown> : null;
  } catch { return null; }
}

export function recoverLegacyPlayTab() {
  try {
    if (sessionStorage.getItem(MIGRATION_KEY)) return;
    const before = sessionStorage.getItem(PLAY_ROOM_STORAGE_KEY);
    if (before && roomSlots(before)) {
      const saved = localStorage.getItem(PLAY_ROOM_STORAGE_KEY);
      if (!roomSlots(saved)) localStorage.setItem(PLAY_ROOM_STORAGE_KEY, before);
      else if (before !== saved) {
        const id = crypto.randomUUID();
        const keys = [[PLAY_ROOM_STORAGE_KEY, before], ...LEGACY_SHARED_KEYS.flatMap((key) => {
          const value = localStorage.getItem(key);
          return value === null ? [] : [[key, value]];
        })];
        for (const [key, value] of keys) localStorage.setItem(campaignStorageKey(key, id), value);
        updateRegistry((current) => {
          const names = new Set(current.campaigns.map(({ name }) => name));
          let number = 1;
          while (names.has(`이전 탭 복구 ${number}`)) number++;
          return { ...current, campaigns: [...current.campaigns, { id, name: `이전 탭 복구 ${number}`, playedAt: 0 }] };
        });
        activateCampaign(id);
      }
    }
    sessionStorage.setItem(MIGRATION_KEY, '1');
  } catch { /* the original tab draft remains available */ }
}

export function campaignSummary(id: string) {
  try {
    const key = campaignStorageKey(PLAY_ROOM_STORAGE_KEY, id);
    const slots = roomSlots(localStorage.getItem(key)) ?? roomSlots(sessionStorage.getItem(key));
    if (!slots) return '';
    const paperMap = slots[PAPER_MAP_SLOT];
    const paperKey = slots['explore/paper-map-key'];
    const domainId = typeof slots.domainId === 'number' ? slots.domainId : 1;
    const paperId = Array.isArray(paperMap) && typeof paperKey === 'string' && paperKey
      ? paperMap.find((entry) => entry?.domainId === domainId && typeof entry.paperId === 'string'
        && paperMapKey(entry.paperId) === paperKey)?.paperId.trim() : '';
    const place = (typeof slots.placeName === 'string' && slots.placeName.trim()) || paperId
      || `장소 ${typeof slots.roomNumber === 'number' ? slots.roomNumber : 1}`;
    const stage = { explore: '탐험', combat: '조우·전투', wrapup: '휴식·정리', journal: '저널' };
    const label = typeof slots.active === 'string' && Object.hasOwn(stage, slots.active) ? stage[slots.active as keyof typeof stage] : stage.explore;
    return `${place} · ${label}`;
  } catch { return ''; }
}
