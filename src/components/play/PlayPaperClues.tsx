import { useEffect, useRef, useState } from 'react';
import type { EncounterPlace } from '../../content/tables/exploration';
import { paperMapKey, type PaperMapLocation } from '../../lib/paper-map';
import { usePlayDraft } from '../../lib/play-draft';
import {
  cluesAtLocation, mapClueSourceChanged, MAP_CLUE_LIMIT, MAP_CLUE_SOURCES, MAP_CLUE_STATUSES, MAP_CLUE_TEXT_LIMIT,
  type MapClueCapture, type MapClueStatus, type PaperMapClue,
} from '../../lib/paper-map-clues';
import '../../styles/play-paper-clues.css';

type Draft = Omit<PaperMapClue, 'id' | 'relatedPaperId'> & { id?: string; relatedPaperId: string };
const EMPTY_CLUE: Draft = { text: '', source: 'note', status: 'hypothesis', relatedPaperId: '' };
type LocatedClue = ReturnType<typeof cluesAtLocation>[number];

function ClueDetails({ clue, origin, incoming }: LocatedClue) {
  const sourceChanged = mapClueSourceChanged(clue, usePlayDraft()?.slots);
  return <div className="play-clue-detail">
    <div className="play-clue-meta">
      <strong data-hypothesis={clue.status === 'hypothesis' || undefined}>{MAP_CLUE_STATUSES[clue.status]}</strong>
      <span>{MAP_CLUE_SOURCES[clue.source]}</span>
      {incoming ? <span>{origin.paperId}에서 연결</span> : clue.relatedPaperId && <span>연결 장소 {clue.relatedPaperId}</span>}
    </div>
    {sourceChanged && <p className="play-clue-source-changed">원본 굴림 변경됨 · 재확인 필요</p>}
    <p>{clue.text}</p>
  </div>;
}

export function PlayClueBrief({ active, locations, onOpen }: {
  active: PaperMapLocation;
  locations: readonly PaperMapLocation[];
  onOpen: () => void;
}) {
  const clues = cluesAtLocation(active, locations);
  if (!clues.length) return null;
  const linked = clues.find(({ incoming, clue }) => incoming || clue.relatedPaperId);
  const visible = linked ? [linked, ...clues.filter((item) => item !== linked)].slice(0, 2) : clues.slice(0, 2);
  return <section className="play-clue-brief" aria-label="재방문 단서">
    <h3>{active.paperId} 재방문 단서</h3>
    <ul className="play-clue-list">
      {visible.map((item) => <li key={`${item.origin.paperId}/${item.clue.id}`}><ClueDetails {...item} /></li>)}
    </ul>
    <button type="button" className="linkbtn" onClick={onOpen}>단서 {clues.length}개 보기</button>
  </section>;
}

export function PlayPaperClues({ area, domainId, active, locations, capture, onCaptureHandled, onSave }: {
  area: EncounterPlace | null;
  domainId: number;
  active?: PaperMapLocation;
  locations: readonly PaperMapLocation[];
  capture: MapClueCapture | null;
  onCaptureHandled: () => void;
  onSave: (record: PaperMapLocation) => void;
}) {
  const [paperId, setPaperId] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY_CLUE);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const locationInput = useRef<HTMLInputElement>(null);
  const slots = usePlayDraft()?.slots;
  const chosenId = active?.paperId ?? paperId.trim();
  const chosenKey = paperMapKey(chosenId);
  const clues = active ? cluesAtLocation(active, locations) : [];
  const edit = active?.clues?.find(({ id }) => id === draft.id);
  const tooMany = !edit && (active?.clues?.length ?? 0) >= MAP_CLUE_LIMIT;

  useEffect(() => {
    if (!capture) return;
    setDraft({ ...capture, status: 'confirmed', relatedPaperId: '' });
    setRemoving(false);
    setFeedback('');
    setError('');
    onCaptureHandled();
    requestAnimationFrame(() => (locationInput.current ?? textInput.current)?.focus());
  }, [capture, onCaptureHandled]);

  const clear = () => { setDraft(EMPTY_CLUE); setRemoving(false); setError(''); };
  const change = (patch: Partial<Draft>) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setFeedback('');
    setError('');
    setRemoving(false);
  };

  if (!area) return <p className="play-explore-note">먼저 현재 방이나 통로를 선택하세요.</p>;
  return <section className="play-explore-action-body play-paper-clues" aria-label="종이 지도 단서">
    {active && <h4>{active.paperId} 단서</h4>}
    <form className="play-clue-form" aria-label={edit ? '단서 편집' : '새 단서'} onSubmit={(event) => {
      event.preventDefault();
      const text = draft.text.trim();
      if (!chosenId || !text || tooMany) return;
      const saved = active ?? locations.find(({ paperId }) => paperMapKey(paperId) === chosenKey);
      if (saved?.area && saved.area !== area) {
        setError('그 지도 번호는 다른 종류의 장소에 사용 중입니다. 현재 지도 번호를 확인하세요.');
        return;
      }
      const previous = saved?.clues ?? [];
      if (!edit && previous.length >= MAP_CLUE_LIMIT) {
        setError(`한 장소에 단서는 ${MAP_CLUE_LIMIT}개까지 저장할 수 있습니다.`);
        return;
      }
      const related = locations.find(({ paperId }) => paperMapKey(paperId) === paperMapKey(draft.relatedPaperId)
        && paperMapKey(paperId) !== chosenKey);
      const clue: PaperMapClue = { id: edit?.id ?? crypto.randomUUID(), text, source: draft.source, status: draft.status,
        ...(related ? { relatedPaperId: related.paperId } : {}), ...(draft.provenance ? { provenance: draft.provenance } : {}) };
      onSave({ ...(saved ?? { domainId, paperId: chosenId, area, note: '', tags: [] }),
        clues: edit ? previous.map((item) => item.id === edit.id ? clue : item) : [...previous, clue] });
      clear();
      setFeedback(`${chosenId}에 단서를 저장했습니다.`);
    }}>
      {!active && <label className="field"><span>단서를 남길 지도 번호</span>
        <input ref={locationInput} value={paperId} maxLength={32} autoComplete="off" placeholder="예: B-07"
          onChange={(event) => { setPaperId(event.target.value); setError(''); }} />
      </label>}
      <label className="field play-clue-text"><span>단서 내용{draft.source !== 'note' ? ` · ${MAP_CLUE_SOURCES[draft.source]}` : ''}</span>
        <textarea ref={textInput} value={draft.text} rows={3} maxLength={MAP_CLUE_TEXT_LIMIT}
          onChange={(event) => change({ text: event.target.value })} />
      </label>
      <div className="play-clue-form-fields">
        <label className="field"><span>단서 구분</span>
          <select value={draft.status} onChange={(event) => change({ status: event.target.value as MapClueStatus })}>
            {Object.entries(MAP_CLUE_STATUSES).map(([status, label]) => <option value={status} key={status}>{label}</option>)}
          </select>
        </label>
        <label className="field"><span>연결할 장소 (선택)</span>
          <select value={draft.relatedPaperId} onChange={(event) => change({ relatedPaperId: event.target.value })}>
            <option value="">연결 없음</option>
            {locations.filter(({ paperId }) => paperMapKey(paperId) !== chosenKey).map(({ paperId }) => (
              <option key={paperMapKey(paperId)} value={paperId}>{paperId}</option>
            ))}
          </select>
        </label>
      </div>
      {tooMany && <p className="play-explore-note">한 장소에 단서는 {MAP_CLUE_LIMIT}개까지 저장할 수 있습니다.</p>}
      <div className="play-clue-actions">
        <button type="submit" className="btn ghost" disabled={!chosenId || !draft.text.trim() || tooMany}>단서 저장</button>
        {edit && <button type="button" className="btn ghost" onClick={clear}>편집 취소</button>}
        {edit && <button type="button" className="linkbtn" onClick={() => setRemoving(true)} disabled={removing}>단서 지우기</button>}
      </div>
      {mapClueSourceChanged(draft, slots) && <p className="play-clue-source-changed">원본 굴림 변경됨 · 재확인 필요</p>}
      {edit && active && removing && <div className="play-clue-actions" role="group" aria-label="단서 삭제 확인">
        <button type="button" className="btn primary" onClick={() => {
          onSave({ ...active, clues: (active.clues ?? []).filter(({ id }) => id !== edit.id) });
          clear();
          setFeedback('단서를 지웠습니다.');
        }}>지우기 확인</button>
        <button type="button" className="btn ghost" onClick={() => setRemoving(false)}>지우기 취소</button>
      </div>}
      {error && <p className="field-err" role="alert">{error}</p>}
      {feedback && <p className="play-explore-note" role="status">{feedback}</p>}
    </form>
    {clues.length > 0 && <ul className="play-clue-list" aria-label="이 장소의 단서" tabIndex={-1}>
      {clues.map((item) => <li key={`${item.origin.paperId}/${item.clue.id}`}>
        <ClueDetails {...item} />
        {!item.incoming && <button type="button" className="linkbtn" aria-label={`단서 편집 · ${item.clue.text}`}
          onClick={() => {
            change({ ...item.clue, relatedPaperId: item.clue.relatedPaperId ?? '' });
            requestAnimationFrame(() => textInput.current?.focus());
          }}>편집</button>}
      </li>)}
    </ul>}
  </section>;
}
