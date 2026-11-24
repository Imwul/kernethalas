import { useId, useRef, useState } from 'react';
import { hrefOf } from '../content';
import { Link } from '../lib/router';
import { RULING_NOTE_MAX, saveRulingNote, searchRulingNotes, useRulingNotes } from '../lib/ruling-notes';
import '../styles/ruling-note.css';

export function RulingNote({ id }: { id: string }) {
  const inputId = useId();
  const note = useRulingNotes()[id];
  const [draft, setDraft] = useState<{ text: string; expected?: string } | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  const closeEditor = () => {
    setDraft(null);
    setError('');
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  };
  const save = (text: string) => {
    const result = saveRulingNote(id, text, draft?.expected);
    if (result === 'conflict') {
      setError('다른 화면에서 메모가 바뀌었습니다. 편집을 닫고 현재 메모를 확인하세요.');
      return;
    }
    if (result === 'invalid') {
      setError(`메모는 ${RULING_NOTE_MAX}자까지 저장할 수 있습니다.`);
      return;
    }
    closeEditor();
    setFeedback(result === 'temporary' ? '저장 공간을 사용할 수 없어 현재 탭에만 반영했습니다.'
      : text.trim() ? '이 브라우저에 메모를 저장했습니다.' : '메모를 삭제했습니다.');
  };

  const openEditor = () => {
    setDraft({ text: note ?? '', expected: note });
    setFeedback('');
    requestAnimationFrame(() => input.current?.focus());
  };

  // One line until it is used: the label, the saved note (if any) and a single button that opens the editor in place.
  return (
    <section className="ruling-note" aria-label="내 판정 메모">
      {draft ? <form className="ruling-note-form" onSubmit={(event) => { event.preventDefault(); if (draft.text.trim()) save(draft.text); }}>
        <label className="field" htmlFor={inputId}><span>내 판정</span>
          <textarea id={inputId} ref={input} rows={3} maxLength={RULING_NOTE_MAX} value={draft.text}
            onChange={(event) => setDraft({ ...draft, text: event.target.value })} />
        </label>
        {error && <p className="field-err" role="alert">{error}</p>}
        <div className="ruling-note-actions">
          <button type="submit" className="btn primary" disabled={!draft.text.trim() || draft.text.trim() === note}>메모 저장</button>
          <button type="button" className="btn ghost" onClick={closeEditor}>취소</button>
          {note && <button type="button" className="linkbtn" onClick={() => save('')}>메모 삭제</button>}
        </div>
      </form> : <div className="ruling-note-line">
        <span className="ruling-note-label" aria-hidden="true">내 판정 메모</span>
        {note && <p className="ruling-note-text">{note}</p>}
        <button type="button" className="linkbtn ruling-note-open" ref={opener} onClick={openEditor}>{note ? '메모 편집' : '메모 쓰기'}</button>
        {feedback && <p className="ruling-note-status" role="status">{feedback}</p>}
      </div>}
    </section>
  );
}

export function RulingNotesIndex() {
  const notes = useRulingNotes();
  const [query, setQuery] = useState('');
  const count = Object.keys(notes).length;
  if (!count) return null;
  const results = searchRulingNotes(notes, query);
  return (
    <details className="fold ruling-note ruling-notes-index">
      <summary>내 판정 메모 찾아보기 <span>{count}개</span></summary>
      <div className="ruling-note-body">
        <label className="field"><span>메모 검색</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 또는 내가 적은 내용" />
        </label>
        {results.length ? <ul className="ruling-notes-results" aria-label="내 판정 메모 검색 결과">
          {results.map(({ id, title, note }) => <li key={id}>
            <Link to={hrefOf(id)}>{title}</Link>
            <p className="ruling-note-text">{note}</p>
          </li>)}
        </ul> : <p className="ruling-note-status" role="status">일치하는 메모가 없습니다.</p>}
      </div>
    </details>
  );
}
