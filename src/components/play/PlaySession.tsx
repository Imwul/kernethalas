import { useEffect, useId, useRef, useState } from 'react';
import { SESSION_INTENT_LIMIT, type SessionPause } from '../../lib/play-session';
import '../../styles/play-session.css';

export function PlaySessionPanel({ id, editing, pause, nextIntent, place, facts, onPause, onResume, onEdit, onComplete, onClose }: {
  id: string;
  editing: boolean;
  pause: SessionPause | null;
  nextIntent?: string;
  place: string;
  facts: readonly string[];
  onPause: (intent: string) => void;
  onResume: (pause: SessionPause) => void;
  onEdit: () => void;
  onComplete: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const savedIntent = pause?.intent ?? nextIntent ?? '';
  const [intent, setIntent] = useState(savedIntent);
  const input = useRef<HTMLTextAreaElement>(null);
  const resume = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!editing) return;
    setIntent(savedIntent);
    input.current?.focus({ preventScroll: true });
  }, [editing, savedIntent]);
  if (!pause && !editing) return nextIntent ? <section id={id} className="play-session-card play-session-reminder" aria-label="다음에 할 일">
    <p><strong>다음에 할 일</strong> · {nextIntent}</p>
    <button className="btn ghost" type="button" onClick={onComplete}>완료 표시</button>
  </section> : null;

  const summary = pause?.facts ?? facts;
  return <section id={id} aria-labelledby={titleId} className="play-session-card" onKeyDown={(event) => {
    if (editing && event.key === 'Escape') { event.preventDefault(); onClose(); }
  }}>
    <div className="play-session-heading">
      <div><h2 id={titleId}>{editing ? '오늘 여기까지' : '지난번 멈춘 곳'}</h2><p>{pause?.place ?? place}</p>
        {pause && !editing && <small>{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(pause.at)}</small>}
      </div>
      {!editing && pause && <div className="play-session-buttons">
        <button className="btn primary" type="button" ref={resume} onClick={() => onResume(pause)}>여기서 이어하기</button>
        <button className="btn ghost" type="button" onClick={onEdit}>메모 수정</button>
      </div>}
    </div>
    {summary.length > 0 && <ul className="play-session-facts">{summary.map((line, index) => <li key={index}>{line}</li>)}</ul>}
    {editing ? <form className="play-session-form" onSubmit={(event) => {
      event.preventDefault(); onPause(intent); requestAnimationFrame(() => resume.current?.focus({ preventScroll: true }));
    }}>
      <label className="field"><span>다음에 할 일 (선택)</span>
        <textarea ref={input} value={intent} rows={2} maxLength={SESSION_INTENT_LIMIT} placeholder="예: 북쪽 철문의 자물쇠를 딴다"
          onChange={(event) => setIntent(event.target.value)} />
      </label>
      <div className="play-session-buttons">
        <button className="btn primary" type="submit">이 지점에서 멈추기</button>
        <button className="btn ghost" type="button" onClick={onClose}>닫기</button>
      </div>
    </form> : pause && <div className="play-session-resume">
      {pause.intent && <p><strong>다음에 할 일</strong> · {pause.intent}</p>}
      {pause.point.label && <p><strong>이어갈 입력</strong> · {pause.point.label}</p>}
    </div>}
  </section>;
}
