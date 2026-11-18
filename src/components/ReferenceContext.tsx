import { createContext, useContext, type AnchorHTMLAttributes } from 'react';
import { hrefOf } from '../content';
import { Link } from '../lib/router';

export type PreviewReference = (id: string, options?: { result?: number; opener?: HTMLElement; fromSearch?: boolean }) => void;

export const ReferenceContext = createContext<PreviewReference | null>(null);

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'id'> & { id: string; result?: number };

export function ContextLink({ id, result, onClick, ...props }: LinkProps) {
  const preview = useContext(ReferenceContext);
  const href = hrefOf(id);
  return (
    <Link
      {...props}
      to={result === undefined ? href : `${href}?r=${result}`}
      onClick={(event) => {
        onClick?.(event);
        if (!preview || event.defaultPrevented || props.target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        preview(id, { result, opener: event.currentTarget });
      }}
    />
  );
}
