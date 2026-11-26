import '../styles/status-icon.css';

export type StatusKind = 'bleeding' | 'poisoned' | 'burning' | 'exhaustion' | 'sanity' | 'madness' | 'level' | 'death';

const PATHS: Record<StatusKind, string> = {
  bleeding: 'M8 1.2C6.2 4 3.4 6.9 3.4 9.9a4.6 4.6 0 0 0 9.2 0C12.6 6.9 9.8 4 8 1.2z',
  poisoned: 'M6.2 1.5h3.6v1.2h-.7v3l3.7 6.2a1.7 1.7 0 0 1-1.5 2.6H4.7a1.7 1.7 0 0 1-1.5-2.6l3.7-6.2v-3h-.7zM6 10.2a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm3.6-.9a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z',
  burning: 'M8.4 1c.4 2.6 3.9 4.3 3.9 8.3A4.3 4.3 0 0 1 3.7 9.6c0-2 1.1-3.3 2.2-4.1-.1 1.6.6 2.7 1.5 3.1C7 6.4 7.3 3.6 8.4 1z',
  exhaustion: 'M4 1.5h8v1.4c0 2-1.4 3.4-2.8 5.1 1.4 1.7 2.8 3.1 2.8 5.1v1.4H4v-1.4c0-2 1.4-3.4 2.8-5.1C5.4 6.3 4 4.9 4 2.9zm1.6 11.3h4.8c-.3-1.1-1.3-2.1-2.4-3.2-1.1 1.1-2.1 2.1-2.4 3.2z',
  sanity: 'M8 3.5C4.6 3.5 2.2 6 1 8c1.2 2 3.6 4.5 7 4.5s5.8-2.5 7-4.5c-1.2-2-3.6-4.5-7-4.5zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  madness: 'M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm0 1.8c.8 1.3.2 2.5-.9 3.3l1.7 1.6-1.9 1.9 1.4 2.4-1 .4-1.6-2.9 1.7-1.7-1.9-1.8C6.9 4.8 7.6 4 8 3.3z',
  level: 'M8 2l5.2 5.6H10v6.4H6V7.6H2.8z',
  death: 'M8 1.5c-3.3 0-5.5 2.3-5.5 5.4 0 1.9.9 3.2 2 3.9v2.7h2v-1.5h1v1.5h1v-1.5h1v1.5h2v-2.7c1.1-.7 2-2 2-3.9 0-3.1-2.2-5.4-5.5-5.4zM5.7 6.5a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6zm4.6 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6z',
};

/** A small coloured glyph for a status, always beside its text label (colour is never the only cue). */
export function StatusIcon({ kind, size = 16 }: { kind: StatusKind; size?: number }) {
  return (
    <svg className={`status-icon is-${kind}`} viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" focusable="false">
      <path d={PATHS[kind]} fillRule="evenodd" />
    </svg>
  );
}
