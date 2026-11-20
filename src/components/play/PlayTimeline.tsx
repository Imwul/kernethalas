import { useState, type Dispatch, type SetStateAction } from 'react';
import { formatPendingTimeline, pendingTimelineCount, type PlayTimelineEntry } from '../../lib/play-timeline';
import { CopyButton } from '../bits';
import '../../styles/play-timeline.css';

export function PlayTimeline({ domainId, timeline, onChange }: {
  domainId: number;
  timeline: PlayTimelineEntry[];
  onChange: Dispatch<SetStateAction<PlayTimelineEntry[]>>;
}) {
  const [pendingOnly, setPendingOnly] = useState(false);
  const entries = timeline.filter((entry) => entry.domainId === domainId);
  const pendingCount = entries.reduce((sum, entry) => sum + pendingTimelineCount(entry), 0);
  const shown = [...(pendingOnly ? entries.filter(pendingTimelineCount) : entries)].reverse();
  const update = (id: string, change: (entry: PlayTimelineEntry) => PlayTimelineEntry) => {
    onChange((previous) => previous.map((entry) => entry.id === id ? change(entry) : entry));
  };

  return (
    <details className="fold play-timeline">
      <summary><span>탐험 연대기</span>{entries.length > 0 && <span>{entries.length}곳 · 미반영 {pendingCount}개</span>}</summary>
      <section className="play-timeline-body" aria-label="도메인 탐험 연대기">
        {entries.length > 0 && (
          <div className="play-timeline-actions">
            <div className="seg" role="group" aria-label="연대기 보기">
              <button type="button" aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>전체</button>
              <button type="button" aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>미반영만</button>
            </div>
            {pendingCount > 0 && <CopyButton text={formatPendingTimeline(entries)} label="미반영만 복사" />}
          </div>
        )}
        {shown.length === 0 ? <p className="play-explore-note">{entries.length > 0
          ? '종이에 옮기지 않은 항목이 없습니다.' : '저널에서 다음 장소로 이동하면 여기에 기록이 남습니다.'}</p> : (
          <ol className="play-timeline-list">
            {shown.map((entry) => {
              const number = `장소 ${entry.roomNumber}`;
              const pending = pendingTimelineCount(entry);
              const position = [
                entry.title !== number ? number : '',
                entry.paperId && entry.paperId !== entry.title ? `지도 ${entry.paperId}` : '',
                pending > 0 ? `미반영 ${pending}개` : '',
              ].filter(Boolean).join(' · ');
              return (
                <li key={entry.id}>
                  <details className="fold play-timeline-entry">
                    <summary>
                      <span>{entry.title}</span>
                      {position && <span className="play-timeline-position">{position}</span>}
                    </summary>
                    <div className="play-timeline-entry-body">
                      {entry.facts.length > 0 && (
                        <>
                          <dl className="play-timeline-facts">
                            {entry.facts.map(({ label, value }, index) => <div key={`${label}:${index}`}><dt>{label}</dt><dd>{value}</dd></div>)}
                          </dl>
                          <label className="play-timeline-check">
                            <input type="checkbox" checked={entry.journalCopied} onChange={(event) => {
                              const journalCopied = event.target.checked;
                              update(entry.id, (current) => ({ ...current, journalCopied }));
                            }} />
                            저널에 옮김
                          </label>
                        </>
                      )}
                      {entry.sheet.length > 0 && (
                        <fieldset className="play-timeline-sheet">
                          <legend>종이 시트에 옮김</legend>
                          {entry.sheet.map((item) => (
                            <label className="play-timeline-check" key={item.id}>
                              <input type="checkbox" checked={item.copied} onChange={(event) => {
                                const copied = event.target.checked;
                                update(entry.id, (current) => ({
                                  ...current,
                                  sheet: current.sheet.map((row) => row.id === item.id ? { ...row, copied } : row),
                                }));
                              }} />
                              <span>{item.text}</span>
                            </label>
                          ))}
                        </fieldset>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </details>
  );
}
