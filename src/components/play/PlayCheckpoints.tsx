import { useEffect, useRef, useState } from 'react';
import { usePlayCampaignId } from '../../lib/play-campaigns';
import {
  CHECKPOINT_MAX_BYTES, CHECKPOINT_NAME_MAX, capturePlayCheckpoint, exportPlayCheckpoint,
  parsePlayCheckpoint, readPlayCheckpoints, storePlayCheckpoints, type PlayCheckpoint,
  type PlayCheckpointData,
} from '../../lib/play-checkpoints';
import { backupIsStale, hasRestoreUndo, readLastBackup } from '../../lib/site-backup';
import { PlaySiteBackup } from './PlaySiteBackup';
import '../../styles/play-checkpoints.css';

interface Props {
  data: PlayCheckpointData;
  place: string;
  stage: string;
  onRestore: (data: PlayCheckpointData) => boolean | Promise<boolean>;
}

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function download(checkpoint: PlayCheckpoint) {
  const url = URL.createObjectURL(new Blob([exportPlayCheckpoint(checkpoint)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `kernethalas-play-${checkpoint.createdAt}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function CheckpointLabel({ checkpoint }: { checkpoint: PlayCheckpoint }) {
  return (
    <div className="play-checkpoint-label">
      <strong>{checkpoint.name}</strong>
      <span>{checkpoint.place} · {checkpoint.stage}</span>
      <time dateTime={new Date(checkpoint.createdAt).toISOString()}>{dateFormat.format(checkpoint.createdAt)}</time>
    </div>
  );
}

export function PlayCheckpoints({ data, place, stage, onRestore }: Props) {
  const campaignId = usePlayCampaignId();
  const [checkpoints, setCheckpoints] = useState(() => readPlayCheckpoints(campaignId) ?? []);
  const [name, setName] = useState('');
  const [review, setReview] = useState<PlayCheckpoint | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const readId = useRef(0);
  const temporary = useRef(false);
  const busy = useRef(false);
  const [backedUp, setBackedUp] = useState(() => !backupIsStale(readLastBackup()));
  // only nag once there is something worth keeping: a recorded roll, a checkpoint or other saved play data
  const needsBackup = !backedUp && ((data.history?.length ?? 0) > 0 || checkpoints.length > 0 || data.gear.items.length > 0);

  useEffect(() => {
    if (!review) return;
    reviewHeading.current?.focus({ preventScroll: true });
    reviewHeading.current?.scrollIntoView({ block: 'nearest' });
  }, [review]);

  const currentList = () => temporary.current ? checkpoints : readPlayCheckpoints(campaignId) ?? checkpoints;
  const updateList = (next: PlayCheckpoint[], message: string) => {
    temporary.current = !storePlayCheckpoints(next, campaignId);
    setCheckpoints(next);
    setError('');
    setFeedback(temporary.current ? `${message} 플레이를 열어 둔 동안만 남습니다. 파일로 내보낼 수 있습니다.` : message);
  };
  const capture = () => {
    const checkpoint = capturePlayCheckpoint(name.trim() || place.slice(0, CHECKPOINT_NAME_MAX), place, stage, data);
    setError(checkpoint ? '' : '현재 상태가 저장 파일의 형식이나 크기 제한을 벗어났습니다.');
    return checkpoint;
  };
  const restore = async (checkpoint: PlayCheckpoint) => {
    if (busy.current) return;
    busy.current = true;
    setRestoring(true);
    setError('');
    try {
      if (await onRestore(checkpoint.data)) {
        setReview(null);
        setFeedback(`${checkpoint.name}에서 이어합니다.`);
      } else setError('저장 지점을 복원할 수 없습니다. 저장 공간이나 파일을 확인하세요.');
    } catch {
      setError('저장 지점을 복원할 수 없습니다. 저장 공간이나 파일을 확인하세요.');
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  };

  return (
    <details className="fold play-checkpoints" open={hasRestoreUndo() || undefined}>
      <summary><span>플레이 저장·이어하기</span>{needsBackup && <span className="fold-flag">백업 필요</span>}</summary>
      <section className="play-checkpoints-body" aria-label="플레이 저장과 복원">
        <form className="play-checkpoint-form" onSubmit={(event) => {
          event.preventDefault();
          const checkpoint = capture();
          if (!checkpoint) return;
          updateList([checkpoint, ...currentList()], `${checkpoint.name} 저장 완료`);
          setName('');
        }}>
          <label className="field"><span>저장 지점 이름</span>
            <input value={name} placeholder={place} maxLength={CHECKPOINT_NAME_MAX} disabled={restoring}
              onChange={(event) => setName(event.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={restoring}>저장 지점 만들기</button>
        </form>
        <div className="play-checkpoint-actions">
          <button type="button" className="btn ghost" disabled={restoring} onClick={() => {
            const checkpoint = capture();
            if (checkpoint) download(checkpoint);
          }}>현재 상태 파일로 저장</button>
          <button type="button" className="btn ghost" disabled={restoring} onClick={() => input.current?.click()}>저장 파일 가져오기</button>
          <input hidden type="file" accept=".json,application/json" aria-label="플레이 저장 JSON 파일" ref={input} disabled={restoring}
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              const request = ++readId.current;
              setFeedback('');
              setError('');
              setReview(null);
              if (file.size > CHECKPOINT_MAX_BYTES) {
                setError('2MB 이하의 플레이 저장 파일을 선택하세요.');
                return;
              }
              try {
                const checkpoint = parsePlayCheckpoint(await file.text());
                if (readId.current !== request || busy.current) return;
                if (!checkpoint) {
                  setError('이 사이트에서 내보낸 플레이 저장 JSON을 선택하세요.');
                  return;
                }
                updateList([checkpoint, ...currentList().filter((saved) => saved.id !== checkpoint.id)], `${checkpoint.name} 파일을 가져왔습니다.`);
                setReview(checkpoint);
              } catch {
                if (readId.current === request) setError('저장 파일을 읽을 수 없습니다.');
              }
            }} />
        </div>
        {review && (
          <section className="play-checkpoint-review" aria-label="저장 지점 검토">
            <h3 tabIndex={-1} ref={reviewHeading}>이어할 저장 지점</h3>
            <CheckpointLabel checkpoint={review} />
            <p>현재 장소의 판정, 장비 장부, 사용자 조우표를 이 저장 지점의 상태로 바꿉니다.</p>
            <div className="play-checkpoint-actions">
              <button type="button" className="btn primary" disabled={restoring}
                onClick={() => void restore(review)}>{restoring ? '복원 중' : '복원하고 이어하기'}</button>
              <button type="button" className="btn ghost" disabled={restoring} onClick={() => setReview(null)}>취소</button>
            </div>
          </section>
        )}
        {error && <p className="field-err" role="alert">{error}</p>}
        {feedback && <p className="play-checkpoint-feedback" role="status">{feedback}</p>}
        <PlaySiteBackup onBackup={() => setBackedUp(true)} />
        {checkpoints.length > 0 && (
          <ul className="play-checkpoint-list" aria-label="저장 지점">
            {checkpoints.map((checkpoint) => (
              <li className="play-checkpoint-row" key={checkpoint.id}>
                <CheckpointLabel checkpoint={checkpoint} />
                <div className="play-checkpoint-actions">
                  <button type="button" className="btn ghost" aria-label={`${checkpoint.name} 이어서 하기`} disabled={restoring}
                    onClick={() => { setReview(checkpoint); setError(''); }}>이어서 하기</button>
                  <button type="button" className="btn ghost" aria-label={`${checkpoint.name} 파일로 저장`} disabled={restoring}
                    onClick={() => download(checkpoint)}>파일로 저장</button>
                  <button type="button" className="linkbtn" aria-label={`${checkpoint.name} 저장 지점 삭제`} disabled={restoring} onClick={() => {
                    if (review?.id === checkpoint.id) setReview(null);
                    updateList(currentList().filter((saved) => saved.id !== checkpoint.id), `${checkpoint.name} 저장 지점을 삭제했습니다.`);
                  }}>삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </details>
  );
}
