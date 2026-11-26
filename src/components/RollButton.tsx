import type { ButtonHTMLAttributes } from 'react';
import { IDie } from './icons';

/**
 * The one look for "let the app roll": a standard outlined button with the die icon.
 * Typed-value confirm buttons stay ghost, and the red primary is kept for the action that records or moves play on.
 */
export function RollButton({ className, children = '굴리기', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={className ? `btn roll ${className}` : 'btn roll'} {...props}>
      <IDie />
      {children}
    </button>
  );
}
