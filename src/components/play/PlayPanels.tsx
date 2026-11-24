import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Small controls that replace stacked folds on the play desk: a strip of buttons that shows one
 * pane at a time under it, and a popover for settings that rarely change.
 */

export interface StripItem<T extends string> {
  id: T;
  label: ReactNode;
  /** Short note after the label, such as a round number or a count. */
  badge?: ReactNode;
  /** Optional marker for the next expected step. */
  next?: boolean;
}

export function stripPaneId(prefix: string, id: string) {
  return `${prefix}-${id}`;
}

/** Buttons that open one pane at a time; pressing the open one closes it. */
export function PlayStrip<T extends string>({ label, items, value, onChange, prefix, className = '' }: {
  label: string;
  items: StripItem<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  prefix: string;
  className?: string;
}) {
  return (
    <div className={`play-strip ${className}`.trim()} role="group" aria-label={label}>
      {items.map(({ id, label: text, badge, next }) => (
        <button key={id} type="button" aria-expanded={value === id} aria-controls={stripPaneId(prefix, id)}
          data-play-next={next && value !== id ? '' : undefined}
          onClick={() => onChange(value === id ? null : id)}>
          <span>{text}</span>{badge !== undefined && badge !== null && badge !== '' && <span className="play-strip-badge">{badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function PlayStripPane({ prefix, id, open, children, className = '' }: {
  prefix: string;
  id: string;
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return <div className={`play-strip-pane ${className}`.trim()} id={stripPaneId(prefix, id)} hidden={!open}>{children}</div>;
}

/** A button that opens a small floating panel; closes on Escape or a press outside. */
export function PlayPopover({ trigger, label, bodyLabel, children, className = '', align = 'start', open: controlled, onOpenChange }: {
  trigger: ReactNode;
  label: string;
  /** Names the floating panel as a group when it holds a set of related switches. */
  bodyLabel?: string;
  children: ReactNode;
  className?: string;
  align?: 'start' | 'end';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const id = useId();
  const [local, setLocal] = useState(false);
  const open = controlled ?? local;
  const setOpen = (next: boolean) => {
    if (controlled === undefined) setLocal(next);
    onOpenChange?.(next);
  };
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const latest = useRef(setOpen);
  latest.current = setOpen;
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) latest.current(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      latest.current(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className={`play-popover ${className}`.trim()} ref={root} data-align={align}>
      <button type="button" className="play-popover-trigger" ref={button} aria-expanded={open} aria-controls={id}
        aria-label={label} onClick={() => setOpen(!open)}>{trigger}</button>
      <div className="play-popover-body" id={id} role={bodyLabel ? 'group' : undefined} aria-label={bodyLabel} hidden={!open}>{children}</div>
    </div>
  );
}
