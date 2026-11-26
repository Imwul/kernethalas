import { useEffect } from 'react';
import { rulings } from '../content';
import { useLocation } from '../lib/router';
import { VChip } from '../components/bits';
import { RulingBody } from '../components/RulingBody';

export function Rulings() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash)?.scrollIntoView({ block: 'start' });
  }, [hash]);
  return (
    <div>
      <header className="page-head">
        <h1 className="page-title">판정 문답</h1>
        <p className="lede">자주 헷갈리는 상황과 Gravebound v1.2 원문 기준 답. 원문이 정하지 않은 부분은 따로 표시합니다.</p>
      </header>
      <div className="rulings">
        {rulings.map((r) => (
          <details key={r.id} id={r.id} className="ruling" open={hash === r.id || undefined}>
            <summary>
              <span className="qq">
                {r.q}
              </span>
              <VChip v={r.verification} />
            </summary>
            <div className="qbody">
              <RulingBody ruling={r} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
