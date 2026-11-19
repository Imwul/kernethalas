import { useEffect, useRef, useState } from 'react';
import { usePlayDraft } from '../../lib/play-draft';
import { planRollCorrection, type PlayRollEntry } from '../../lib/play-roll-history';

const FIELD = 'input[data-play-roll-field]';
const ACTION = '[data-play-next]';
const MODE_KEY = 'kn-play-physical-first';
type Stage = PlayRollEntry['stage'];

export function usePhysicalFirst() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(MODE_KEY) === '1'; }
    catch { return false; }
  });
  const toggle = () => {
    setEnabled(!enabled);
    try { localStorage.setItem(MODE_KEY, enabled ? '0' : '1'); }
    catch { /* can still use the mode in this tab */ }
  };
  return [enabled, toggle] as const;
}

function canReach(element: HTMLElement) {
  return !element.matches(':disabled') && !element.closest('[hidden], details:not([open])')
    && element.getClientRects().length > 0;
}

function nextAction(stage: HTMLElement) {
  const field = Array.from(stage.querySelectorAll<HTMLInputElement>(`${FIELD}[data-play-roll-pending]`)).find(canReach);
  if (field) return field;
  return Array.from(stage.querySelectorAll<HTMLElement>(ACTION)).find(canReach);
}

function focusControl(control: HTMLElement) {
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: 'center', inline: 'nearest' });
}

export function focusPlayRoll(stage: Stage, field?: string) {
  requestAnimationFrame(() => {
    const section = document.getElementById(`play-stage-${stage}`);
    const input = field && Array.from(section?.querySelectorAll<HTMLInputElement>(FIELD) ?? [])
      .find((element) => element.dataset.playRollField === field && !element.matches(':disabled'));
    if (!input) {
      section?.querySelector<HTMLElement>('.play-stage-heading')?.focus();
      return;
    }
    const parents: HTMLElement[] = [];
    for (let parent = input.parentElement; parent && parent !== section; parent = parent.parentElement) parents.unshift(parent);
    for (const parent of parents) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      if (parent.hidden && parent.id) section?.querySelector<HTMLButtonElement>(`button[aria-controls="${CSS.escape(parent.id)}"]`)?.click();
    }
    requestAnimationFrame(() => {
      if (canReach(input)) focusControl(input);
      else section?.querySelector<HTMLElement>('.play-stage-heading')?.focus();
    });
  });
}

export function PlayActionBar({ stage, onHistory }: { stage: Stage; onHistory: () => void }) {
  const draft = usePlayDraft()!;
  const [target, setTarget] = useState('');
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const desk = bar?.closest<HTMLElement>('.play-desk');
    if (!bar || !desk) return;
    let frame = 0;
    const revealFocus = (event: FocusEvent) => {
      const focused = event.target;
      if (!(focused instanceof HTMLElement) || bar.contains(focused)) return;
      cancelAnimationFrame(frame);
      // Wait for the browser's own focus scrolling before checking the fixed bar.
      frame = requestAnimationFrame(() => {
        if (document.activeElement !== focused || getComputedStyle(bar).position !== 'fixed') return;
        const overlap = focused.getBoundingClientRect().bottom + 6 - bar.getBoundingClientRect().top;
        if (overlap > 0) window.scrollBy({ top: overlap });
      });
    };
    desk.addEventListener('focusin', revealFocus);
    return () => {
      desk.removeEventListener('focusin', revealFocus);
      cancelAnimationFrame(frame);
    };
  }, []);
  useEffect(() => {
    const section = document.getElementById(`play-stage-${stage}`);
    if (!section) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const action = nextAction(section);
        const label = action?.dataset.playRollLabel ?? action?.textContent?.trim();
        const die = action?.dataset.playRollDie;
        setTarget(label ? [label, die].filter(Boolean).join(' · ') : '');
      });
    };
    const observer = new MutationObserver(update);
    observer.observe(section, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['open', 'hidden', 'disabled', 'data-play-next', 'data-play-roll-pending', 'data-play-roll-die'] });
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      cancelAnimationFrame(frame);
    };
  }, [stage]);

  const jump = () => {
    const section = document.getElementById(`play-stage-${stage}`);
    const action = section && nextAction(section);
    if (action) focusControl(action);
    else focusPlayRoll(stage);
  };

  return (
    <section className="play-action-bar" aria-label="다음 행동 바로가기" ref={barRef}>
      <button className="btn ghost play-jump-roll" aria-label={target ? '다음 행동' : '현재 단계로 이동'}
        aria-describedby="play-jump-roll-target" type="button" onClick={jump}>
        <span>{target ? '다음 행동' : '현재 단계'}</span>
        <strong id="play-jump-roll-target">{target || '단계 맨 위로'}</strong>
      </button>
      <div className="play-action-bar-tools">
        <button className="btn ghost" type="button" aria-label="방금 굴림 되돌리기"
          disabled={!draft.canUndo} onClick={draft.undoRoll}>되돌리기</button>
        <button className="btn ghost" type="button" aria-label="이번 장소 굴림 이력으로 이동" onClick={onHistory}>굴림 이력</button>
      </div>
    </section>
  );
}

function recordedValue(entry: PlayRollEntry) {
  return `${entry.dice} ${entry.value}`;
}

export function PlayRollHistory({ onCorrection, paperCommitted }: {
  onCorrection: (entry: PlayRollEntry) => void;
  paperCommitted: boolean;
}) {
  const draft = usePlayDraft()!;
  const [selection, setSelection] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const review = useRef<HTMLDivElement>(null);
  const preview = selection ? planRollCorrection(draft.slots, draft.history, selection) : null;
  return (
    <section id="play-roll-history" className="play-roll-history" aria-labelledby="play-roll-log-title">
      <h3 id="play-roll-log-title" tabIndex={-1} ref={heading}>이번 장소 굴림 이력</h3>
      {draft.history.length ? (
        <ol className="play-roll-log">
          {[...draft.history].reverse().map((entry) => (
            <li key={entry.id}>
              <span><strong>{entry.label}</strong> <span>{entry.source === 'manual' ? '직접 입력' : '앱 굴림'}</span></span>
              <b>{recordedValue(entry)}</b>
              <button className="btn ghost" type="button" aria-expanded={selection === entry.id}
                aria-label={`${entry.label} ${recordedValue(entry)} 수정 미리보기`}
                onClick={() => {
                  const next = selection === entry.id ? null : entry.id;
                  setSelection(next);
                  setFailed(false);
                  if (next) requestAnimationFrame(() => {
                    review.current?.focus({ preventScroll: true });
                    review.current?.scrollIntoView({ block: 'center' });
                  });
                }}>수정</button>
            </li>
          ))}
        </ol>
      ) : <p className="play-empty">이 장소의 판정을 확인하면 굴림이 여기에 모입니다.</p>}
      {preview && (
        <div className="play-roll-correction" role="group" aria-label="굴림 수정 미리보기" ref={review} tabIndex={-1}>
          <p><strong>{preview.origin.label} {recordedValue(preview.origin)}</strong>부터 다시 입력합니다.</p>
          {preview.affected.length > 1 && <ul>
            {preview.affected.slice(1).map((entry) => <li key={entry.id}>{entry.label} {recordedValue(entry)} 다시 확인</li>)}
          </ul>}
          {paperCommitted && <p>종이 시트나 장비 장부에 옮긴 결과도 다시 대조하세요.</p>}
          {(failed || preview.conflicts.length > 0) && <p className="field-err" role="alert">
            이 굴림 뒤에 수동 변경된 결과가 있습니다{preview.conflicts.length ? ` (${preview.conflicts.join(', ')})` : ''}. 해당 도구에서 값을 확인하세요.
          </p>}
          <div className="play-action-bar-tools">
            <button className="btn primary" type="button" disabled={preview.conflicts.length > 0} onClick={() => {
              if (!draft.rewindRoll(preview.origin.id)) { setFailed(true); return; }
              setSelection(null);
              onCorrection(preview.origin);
            }}>이 굴림부터 다시 입력</button>
            <button className="btn ghost" type="button" onClick={() => { setSelection(null); heading.current?.focus(); }}>취소</button>
          </div>
        </div>
      )}
    </section>
  );
}
