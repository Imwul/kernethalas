import { useEffect, useMemo, useRef, useState } from 'react';
import { campaignHref, CAMPAIGN_NAME_MAX, PLAY_CAMPAIGN_PARAM, usePlayCampaignId } from '../../lib/play-campaigns';
import {
  CHECKPOINT_MAX_BYTES, CHECKPOINT_NAME_MAX, capturePlayCheckpoint, compareCheckpointGear, exportPlayCheckpoint, forkPlayCheckpoint,
  parsePlayCheckpoint, readPlayCheckpoints, storePlayCheckpoints, type PlayCheckpoint,
  type PlayCheckpointData,
} from '../../lib/play-checkpoints';
import { readPlayLight } from '../../lib/play-light';
import { navigate, useLocation } from '../../lib/router';
import { backupIsStale, readLastBackup } from '../../lib/site-backup';
import { PlaySiteBackup } from './PlaySiteBackup';
import '../../styles/play-checkpoints.css';

interface Props {
  data: PlayCheckpointData;
  place: string;
  stage: string;
  currentLight?: number | null;
  onRestore: (data: PlayCheckpointData) => boolean | Promise<boolean>;
  onNeedsBackup?: (needed: boolean) => void;
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

function CheckpointLabel({ checkpoint, showLocation = true }: { checkpoint: PlayCheckpoint; showLocation?: boolean }) {
  return (
    <div className="play-checkpoint-label">
      <strong>{checkpoint.name}</strong>
      {showLocation && <span>{checkpoint.place} · {checkpoint.stage}</span>}
      <time dateTime={new Date(checkpoint.createdAt).toISOString()}>{dateFormat.format(checkpoint.createdAt)}</time>
    </div>
  );
}

function lightLabel(slots: PlayCheckpointData['slots'], remaining?: number | null) {
  if (remaining !== undefined) return remaining === null ? '미기록' : `${remaining}칸`;
  const stored = readPlayLight(slots);
  return stored ? `${stored.remaining}칸 (저장 기준값)` : '미기록';
}

function CheckpointComparison({ checkpoint, data, place, stage, currentLight }:
  Pick<Props, 'data' | 'place' | 'stage' | 'currentLight'> & { checkpoint: PlayCheckpoint }) {
  const gear = useMemo(() => compareCheckpointGear(data.gear, checkpoint.data.gear), [data.gear, checkpoint.data.gear]);
  return <table className="play-checkpoint-comparison" aria-label="현재와 저장 지점 비교">
    <thead><tr><th scope="col">항목</th><th scope="col">현재</th><th scope="col">저장 지점</th></tr></thead>
    <tbody>
      <tr><th scope="row">장소·단계</th><td>{place} · {stage}</td><td>{checkpoint.place} · {checkpoint.stage}</td></tr>
      <tr><th scope="row">광원</th><td>{lightLabel(data.slots, currentLight)}</td><td>{lightLabel(checkpoint.data.slots, checkpoint.lightRemaining)}</td></tr>
      {gear.map(({ key, name, current, saved }) => <tr key={key}>
        <th scope="row">{name}</th><td>{current}</td><td>{saved}</td>
      </tr>)}
      {!gear.length && <tr><th scope="row">장비</th><td colSpan={2}>수량·보관 상태 동일</td></tr>}
    </tbody>
  </table>;
}

type Review = { checkpoint: PlayCheckpoint; imported: boolean };

export function PlayCheckpoints({ data, place, stage, currentLight, onRestore, onNeedsBackup }: Props) {
  const campaignId = usePlayCampaignId();
  const { search } = useLocation();
  const [checkpoints, setCheckpoints] = useState(() => readPlayCheckpoints(campaignId) ?? []);
  const [name, setName] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const [forkName, setForkName] = useState('');
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
  useEffect(() => { onNeedsBackup?.(needsBackup); }, [needsBackup, onNeedsBackup]);

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
    const checkpoint = capturePlayCheckpoint(name.trim() || place.slice(0, CHECKPOINT_NAME_MAX), place, stage, data, currentLight);
    setError(checkpoint ? '' : '현재 상태가 저장 파일의 형식이나 크기 제한을 벗어났습니다.');
    return checkpoint;
  };
  const inspect = (checkpoint: PlayCheckpoint, imported = false) => {
    ++readId.current;
    const suffix = ' · 사본';
    setForkName(`${checkpoint.name.trim().slice(0, CAMPAIGN_NAME_MAX - suffix.length)}${suffix}`);
    setReview({ checkpoint, imported });
    setError('');
  };
  const dismiss = () => { ++readId.current; setReview(null); setError(''); };
  const rememberImport = (checkpoint: PlayCheckpoint, message: string) => {
    updateList([checkpoint, ...currentList().filter(({ id }) => id !== checkpoint.id)], message);
  };
  const restore = async ({ checkpoint, imported }: Review) => {
    if (busy.current) return;
    busy.current = true;
    setRestoring(true);
    setError('');
    try {
      if (await onRestore(checkpoint.data)) {
        setReview(null);
        if (imported) rememberImport(checkpoint, `${checkpoint.name}에서 이어합니다.`);
        else setFeedback(`${checkpoint.name}에서 이어합니다.`);
      } else setError('저장 지점을 복원할 수 없습니다. 저장 공간이나 파일을 확인하세요.');
    } catch {
      setError('저장 지점을 복원할 수 없습니다. 저장 공간이나 파일을 확인하세요.');
    } finally {
      busy.current = false;
      setRestoring(false);
    }
  };

  const openFork = (checkpoint: PlayCheckpoint) => {
    if (busy.current) return;
    const result = forkPlayCheckpoint(checkpoint, forkName);
    if ('error' in result) { setError(result.error); return; }
    // Keep Back on the original campaign even if its current URL relies on the tab's active campaign.
    if (search.get(PLAY_CAMPAIGN_PARAM) !== campaignId) navigate(campaignHref(campaignId, search), { replace: true });
    navigate(campaignHref(result.id));
    window.scrollTo({ top: 0 });
  };

  return (
    <section className="play-checkpoints play-checkpoints-body" aria-label="플레이 저장과 복원">
        {needsBackup && <p className="play-checkpoint-flag"><span className="fold-flag">백업 필요</span> 저장한 플레이가 아직 전체 백업 파일에 없습니다.</p>}
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
                inspect(checkpoint, true);
              } catch {
                if (readId.current === request) setError('저장 파일을 읽을 수 없습니다.');
              }
            }} />
        </div>
        {review && (
          <section className="play-checkpoint-review" aria-label="저장 지점 검토">
            <h3 tabIndex={-1} ref={reviewHeading}>이어할 저장 지점</h3>
            <CheckpointLabel checkpoint={review.checkpoint} showLocation={false} />
            <CheckpointComparison checkpoint={review.checkpoint} data={data} place={place} stage={stage} currentLight={currentLight} />
            <form className="play-checkpoint-form play-checkpoint-fork" onSubmit={(event) => {
              event.preventDefault();
              openFork(review.checkpoint);
            }}>
              <label className="field"><span>새 캠페인 이름</span>
                <input value={forkName} maxLength={CAMPAIGN_NAME_MAX} required autoComplete="off" disabled={restoring}
                  onChange={(event) => { setForkName(event.target.value); setError(''); }} />
              </label>
              <button type="submit" className="btn primary" disabled={restoring || !forkName.trim()}>새 캠페인으로 열기</button>
            </form>
            {error && <p className="field-err" role="alert">{error}</p>}
            <p className="play-checkpoint-comparison-note">현재 캠페인에서 이어하면 판정, 장비 장부, 사용자 조우표를 이 시점으로 되돌립니다.</p>
            <div className="play-checkpoint-actions">
              <button type="button" className="btn ghost" disabled={restoring}
                onClick={() => void restore(review)}>{restoring ? '복원 중' : '복원하고 이어하기'}</button>
              {review.imported && <button type="button" className="btn ghost" disabled={restoring} onClick={() => {
                dismiss();
                rememberImport(review.checkpoint, `${review.checkpoint.name} 저장 목록에 추가했습니다.`);
              }}>저장 목록에 추가</button>}
              <button type="button" className="btn ghost" disabled={restoring} onClick={dismiss}>취소</button>
            </div>
          </section>
        )}
        {error && !review && <p className="field-err" role="alert">{error}</p>}
        {feedback && <p className="play-checkpoint-feedback" role="status">{feedback}</p>}
        <PlaySiteBackup onBackup={() => setBackedUp(true)} />
        {checkpoints.length > 0 && (
          <ul className="play-checkpoint-list" aria-label="저장 지점">
            {checkpoints.map((checkpoint) => (
              <li className="play-checkpoint-row" key={checkpoint.id}>
                <CheckpointLabel checkpoint={checkpoint} />
                <div className="play-checkpoint-actions">
                  <button type="button" className="btn ghost" aria-label={`${checkpoint.name} 이어서 하기`} disabled={restoring}
                    onClick={() => inspect(checkpoint)}>이어서 하기</button>
                  <button type="button" className="btn ghost" aria-label={`${checkpoint.name} 파일로 저장`} disabled={restoring}
                    onClick={() => download(checkpoint)}>파일로 저장</button>
                  <button type="button" className="linkbtn" aria-label={`${checkpoint.name} 저장 지점 삭제`} disabled={restoring} onClick={() => {
                    if (review?.checkpoint.id === checkpoint.id) dismiss();
                    updateList(currentList().filter((saved) => saved.id !== checkpoint.id), `${checkpoint.name} 저장 지점을 삭제했습니다.`);
                  }}>삭제</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
