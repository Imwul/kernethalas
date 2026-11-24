import { useId, useState, type ReactNode } from 'react';

/** A small "+ label" button that shows or hides one panel; used in place of a fold. */
export function TogglePanel({ label, badge, open, onOpenChange, defaultOpen = false, className, panelClassName, children }: {
  label: ReactNode;
  badge?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  panelClassName?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [own, setOwn] = useState(defaultOpen);
  const shown = open ?? own;
  const toggle = () => {
    if (open === undefined) setOwn(!shown);
    onOpenChange?.(!shown);
  };
  return (
    <div className={className ? `toggle-section ${className}` : 'toggle-section'}>
      <button type="button" className="toggle-btn" aria-expanded={shown} aria-controls={id} onClick={toggle}>
        <span>{label}</span>
        {badge !== undefined && badge !== null && badge !== '' && <span className="toggle-count">{badge}</span>}
      </button>
      <div id={id} className={panelClassName ? `toggle-panel ${panelClassName}` : 'toggle-panel'} hidden={!shown}>{children}</div>
    </div>
  );
}
