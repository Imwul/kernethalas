// Whole-site backup: every campaign, checkpoint, note and preference this browser keeps.
// Mobile Safari can clear script storage after a week without a visit, so the play desk
// nudges people to keep a file copy and asks the browser to keep the data.

const FORMAT = 'kernethalas-ossuary-backup';
const VERSION = 1;
export const LAST_BACKUP_KEY = 'kn-last-backup-v1';
const UNDO_KEY = 'kn-restore-undo-v1';
const KEY_PATTERN = /^kn-[a-z0-9-]+(?::[a-z0-9-]{1,64})?$/;
// session-only keys and the backup bookkeeping never travel inside a backup file
const EXCLUDED = new Set([LAST_BACKUP_KEY, UNDO_KEY, 'kn-active-play-campaign-v1', 'kn-play-room-migrated-v1']);
export const BACKUP_MAX_BYTES = 8 * 1024 * 1024;
export const BACKUP_STALE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export interface SiteBackup {
  exportedAt: number;
  data: Record<string, string>;
}

const included = (key: string) => KEY_PATTERN.test(key) && !EXCLUDED.has(key);

function storedKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && included(key)) keys.push(key);
  }
  return keys.sort();
}

export function collectSiteData(): Record<string, string> {
  const data: Record<string, string> = {};
  try {
    for (const key of storedKeys()) {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
    }
  } catch { /* storage blocked: an empty backup */ }
  return data;
}

export function exportSiteBackup(now = Date.now()) {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: now, data: collectSiteData() });
}

export function parseSiteBackup(raw: string): SiteBackup | null {
  if (raw.length > BACKUP_MAX_BYTES) return null;
  try {
    const value = JSON.parse(raw) as { format?: unknown; version?: unknown; exportedAt?: unknown; data?: unknown } | null;
    if (!value || value.format !== FORMAT || value.version !== VERSION) return null;
    if (typeof value.exportedAt !== 'number' || !Number.isFinite(value.exportedAt)) return null;
    if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) return null;
    const data: Record<string, string> = {};
    for (const [key, entry] of Object.entries(value.data as Record<string, unknown>)) {
      if (!included(key) || typeof entry !== 'string') return null;
      data[key] = entry;
    }
    return { exportedAt: value.exportedAt, data };
  } catch {
    return null;
  }
}

/** Counts shown before a restore so people know what the file holds. */
export function describeSiteBackup(data: Record<string, string>) {
  let campaigns = 1;
  let checkpoints = 0;
  try {
    const registry = JSON.parse(data['kn-play-campaigns-v1'] ?? 'null') as { campaigns?: unknown[] } | null;
    if (Array.isArray(registry?.campaigns)) campaigns = Math.max(1, registry.campaigns.length);
  } catch { /* keep the default campaign count */ }
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith('kn-play-checkpoints-v1')) continue;
    try {
      const list = JSON.parse(value) as unknown;
      if (Array.isArray(list)) checkpoints += list.length;
    } catch { /* unreadable list counts as none */ }
  }
  return { campaigns, checkpoints, keys: Object.keys(data).length };
}

/** Replace this browser's data with the backup; the previous data waits in this tab for one undo. */
export function restoreSiteBackup(backup: SiteBackup): { ok: true } | { ok: false; reason: 'undo' | 'write' } {
  const previous = collectSiteData();
  try {
    sessionStorage.setItem(UNDO_KEY, JSON.stringify(previous));
  } catch {
    return { ok: false, reason: 'undo' };
  }
  try {
    replaceData(backup.data);
    return { ok: true };
  } catch {
    try { replaceData(previous); } catch { /* best effort */ }
    try { sessionStorage.removeItem(UNDO_KEY); } catch { /* nothing to undo */ }
    return { ok: false, reason: 'write' };
  }
}

function replaceData(data: Record<string, string>) {
  for (const key of storedKeys()) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(data)) localStorage.setItem(key, value);
}

export function hasRestoreUndo() {
  try { return sessionStorage.getItem(UNDO_KEY) !== null; } catch { return false; }
}

export function undoSiteRestore() {
  try {
    const raw = sessionStorage.getItem(UNDO_KEY);
    if (raw === null) return false;
    const previous = JSON.parse(raw) as Record<string, string>;
    replaceData(Object.fromEntries(Object.entries(previous).filter(([key, value]) => included(key) && typeof value === 'string')));
    sessionStorage.removeItem(UNDO_KEY);
    return true;
  } catch {
    return false;
  }
}

export function dismissRestoreUndo() {
  try { sessionStorage.removeItem(UNDO_KEY); } catch { /* nothing kept */ }
}

export function readLastBackup(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_BACKUP_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function markBackup(now = Date.now()) {
  try { localStorage.setItem(LAST_BACKUP_KEY, String(now)); } catch { /* the reminder just stays */ }
}

export function backupIsStale(last: number | null, now = Date.now()) {
  return last === null || now - last > BACKUP_STALE_DAYS * DAY;
}

export function backupAgeLabel(last: number | null, now = Date.now()) {
  if (last === null) return '전체 백업 기록 없음';
  const days = Math.floor((now - last) / DAY);
  if (days <= 0) return '오늘 전체 백업';
  return `${days}일 전 전체 백업`;
}

export function backupFileName(now = Date.now()) {
  const date = new Date(now);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `kernethalas-backup-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.json`;
}

/** Ask the browser to keep this site's storage. Only called from a click so Firefox may prompt then. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageIsPersistent(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}
