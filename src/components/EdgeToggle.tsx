import { useId, type ReactNode } from 'react';
import type { Edge } from '../lib/dice';
import '../styles/edge-toggle.css';

const STATE: Record<Edge, string> = { none: '없음', advantage: '유리', disadvantage: '불리' };

/** Two light buttons instead of a dropdown: − toggles Disadvantage, + toggles Advantage. */
export function EdgeToggle({ value, onChange, label = '유불리' }: {
  value: Edge;
  onChange: (edge: Edge) => void;
  label?: ReactNode;
}) {
  const id = useId();
  const toggle = (edge: Exclude<Edge, 'none'>) => onChange(value === edge ? 'none' : edge);
  return (
    <div className="field edge-field">
      <span id={id} className="edge-label">{label}</span>
      <div className="edge-toggle" role="group" aria-labelledby={id} data-edge={value}>
        <button type="button" className="edge-btn edge-minus" aria-pressed={value === 'disadvantage'} title="Disadvantage"
          onClick={() => toggle('disadvantage')}><span aria-hidden="true">−</span><span className="sr-only">불리 (Disadvantage)</span></button>
        <span className="edge-state" aria-hidden="true">{STATE[value]}</span>
        <button type="button" className="edge-btn edge-plus" aria-pressed={value === 'advantage'} title="Advantage"
          onClick={() => toggle('advantage')}><span aria-hidden="true">+</span><span className="sr-only">유리 (Advantage)</span></button>
      </div>
    </div>
  );
}
