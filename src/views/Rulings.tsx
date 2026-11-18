import { useEffect } from 'react';
import { rulings } from '../content';
import { useLocation } from '../lib/router';
import { Cite, VChip, XRef } from '../components/bits';
import { RulingMatrix } from '../components/RulingMatrix';

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
              <p className="ans" style={{ margin: 0 }}>
                {r.answer}
              </p>
              {r.matrix && <RulingMatrix matrix={r.matrix} compare={r.id === 'q-both-fail'} />}
              {r.conditions && (
                <div>
                  <span className="kicker">적용 조건 · 비교</span>
                  <ul className="bullets">
                    {r.conditions.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {r.exceptions && (
                <div>
                  <span className="kicker">예외</span>
                  <ul className="bullets">
                    {r.exceptions.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                {r.refs.map((id) => <XRef key={id} id={id} showKind />)}
                {r.tables?.map((id) => <XRef key={id} id={id} showKind />)}
              </div>
              <Cite source={r.source} />
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
