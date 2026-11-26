import { useEffect, useState } from 'react';
import { usePlayDraftState, usePlayRoll } from '../../lib/play-draft';
import { XRef } from '../bits';
import { JournalRoll } from '../LootJournal';

export type IntroStart = { damage: number; sanity: number };

export function PlayIntroDomain({ opening, recorded, onRecord }: {
  opening: boolean;
  recorded: IntroStart | null;
  onRecord: (record: IntroStart) => void;
}) {
  const [damage, setDamage] = usePlayDraftState<number | null>('intro-damage', null);
  const [sanity, setSanity] = usePlayDraftState<number | null>('intro-sanity', null);
  const [book, setBook] = useState<string>();
  const [fileError, setFileError] = useState(false);
  const commit = usePlayRoll();
  useEffect(() => () => { if (book) URL.revokeObjectURL(book); }, [book]);

  return (
    <details className="play-explore-step">
      <summary>도입 도메인 지도와 시작 불이익</summary>
      <p className="play-explore-note">지도에 표시된 방·통로를 선택하세요. 표시된 문은 문 존재 여부 굴림을 생략하고 잠김과 함정을 확인합니다. <XRef id="first-domain-rules" /></p>
      <label className="field"><span>이 기기의 코어북 PDF</span>
        <input type="file" accept="application/pdf,.pdf" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          const invalid = !!file && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name);
          setFileError(invalid);
          setBook(file && !invalid ? URL.createObjectURL(file) : undefined);
        }} />
      </label>
      {fileError && <p className="field-err" role="status">PDF 파일을 선택하세요.</p>}
      {book && <div className="play-explore-links">
        <a className="btn ghost" href={`${book}#page=245`} target="_blank" rel="noopener noreferrer">지도 · 245쪽</a>
        <a className="btn ghost" href={`${book}#page=244`} target="_blank" rel="noopener noreferrer">방별 지시 · 244쪽부터</a>
      </div>}
      {opening && <section className="play-explore-step" aria-label="도입 도메인 시작 불이익">
        {recorded ? <p role="status">시작 불이익 기록함 · 피해 {recorded.damage} · Sanity −{recorded.sanity} · Exhaustion +1</p> : <>
          <JournalRoll die="D6" label="시작 피해" value={damage} onValue={setDamage} />
          <JournalRoll die="D4" label="시작 Sanity 손실" value={sanity} onValue={setSanity} />
          <button className="btn primary" type="button" disabled={damage === null || sanity === null} onClick={() => {
            if (damage !== null && sanity !== null) commit(() => onRecord({ damage, sanity }));
          }}>시작 불이익 기록 · Exhaustion +1</button>
        </>}
      </section>}
    </details>
  );
}
