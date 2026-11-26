import { useEffect, useRef, useState } from 'react';
import { usePlayDraft } from '../../lib/play-draft';
import { planRollCorrection, type PlayRollEntry } from '../../lib/play-roll-history';
import { shortSessionText, type SessionPoint } from '../../lib/play-session';
import { PLAY_DRAWER_EVENT, PLAY_DRAWER_ID } from './PlayDrawer';

const FIELD = 'input[data-play-roll-field]';
const ACTION = '[data-play-next]';
type Stage = PlayRollEntry['stage'];

export function usePhysicalFirst() {
  return usePlayPreference('kn-play-physical-first');
}

export function usePlayPreference(key: string, defaultOn = false) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? defaultOn : stored === '1';
    } catch { return defaultOn; }
  });
  const toggle = () => {
    setEnabled(!enabled);
    try { localStorage.setItem(key, enabled ? '0' : '1'); }
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

export function readPlaySessionPoint(stage: Stage, previousField?: string): SessionPoint {
  const section = document.getElementById(`play-stage-${stage}`);
  if (!section) return { stage };
  const previous = previousField ? findRollField(section, previousField) : undefined;
  const action = previous?.matches('[data-play-roll-pending]') && canReach(previous) ? previous : nextAction(section);
  const label = action?.dataset.playRollLabel ?? action?.textContent?.trim();
  return { stage, ...(action?.dataset.playRollField ? { field: action.dataset.playRollField } : {}),
    ...(label ? { label: shortSessionText(label, 90) } : {}) };
}

function focusControl(control: HTMLElement) {
  control.focus({ preventScroll: true });
  control.scrollIntoView({ block: 'center', inline: 'nearest' });
}

function findRollField(root: HTMLElement | null, field: string) {
  return Array.from(root?.querySelectorAll<HTMLElement>(FIELD) ?? [])
    .find((element) => element.dataset.playRollField === field && !element.matches(':disabled'))
    ?? root?.querySelector<HTMLElement>(`select[data-play-attack-field="${CSS.escape(field)}"]:not(:disabled)`) ?? undefined;
}

export function focusPlayRoll(stage: Stage, field?: string, onResult?: (focused: boolean) => void) {
  const reveal = () => {
    const stageSection = document.getElementById(`play-stage-${stage}`);
    // Rolls made in the side drawer (domain dice, gear) are recorded under whichever stage was open.
    const drawer = document.getElementById(PLAY_DRAWER_ID);
    const stageInput = field ? findRollField(stageSection, field) : undefined;
    const drawerInput = field && !stageInput ? findRollField(drawer, field) : undefined;
    const section = drawerInput ? drawer : stageSection;
    const input = stageInput ?? drawerInput;
    if (drawerInput) {
      const pane = drawerInput.closest<HTMLElement>('.play-drawer-pane');
      if (pane) document.dispatchEvent(new CustomEvent(PLAY_DRAWER_EVENT, { detail: pane.id }));
    }
    if (!input) {
      section?.querySelector<HTMLElement>('.play-stage-heading')?.focus();
      onResult?.(false);
      return;
    }
    const parents: HTMLElement[] = [];
    for (let parent = input.parentElement; parent && parent !== section; parent = parent.parentElement) parents.unshift(parent);
    for (const parent of parents) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      if (parent.hidden && parent.id && !parent.classList.contains('play-drawer-pane')) {
        section?.querySelector<HTMLButtonElement>(`button[aria-controls="${CSS.escape(parent.id)}"]`)?.click();
      }
    }
    // Two frames: the drawer pane opens through React state before the field can take focus.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (canReach(input)) focusControl(input);
      else stageSection?.querySelector<HTMLElement>('.play-stage-heading')?.focus();
      onResult?.(document.activeElement === input);
    }));
  };
  requestAnimationFrame(() => {
    const target = field?.match(/^combat\/[^/]+\/target-([^/]+)\//)?.[1];
    if (!target) { reveal(); return; }
    const section = document.getElementById(`play-stage-${stage}`);
    const switchTo = (attribute: 'data-play-combat-target' | 'data-play-attack-side', value: string) => {
      const button = section?.querySelector<HTMLButtonElement>(`button[${attribute}="${CSS.escape(value)}"]`);
      if (!button || button.getAttribute('aria-pressed') === 'true') return false;
      button.click();
      return true;
    };
    const revealAttackSide = () => {
      const side = field?.match(/\/attack:(pc-attack|enemy-attack)$/)?.[1]
        ?? field?.match(/\/attack-follow-up:(pc|enemy):/)?.[1]?.concat('-attack');
      if (side && switchTo('data-play-attack-side', side)) requestAnimationFrame(reveal);
      else reveal();
    };
    if (switchTo('data-play-combat-target', target)) requestAnimationFrame(revealAttackSide);
    else revealAttackSide();
  });
}

export function focusNextPlayAction(stage: Stage) {
  const section = document.getElementById(`play-stage-${stage}`);
  const action = section && nextAction(section);
  if (action) focusControl(action);
  else focusPlayRoll(stage);
}

export function PlayActionBar({ stage, onHistory }: { stage: Stage; onHistory: () => void }) {
  const draft = usePlayDraft()!;
  const [target, setTarget] = useState<{ label: string; die?: string } | null>(null);
  const barRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = barRef.current;
    const desk = bar?.closest<HTMLElement>('.play-desk');
    if (!bar || !desk) return;
    let frame = 0;
    let pressing = false;
    const pointerDown = () => { pressing = true; };
    const pointerDone = () => { pressing = false; };
    const revealFocus = (event: FocusEvent) => {
      const focused = event.target;
      // A pointer target has already been placed under the pointer. Moving it before pointerup can swallow the click.
      if (pressing || !(focused instanceof HTMLElement) || bar.contains(focused) || focused.closest('dialog:modal')) return;
      cancelAnimationFrame(frame);
      // Wait for the browser's own focus scrolling before checking the fixed bar.
      frame = requestAnimationFrame(() => {
        if (document.activeElement !== focused || !bar.getClientRects().length || getComputedStyle(bar).position !== 'fixed') return;
        const bounds = focused.getBoundingClientRect();
        let limit = bar.getBoundingClientRect().top;
        const journalFooter = focused.closest('.play-journal')?.querySelector('.play-journal-advance');
        if (journalFooter && !journalFooter.contains(focused)) limit = Math.min(limit, journalFooter.getBoundingClientRect().top);
        const overlap = bounds.bottom + 6 - limit;
        if (overlap > 0) window.scrollBy({ top: overlap });
      });
    };
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('pointerup', pointerDone, true);
    document.addEventListener('pointercancel', pointerDone, true);
    document.addEventListener('focusin', revealFocus);
    return () => {
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('pointerup', pointerDone, true);
      document.removeEventListener('pointercancel', pointerDone, true);
      document.removeEventListener('focusin', revealFocus);
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
        setTarget(label ? { label, die: die || undefined } : null);
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

  const jump = () => focusNextPlayAction(stage);

  // Hardware keyboards (iPad, laptop): N jumps to the next action, U undoes the last roll.
  const shortcuts = useRef({ jump, undo: draft.undoRoll, canUndo: draft.canUndo });
  shortcuts.current = { jump, undo: draft.undoRoll, canUndo: draft.canUndo };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog:modal')) return;
      const key = event.key.toLowerCase();
      if (key === 'n') { event.preventDefault(); shortcuts.current.jump(); }
      else if (key === 'u' && shortcuts.current.canUndo) { event.preventDefault(); shortcuts.current.undo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <section className="play-action-bar" aria-label="다음 행동 바로가기" ref={barRef}>
      <button className="btn ghost play-jump-roll" aria-label={target ? '다음 행동' : '현재 단계로 이동'}
        aria-keyshortcuts="N" title="단축키 N"
        aria-describedby="play-jump-roll-target" type="button" onClick={jump}>
        <span>{target ? '다음 행동' : '현재 단계'}</span>
        <strong id="play-jump-roll-target">
          {target ? target.label : '단계 맨 위로'}
          {target?.die && <> <span className="play-jump-die"><span className="sr-only">· </span>{target.die}</span></>}
        </strong>
      </button>
      <div className="play-action-bar-tools">
        <button className="btn ghost" type="button" aria-label="직전 굴림 되돌리기" aria-keyshortcuts="U" title="단축키 U"
          disabled={!draft.canUndo} onClick={draft.undoRoll}>되돌리기</button>
        <button className="btn ghost" type="button" aria-label="이번 장소 굴림 이력으로 이동" onClick={onHistory}>굴림 이력</button>
      </div>
    </section>
  );
}

function recordedValue(entry: PlayRollEntry) {
  return entry.action ? '' : `${entry.dice} ${entry.value}`;
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
      <h3 id="play-roll-log-title" className="sr-only" tabIndex={-1} ref={heading}>이번 장소 굴림 이력</h3>
      {draft.history.length ? (
        <ol className="play-roll-log">
          {[...draft.history].reverse().map((entry) => (
            <li key={entry.id}>
              <span><strong>{entry.label}</strong> <span>{entry.action ? '상태 기록' : entry.source === 'manual' ? '직접 입력' : '앱 굴림'}</span>
                {entry.breakdown && <small className="play-skill-total">{entry.breakdown}</small>}
              </span>
              <b>{recordedValue(entry)}</b>
              <button className="btn ghost" type="button" aria-expanded={selection === entry.id}
                aria-label={[entry.label, entry.action ? '' : recordedValue(entry), '수정 미리보기'].filter(Boolean).join(' ')}
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
          <p><strong>{preview.origin.label} {recordedValue(preview.origin)}</strong>부터 {preview.origin.action ? '다시 확인합니다.' : '다시 입력합니다.'}</p>
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
            }}>{preview.origin.action ? '이 기록부터 되돌리기' : '이 굴림부터 다시 입력'}</button>
            <button className="btn ghost" type="button" onClick={() => { setSelection(null); heading.current?.focus(); }}>취소</button>
          </div>
        </div>
      )}
    </section>
  );
}
