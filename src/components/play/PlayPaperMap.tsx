import { useId, useState } from 'react';
import type { EncounterPlace } from '../../content/tables/exploration';
import { PAPER_MAP_TAGS, paperMapKey, type PaperMapLocation, type PaperMapTag } from '../../lib/paper-map';
import { ROOM_EXIT_MARKS } from '../RoomShapeDiagram';
import { PlayStrip, PlayStripPane } from './PlayPanels';

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
  const [pane, setPane] = useState<'memo' | 'return' | null>(null);
  const stripId = useId();
  const entries = locations.filter((record) => record.domainId === domainId);
  const returnCount = entries.filter(({ tags: marked }) => marked.length > 0).length;
  const saved = entries.find((record) => paperMapKey(record.paperId) === selected);

  const revisit = (record: PaperMapLocation) => {
    if (!canRevisit) return;
    setPaperId(record.paperId);
    setNote(record.note);
    setTags(record.tags);
    setSelected(paperMapKey(record.paperId));
    onRevisit(record);
    setFeedback(`${record.paperId} 메모를 불러왔습니다.`);
  };

  return (
    <div className="play-paper-map">
      <PlayStrip label="종이 지도" prefix={stripId} value={pane} onChange={setPane} items={[
        { id: 'memo', label: active ? `종이 지도 메모 · ${active.paperId}` : '종이 지도 메모' },
        ...(entries.length > 0 ? [{ id: 'return' as const, label: '돌아갈 곳', badge: returnCount }] : []),
      ]} />
      <PlayStripPane prefix={stripId} id="memo" open={pane === 'memo'}>
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
            <button type="button" className="btn ghost" disabled={!saved || !canRevisit} onClick={() => saved && revisit(saved)}>재방문에 불러오기</button>
            {saved && <p className="play-explore-note play-paper-map-saved">
              {[...saved.tags, saved.note].filter(Boolean).join(' · ') || '메모 없음'}
            </p>}
            {saved?.doors?.length ? <SavedDoorReports location={saved} /> : null}
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
      </PlayStripPane>
      {entries.length > 0 && <PlayStripPane prefix={stripId} id="return" open={pane === 'return'}>
        <PlayReturnPlaces entries={entries} canRevisit={canRevisit} onRevisit={revisit} />
      </PlayStripPane>}
    </div>
  );
}

function SavedDoorReports({ location }: { location: PaperMapLocation }) {
  return (
    <ul className="play-map-door-reports" aria-label="출입구별 문과 함정 기록">
      {location.doors?.map(({ exit, text, opened }) => (
        <li key={paperMapKey(exit)} data-opened={opened || undefined}><strong>{exit}</strong><span>{text}</span></li>
      ))}
    </ul>
  );
}

function PlayReturnPlaces({ entries, canRevisit, onRevisit }: {
  entries: PaperMapLocation[];
  canRevisit: boolean;
  onRevisit: (location: PaperMapLocation) => void;
}) {
  const [filter, setFilter] = useState<PaperMapTag | 'all'>('all');
  const [announced, setAnnounced] = useState('');
  const candidates = entries.filter(({ tags }) => tags.length > 0);
  const shown = candidates.filter(({ tags }) => filter === 'all' || tags.includes(filter));

  return (
      <section className="play-return-places play-explore-action-body" aria-label="돌아갈 곳 목록">
        {candidates.length > 0 && (
          <div className="seg play-return-filters" role="group" aria-label="돌아갈 곳 필터">
            {(['all', ...PAPER_MAP_TAGS] as const).map((tag) => (
              <button type="button" key={tag} aria-pressed={filter === tag} onClick={() => setFilter(tag)}>
                {tag === 'all' ? '전체' : tag}
              </button>
            ))}
          </div>
        )}
        {!canRevisit && candidates.length > 0 && <p className="play-explore-note">이번 장소를 마치고 새 장소에서 재방문을 선택하세요.</p>}
        {shown.length === 0 ? <p className="play-explore-note">{candidates.length ? '이 표시에 해당하는 장소가 없습니다.'
          : '종이 지도 메모에 잠긴 문, 미개봉 용기, 미탐색 출입구를 표시할 수 있습니다.'}</p> : (
          <ul className="play-return-list">
            {shown.map((record) => {
              const tile = record.tile;
              const exits = [
                ...(tile?.entrance != null ? [`입구 ${tile.entrance + 1}번`] : []),
                ...Object.entries(tile?.marks ?? {}).flatMap(([exit, mark]) => mark ? [`${Number(exit) + 1}번 ${ROOM_EXIT_MARKS[mark]}`] : []),
              ];
              return (
                <li className="play-return-place" key={paperMapKey(record.paperId)}>
                  <div className="play-return-place-info">
                    <div className="play-return-place-name">
                      <strong>{record.paperId}</strong><span>{record.area === 'room' ? '방' : '통로'}</span>
                    </div>
                    <ul className="play-return-tags" aria-label="장소 표시">
                      {record.tags.map((tag) => <li key={tag}>{tag}</li>)}
                    </ul>
                    {exits.length > 0 && <p className="play-explore-note">{exits.join(' · ')}</p>}
                    {record.note && <p className="play-return-note">{record.note}</p>}
                    {record.doors?.length ? <SavedDoorReports location={record} /> : null}
                  </div>
                  <button type="button" className="btn ghost" aria-label={`${record.paperId} 재방문`} disabled={!canRevisit}
                    onClick={() => {
                      onRevisit(record);
                      setAnnounced(`${record.paperId} 재방문을 선택했습니다.`);
                    }}>재방문</button>
                </li>
              );
            })}
          </ul>
        )}
        {announced && <p className="play-explore-note" role="status">{announced}</p>}
      </section>
  );
}
