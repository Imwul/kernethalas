import { useId, useState } from 'react';
import type { EncounterPlace } from '../../content/tables/exploration';
import { PAPER_MAP_TAGS, paperMapKey, type PaperMapLocation, type PaperMapTag } from '../../lib/paper-map';

interface Props {
  area: EncounterPlace | null;
  domainId: number;
  locations: PaperMapLocation[];
  active?: PaperMapLocation;
  canRevisit: boolean;
  onSave: (record: PaperMapLocation) => void;
  onRevisit: (record: PaperMapLocation) => void;
}

export function PlayPaperMap({ area, domainId, locations, active, canRevisit, onSave, onRevisit }: Props) {
  const noteId = useId();
  const [paperId, setPaperId] = useState(active?.paperId ?? '');
  const [note, setNote] = useState(active?.note ?? '');
  const [tags, setTags] = useState<PaperMapTag[]>(active?.tags ?? []);
  const [selected, setSelected] = useState(paperMapKey(active?.paperId ?? ''));
  const [feedback, setFeedback] = useState('');
  const entries = locations.filter((record) => record.domainId === domainId);
  const saved = entries.find((record) => paperMapKey(record.paperId) === selected);

  const revisit = () => {
    if (!saved || !canRevisit) return;
    setPaperId(saved.paperId);
    setNote(saved.note);
    setTags(saved.tags);
    onRevisit(saved);
    setFeedback(`${saved.paperId} 메모를 불러왔습니다.`);
  };

  return (
    <details className="fold play-paper-map">
      <summary>종이 지도 메모</summary>
      <section className="play-explore-action-body" aria-label="종이 지도 장소 색인">
        {entries.length > 0 && <div className="play-paper-map-lookup">
          <label className="field">
            <span>저장한 지도 번호</span>
            <select value={selected} onChange={(event) => { setSelected(event.target.value); setFeedback(''); }}>
              <option value="">장소 선택</option>
              {entries.map((record) => (
                <option key={paperMapKey(record.paperId)} value={paperMapKey(record.paperId)}>
                  {record.paperId} ({record.area === 'room' ? '방' : '통로'})
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn ghost" disabled={!saved || !canRevisit} onClick={revisit}>재방문에 불러오기</button>
          {saved && <p className="play-explore-note play-paper-map-saved">
            {[...saved.tags, saved.note].filter(Boolean).join(' · ') || '메모 없음'}
          </p>}
          {!canRevisit && <p className="play-explore-note play-paper-map-saved">다음 장소에 들어가기 전에 재방문 메모를 불러오세요.</p>}
        </div>}
        {area ? (
          <form className="play-paper-map-form" onSubmit={(event) => {
            event.preventDefault();
            const name = paperId.trim();
            if (!name) return;
            onSave({ domainId, paperId: name, area, note: note.trim(), tags });
            setPaperId(name);
            setSelected(paperMapKey(name));
            setFeedback(`${name} 메모를 저장했습니다.`);
          }}>
            <label className="field">
              <span>종이 지도 번호</span>
              <input value={paperId} maxLength={32} autoComplete="off" placeholder="예 B-07"
                onChange={(event) => { setPaperId(event.target.value); setFeedback(''); }} />
            </label>
            <fieldset className="play-paper-map-tags">
              <legend>장소 표시</legend>
              {PAPER_MAP_TAGS.map((tag) => (
                <label key={tag}>
                  <input type="checkbox" checked={tags.includes(tag)} onChange={(event) => {
                    const checked = event.target.checked;
                    setTags((previous) => checked ? [...previous, tag] : previous.filter((item) => item !== tag));
                    setFeedback('');
                  }} />
                  {tag}
                </label>
              ))}
            </fieldset>
            <div className="field">
              <label htmlFor={noteId}>장소 메모</label>
              <textarea id={noteId} rows={2} maxLength={400} value={note} placeholder="예 북쪽 잠긴 문 너머에서 소리가 들림"
                onChange={(event) => { setNote(event.target.value); setFeedback(''); }} />
            </div>
            <button type="submit" className="btn ghost play-explore-action-btn" disabled={!paperId.trim()}>장소 메모 저장</button>
          </form>
        ) : <p className="play-explore-note">현재 방이나 통로를 정하면 지도 번호와 메모를 저장할 수 있습니다.</p>}
        {feedback && <p className="play-explore-note" role="status">{feedback}</p>}
      </section>
    </details>
  );
}
