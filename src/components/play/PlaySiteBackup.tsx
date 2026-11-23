import { useEffect, useRef, useState } from 'react';
import {
  BACKUP_MAX_BYTES, backupAgeLabel, backupFileName, backupIsStale, describeSiteBackup, dismissRestoreUndo,
  exportSiteBackup, hasRestoreUndo, markBackup, parseSiteBackup, readLastBackup, requestPersistentStorage,
  restoreSiteBackup, storageIsPersistent, undoSiteRestore, type SiteBackup,
} from '../../lib/site-backup';

const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function persistenceText(state: boolean | null) {
  if (state === true) return '이 브라우저에 보관하도록 요청해 두었습니다.';
  if (state === false) return '브라우저가 오래 쓰지 않은 데이터를 지울 수 있습니다. iPhone·iPad는 홈 화면에 추가하면 더 안전합니다.';
  return '';
}

export function PlaySiteBackup({ onBackup }: { onBackup: () => void }) {
  const [last, setLast] = useState(readLastBackup);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [review, setReview] = useState<SiteBackup | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [undo, setUndo] = useState(hasRestoreUndo);
  const input = useRef<HTMLInputElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { void storageIsPersistent().then(setPersistent); }, []);
  useEffect(() => { if (review) reviewHeading.current?.focus({ preventScroll: true }); }, [review]);

  const download = async () => {
    const now = Date.now();
    const url = URL.createObjectURL(new Blob([exportSiteBackup(now)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(now);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    markBackup(now);
    setLast(now);
    setError('');
    setFeedback('전체 백업 파일을 내려받았습니다.');
    onBackup();
    setPersistent(await requestPersistentStorage());
  };

  const reload = () => window.location.reload();
  const counts = review ? describeSiteBackup(review.data) : null;

  return (
    <section className="play-site-backup" aria-labelledby="play-site-backup-title">
      <h3 id="play-site-backup-title">전체 백업</h3>
      <p className="play-site-backup-status">
        <span data-stale={backupIsStale(last) || undefined}>{backupAgeLabel(last)}</span>
        {persistent !== null && <span>{persistenceText(persistent)}</span>}
      </p>
      <p className="play-site-backup-help">모든 캠페인, 저장 지점, 장비 장부, 판정 메모와 읽기 설정을 파일 하나로 내려받습니다.</p>
      <div className="play-checkpoint-actions">
        <button type="button" className="btn ghost" onClick={() => void download()}>전체 백업 내려받기</button>
        <button type="button" className="btn ghost" onClick={() => input.current?.click()}>백업 파일로 복원</button>
        <input hidden type="file" accept=".json,application/json" aria-label="전체 백업 JSON 파일" ref={input}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            setError('');
            setFeedback('');
            setReview(null);
            if (!file) return;
            if (file.size > BACKUP_MAX_BYTES) { setError('8MB 이하의 전체 백업 파일을 선택하세요.'); return; }
            try {
              const backup = parseSiteBackup(await file.text());
              if (backup) setReview(backup);
              else setError('이 사이트에서 내려받은 전체 백업 파일을 선택하세요. 저장 지점 파일은 위의 저장 파일 가져오기를 쓰세요.');
            } catch {
              setError('백업 파일을 읽을 수 없습니다.');
            }
          }} />
      </div>
      {review && counts && (
        <section className="play-checkpoint-review" aria-label="전체 백업 검토">
          <h4 tabIndex={-1} ref={reviewHeading}>복원할 백업</h4>
          <p>{dateFormat.format(review.exportedAt)} · 캠페인 {counts.campaigns}개 · 저장 지점 {counts.checkpoints}개</p>
          <p>이 기기의 캠페인과 설정을 모두 이 백업으로 바꿉니다. 복원한 뒤 이 탭에서 한 번 되돌릴 수 있습니다.</p>
          <div className="play-checkpoint-actions">
            <button type="button" className="btn primary" onClick={() => {
              const result = restoreSiteBackup(review);
              if (result.ok) { reload(); return; }
              setError(result.reason === 'undo'
                ? '되돌리기용 사본을 만들 공간이 없습니다. 먼저 전체 백업을 내려받은 뒤 다시 시도하세요.'
                : '저장 공간에 쓰지 못해 원래 데이터를 유지했습니다.');
            }}>백업으로 바꾸기</button>
            <button type="button" className="btn ghost" onClick={() => setReview(null)}>취소</button>
          </div>
        </section>
      )}
      {undo && (
        <div className="play-site-backup-undo" role="status">
          <span>백업을 복원했습니다.</span>
          <button type="button" className="btn ghost" onClick={() => { if (undoSiteRestore()) reload(); else setError('복원 전 상태를 찾지 못했습니다.'); }}>복원 전으로 되돌리기</button>
          <button type="button" className="linkbtn" onClick={() => { dismissRestoreUndo(); setUndo(false); }}>닫기</button>
        </div>
      )}
      {error && <p className="field-err" role="alert">{error}</p>}
      {feedback && <p className="play-checkpoint-feedback" role="status">{feedback}</p>}
    </section>
  );
}
