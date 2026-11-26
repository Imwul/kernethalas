import { useId, type ReactNode, type Ref } from 'react';

export interface Choice<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  title?: string;
}

/**
 * A short fixed list picked with one tap: small flat chips, one pressed. Used instead of a dropdown when there are
 * only a handful of options that a player changes during play. The group is named by the visible label.
 */
export function ChoiceButtons<T extends string | number>({ label, value, options, onChange, disabled, className, focusRef, hint, groupData }: {
  label: ReactNode;
  value: T | null | undefined;
  options: readonly Choice<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  /** receives the pressed button (or the first one), for code that moves focus to this choice */
  focusRef?: Ref<HTMLButtonElement>;
  hint?: ReactNode;
  /** data-* attributes for the button group (e.g. the play desk's field routing) */
  groupData?: Record<`data-${string}`, string | undefined>;
}) {
  const id = useId();
  const pressedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = pressedIndex >= 0 ? pressedIndex : 0;
  return (
    <div className={className ? `field choice-field ${className}` : 'field choice-field'}>
      <span id={`${id}-label`}>{label}</span>
      <div className="choice-buttons" role="group" aria-labelledby={`${id}-label`} aria-describedby={hint ? `${id}-hint` : undefined} {...groupData}>
        {options.map((option, index) => (
          <button key={String(option.value)} type="button" data-value={String(option.value)} aria-pressed={option.value === value}
            disabled={disabled || option.disabled} title={option.title} ref={index === focusIndex ? focusRef : undefined}
            onClick={() => { if (option.value !== value) onChange(option.value); }}>{option.label}</button>
        ))}
      </div>
      {hint && <small id={`${id}-hint`} className="choice-hint">{hint}</small>}
    </div>
  );
}
