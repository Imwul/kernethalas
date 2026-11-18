import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== 'undefined') window.addEventListener('popstate', notify);

const snapshot = () => window.location.pathname + window.location.search + window.location.hash;

export function useLocation() {
  const href = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    snapshot,
    () => '/',
  );
  const url = new URL(href, 'http://x');
  return { path: url.pathname, search: url.searchParams, hash: url.hash.slice(1), href };
}

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (to === snapshot()) return;
  const samePath = new URL(to, 'http://x').pathname === window.location.pathname;
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  notify();
  if (!opts.keepScroll && !samePath) window.scrollTo({ top: 0 });
}

export function Link({ to, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}

/** match '/ref/:id' style patterns */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const out: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      try {
        out[p[i].slice(1)] = decodeURIComponent(s[i]);
      } catch {
        return null;
      }
    } else if (p[i] !== s[i]) return null;
  }
  return out;
}
