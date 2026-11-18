import { Link, useLocation } from '../lib/router';

/** Ask the shell to open the search palette (App listens for this event). */
export const openSearch = (q = '') => window.dispatchEvent(new CustomEvent('kn:search', { detail: q }));

export function NotFound() {
  const { path } = useLocation();
  // the last path segment is usually what the reader was after, e.g. /atlas/p-combat → "combat"
  const guess = decodeURIComponent(path.split('/').pop() ?? '')
    .replace(/^(p|t|q|m|cr)-/, '')
    .replace(/-/g, ' ');
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <p className="ko-display" style={{ fontSize: 24, margin: 0 }}>
        페이지를 찾을 수 없습니다
      </p>
      <p>주소가 바뀌었거나 수록되지 않은 항목입니다.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className="btn primary" onClick={() => openSearch(guess)}>
          {guess ? `“${guess}” 검색하기` : '검색하기'}
        </button>
        <Link to="/ref" className="btn ghost">
          규칙 색인 열기
        </Link>
      </div>
    </div>
  );
}
