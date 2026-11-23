import { useEffect, useState } from 'react';

const KEY = 'kn-play-keep-awake-v1';

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** On by default: a paper-first desk sits beside the sheet for long stretches without a touch. */
export function useKeepAwakePreference() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(KEY) !== '0'; } catch { return true; }
  });
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* applies to this tab only */ }
  };
  return [enabled, toggle] as const;
}

/** Holds a screen wake lock while `enabled`; the browser drops it when the tab hides, so re-acquire on return. */
export function useScreenWakeLock(enabled: boolean) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled || !wakeLockSupported()) { setActive(false); return; }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) { void sentinel.release(); return; }
        setActive(true);
        sentinel.addEventListener('release', () => { if (!cancelled) setActive(false); });
      } catch {
        setActive(false);
      }
    };
    const onVisible = () => { void acquire(); };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
      setActive(false);
    };
  }, [enabled]);
  return active;
}
