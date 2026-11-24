import { createContext, useContext, useId, useState, type ReactNode } from 'react';

export const PlayFocusMode = createContext(false);

export function PlayFinishedStep({ summary, detail, children }: { summary: string | null; detail?: string; children: ReactNode }) {
  const focusMode = useContext(PlayFocusMode);
  const id = useId();
  const [reopenedSummary, setReopenedSummary] = useState<string | null>(null);
  const compact = focusMode && summary !== null;
  const expanded = reopenedSummary === summary;
  return (
    <>
      {compact && (
        <button type="button" className="play-finished-step btn ghost" aria-expanded={expanded} aria-controls={id}
          onClick={() => setReopenedSummary(expanded ? null : summary)}>
          <span><strong>{summary}</strong>{detail && <span className="play-finished-detail"> {detail}</span>}</span><span>{expanded ? '접기' : '다시 보기'}</span>
        </button>
      )}
      <div className="play-step-body" id={id} hidden={compact && !expanded}>{children}</div>
    </>
  );
}
