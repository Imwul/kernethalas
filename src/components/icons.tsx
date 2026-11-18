import type { SVGProps } from 'react';

const S = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width="20" height="20" className="ic" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p} />
);

export const ISearch = () => (
  <S>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="M15 15l5.5 5.5" />
  </S>
);
export const IPin = () => (
  <S>
    <path d="M9 3h6l-1 6 4 4H6l4-4z" />
    <path d="M12 13v8" />
  </S>
);
export const IClose = () => (
  <S>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);
export const IDie = () => (
  <S>
    <path d="M12 2.5l8.5 5v9L12 21.5l-8.5-5v-9z" />
    <path d="M3.5 7.5L12 12l8.5-4.5M12 12v9.5" />
  </S>
);
/** reference: a folio / bound record */
export const IRecord = () => (
  <S>
    <path d="M5 3.5h11.5a2 2 0 012 2V20.5H7a2 2 0 01-2-2z" />
    <path d="M5 18.5a2 2 0 012-2h11.5M9 7.5h6M9 10.5h6" />
  </S>
);
/** atlas: a section plan */
export const IPlan = () => (
  <S>
    <rect x="3.5" y="3.5" width="17" height="17" />
    <path d="M3.5 10h7v10.5M10.5 10V3.5M14 14h6.5M14 14v6.5" />
  </S>
);
export const IDrawer = () => (
  <S>
    <rect x="3.5" y="4" width="17" height="16" />
    <path d="M3.5 12h17M10 8h4M10 16h4" />
  </S>
);
export const IQuestion = () => (
  <S>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.4a2.5 2.5 0 114 2c-.9.6-1.6 1.1-1.6 2.3M12 17h.01" />
  </S>
);
export const IBench = () => (
  <S>
    <rect x="3" y="5" width="7.5" height="14" />
    <rect x="13.5" y="5" width="7.5" height="14" />
    <path d="M5.5 9h2.5M16 9h2.5" />
  </S>
);
export const ISun = () => (
  <S>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </S>
);
export const IMoon = () => (
  <S>
    <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
  </S>
);
export const ISystem = () => (
  <S>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5v17" />
    <path d="M12 3.5a8.5 8.5 0 010 17z" fill="currentColor" stroke="none" />
  </S>
);
export const ICopy = () => (
  <S>
    <rect x="8.5" y="8.5" width="11" height="11" />
    <path d="M15.5 8.5V4.5h-11v11h4" />
  </S>
);
export const IAddPane = () => (
  <S>
    <rect x="3.5" y="5" width="11" height="14" />
    <path d="M18.5 9v6M15.5 12h6" />
  </S>
);
export const IUp = () => (
  <S>
    <path d="M6 14l6-6 6 6" />
  </S>
);
export const IDown = () => (
  <S>
    <path d="M6 10l6 6 6-6" />
  </S>
);

/** the crest: a reliquary key / plumb line over a vault */
export const Crest = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.3} aria-hidden="true" {...p}>
    <path d="M16 2v28" />
    <path d="M9 9h14" />
    <circle cx="16" cy="19" r="6" />
    <path d="M10 19h12" strokeDasharray="1.5 2" />
    <circle cx="16" cy="19" r="1.6" fill="var(--oxblood)" stroke="none" />
    <path d="M6 30h20" />
  </svg>
);
