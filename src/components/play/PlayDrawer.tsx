import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

export const PLAY_DRAWER_ID = 'play-drawer';
export const PLAY_DRAWER_EVENT = 'play-drawer-open';

export interface DrawerTab<T extends string> {
  id: T;
  /** Short label for the desk bar and the drawer's own tabs. */
  label: string;
  /** Heading shown at the top of the open drawer. */
  title: string;
  badge?: ReactNode;
  flag?: string;
  content: ReactNode;
}

export function drawerPaneId(id: string) {
  return `${PLAY_DRAWER_ID}-${id}`;
}

/** Button content shared by the desk bar and the drawer tabs. */
export function DrawerTabLabel({ label, badge, flag }: { label: string; badge?: ReactNode; flag?: string }) {
  return <>
    <span>{label}</span>
    {badge !== undefined && badge !== null && badge !== '' && <span className="play-tray-badge">{badge}</span>}
    {flag && <span className="play-tray-flag" title={flag}><span className="sr-only">{flag}</span></span>}
  </>;
}

/**
 * The desk's side drawer. Every pane stays mounted (like the folds it replaces) so their reports
 * keep flowing; only the chosen pane is shown. Wide desks dock it in the context column, narrow
 * ones show it as a sheet over the page.
 */
export function PlayDrawer<T extends string>({ tabs, active, modal, onSelect, onClose }: {
  tabs: DrawerTab<T>[];
  active: T | null;
  modal: boolean;
  onSelect: (id: T) => void;
  onClose: () => void;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const current = tabs.find(({ id }) => id === active);
  const open = !!current;
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const element = drawer.current;
    if (!element || !open) return;
    if (modal) element.showModal();
    else element.show();
    return () => element.close();
  }, [open, modal]);
  useEffect(() => {
    if (!open || modal) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog:modal')) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('.play-popover')) return;
      event.preventDefault();
      close.current();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, modal]);
  return (
    <dialog className="play-drawer" ref={drawer} id={PLAY_DRAWER_ID} aria-labelledby={`${PLAY_DRAWER_ID}-title`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="play-drawer-head">
        <h2 id={`${PLAY_DRAWER_ID}-title`} tabIndex={-1}>{current?.title ?? '플레이 서랍'}</h2>
        <button type="button" className="btn ghost play-drawer-close" onClick={onClose} aria-label="서랍 닫기">닫기</button>
        <div className="play-drawer-tabs" role="group" aria-label="서랍 항목">
          {tabs.map(({ id, label, badge, flag }) => (
            <button key={id} type="button" aria-pressed={id === active} aria-controls={drawerPaneId(id)}
              onClick={() => onSelect(id)}><DrawerTabLabel label={label} badge={badge} flag={flag} /></button>
          ))}
        </div>
      </header>
      <div className="play-drawer-body">
        {tabs.map(({ id, content }) => (
          <div key={id} id={drawerPaneId(id)} className="play-drawer-pane" hidden={id !== active}>{content}</div>
        ))}
      </div>
    </dialog>
  );
}
