import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { pageMeta } from './lib/meta';
import { Link, match, useLocation } from './lib/router';
import { nav, useNav } from './lib/store';
import { BESTIARY_CREATURE_PARAM } from './lib/bestiary-encounter';
import { PLAY_CAMPAIGN_PARAM } from './lib/play-campaigns';
import { Palette } from './components/Palette';
import { ReferenceContext, type PreviewReference } from './components/ReferenceContext';
import { ReferencePanel, type ReferenceFrame } from './components/ReferencePanel';
import { ReadingSettings } from './components/ReadingSettings';
import { Crest, IBeast, IBench, IDie, IDrawer, IPlan, IQuestion, IRecord, ISearch } from './components/icons';
import { Home } from './views/Home';
import { ReferenceIndex, ReferencePage } from './views/Reference';
import { OracleIndex, OraclePage } from './views/Oracle';
import { AtlasIndex, AtlasPage } from './views/Atlas';
import { Rulings } from './views/Rulings';
import { Workbench, Dock } from './views/Workbench';
import { Sources } from './views/Sources';
import { Bestiary } from './views/Bestiary';
import { Play } from './views/Play';
import { CampaignPlay } from './components/play/PlayCampaign';
import { NotFound } from './views/NotFound';
import { CATEGORY_LABEL } from './content';
import type { SearchFilter } from './lib/search';

const SECTIONS = [
  { to: '/ref', ko: '색인', short: '색인', icon: <IRecord /> },
  { to: '/bestiary', ko: '생물 도감', short: '도감', icon: <IBeast /> },
  { to: '/oracle', ko: '무작위 표', short: '표', icon: <IDrawer /> },
  { to: '/atlas', ko: '절차', short: '절차', icon: <IPlan /> },
  { to: '/rulings', ko: '판정 문답', short: '문답', icon: <IQuestion /> },
  { to: '/workbench', ko: '작업대', short: '작업대', icon: <IBench /> },
];

function route(path: string, onSearch: (q?: string) => void) {
  let m;
  if (path === '/') return <Home onSearch={onSearch} />;
  if (path === '/play') return <CampaignPlay><Play /></CampaignPlay>;
  if (path === '/ref') return <ReferenceIndex />;
  if ((m = match('/ref/:id', path))) return <ReferencePage id={m.id} />;
  if (path === '/oracle') return <OracleIndex />;
  if ((m = match('/oracle/:id', path))) return <OraclePage id={m.id} />;
  if (path === '/atlas') return <AtlasIndex />;
  if ((m = match('/atlas/:id', path))) return <AtlasPage id={m.id} />;
  if (path === '/rulings') return <Rulings />;
  if (path === '/workbench') return <Workbench />;
  if (path === '/sources') return <Sources />;
  if (path === '/bestiary') return <Bestiary />;
  return <NotFound />;
}

function useTitle(path: string) {
  useEffect(() => {
    // same title/description the static per-page HTML carries (src/lib/meta.ts)
    const m = pageMeta(path);
    document.title = m.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', m.description);
  }, [path]);
}

export function App() {
  const { path, search } = useLocation();
  const bestiaryRequest = path === '/play' ? search.get(BESTIARY_CREATURE_PARAM) : null;
  const campaignRequest = path === '/play' ? search.get(PLAY_CAMPAIGN_PARAM) : null;
  const { open: benchOpen } = useNav();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [stack, setStack] = useState<ReferenceFrame[]>([]);
  const frameKey = useRef(0);
  const current = stack.at(-1);
  const currentId = current?.id;
  const openSearch = useCallback((q?: string) => {
    if (q !== undefined) {
      setQuery(q);
      setFilter('all');
    }
    setSearchOpen(true);
  }, []);
  const preview = useCallback<PreviewReference>((id, options) => {
    const frame = { key: ++frameKey.current, id, ...options };
    setStack((previous) => {
      if (previous.at(-1)?.id === id && options?.result === undefined && !options?.fromSearch) return previous;
      // A link in the source document starts a new panel history.
      return options?.opener && !options.opener.closest('.reference-panel') ? [frame] : [...previous, frame];
    });
  }, []);
  const dismiss = (all = false) => {
    const frame = all ? stack[0] : current;
    setStack(all ? [] : stack.slice(0, -1));
    if (!all && frame?.fromSearch) setSearchOpen(true);
    else if (frame?.opener) requestAnimationFrame(() => frame.opener?.focus({ preventScroll: true }));
  };
  useTitle(path);

  useEffect(() => { setStack([]); }, [path, bestiaryRequest, campaignRequest]);
  // Play mode has its own sticky stage bar and fixed action bar; the site tab bar would stack a third bar on phones.
  useEffect(() => {
    document.documentElement.dataset.route = path === '/play' ? 'play' : '';
  }, [path]);
  useEffect(() => { if (currentId) nav.visit(currentId); }, [currentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      if ((e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        openSearch();
      }
    };
    const onAsk = (e: Event) => openSearch((e as CustomEvent<string>).detail ?? '');
    window.addEventListener('keydown', onKey);
    window.addEventListener('kn:search', onAsk);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('kn:search', onAsk);
    };
  }, [openSearch]);

  const playing = path === '/play';
  const showDock = path !== '/workbench' && !playing;

  return (
    <ReferenceContext.Provider value={preview}>
    <div className={`shell${current ? ' panel-visible' : ''}`}>
      <a href="#main" className="skip">
        본문으로 건너뛰기
      </a>
      <header className="masthead">
        <div className="masthead-inner">
          <Link to="/" className="wordmark" aria-label="Ossuary Index 홈">
            <Crest className="wordmark-glyph" />
            <span className="wordmark-title">KER NETHALAS</span>
          </Link>
          <nav className="mainnav" aria-label="주요 영역">
            {SECTIONS.map((s) => (
              <Link key={s.to} to={s.to} aria-current={path.startsWith(s.to) ? 'page' : undefined} aria-label={s.ko}>
                <span className="nav-full">{s.ko}</span>
                <span className="nav-short" aria-hidden="true">{s.short}</span>
              </Link>
            ))}
          </nav>
          <div className="head-tools">
            <Link to="/play" className="head-play" aria-label="플레이 모드"
              aria-current={playing ? 'page' : undefined} title="플레이 모드"><IDie /><span>플레이</span></Link>
            <button className="searchtrigger" onClick={() => openSearch()} aria-label="검색" aria-keyshortcuts="Control+K Meta+K /">
              <ISearch />
              <span className="label">검색</span>
              <kbd style={{ marginLeft: 'auto' }}>/</kbd>
            </button>
            <ReadingSettings />
          </div>
        </div>
      </header>

      <div className={`frame${showDock ? ' has-dock' : ''}`}>
        {showDock && (
          <div className="frame-index">
            <nav className="side-index" aria-label="범주 색인">
              <h2>범주</h2>
              {Object.entries(CATEGORY_LABEL).map(([c, l]) => (
                <Link key={c} to={`/ref?c=${c}`}>
                  {l.ko}
                </Link>
              ))}
              <h2>그 밖에</h2>
              <Link to="/atlas">절차 도해 전체</Link>
              <Link to="/sources">출처 · 수록 범위</Link>
            </nav>
          </div>
        )}
        <main id="main" className="frame-main" tabIndex={-1}>
          {route(path, openSearch)}
          <footer className="footer">
            <span>
              비공식 팬 레퍼런스. <i>Ker Nethalas: Into the Midnight Throne — Gravebound Edition</i> © 2026 Blackoath Entertainment. 규칙 문장은 직접 쓴 한국어 요약이며 원본 룰북을 대체하지 않습니다.
            </span>
            <span>
              <Link to="/sources">출처 · 수록 범위 · 검증 현황</Link>
            </span>
          </footer>
        </main>
        {showDock && (
          <div className="frame-dock">
            <Dock />
          </div>
        )}
      </div>

      <nav className="tabbar" aria-label="주요 영역">
        {SECTIONS.map((s, index) => (
          <Fragment key={s.to}>
            {index === 3 && <button className="tab-search" onClick={() => openSearch()} aria-label="규칙 검색"><ISearch /><span aria-hidden="true">검색</span></button>}
            <Link to={s.to} aria-current={path.startsWith(s.to) ? 'page' : undefined}>
              {s.icon}
              <span aria-hidden="true">{s.short}</span>
              <span className="sr-only">{s.ko}</span>
              {s.to === '/workbench' && benchOpen.length > 0 && <span className="badge">{benchOpen.length}</span>}
            </Link>
          </Fragment>
        ))}
      </nav>

      <Palette open={searchOpen} query={query} filter={filter} onQuery={setQuery} onFilter={setFilter}
        onPreview={(id, result) => {
          setSearchOpen(false);
          preview(id, { result, fromSearch: true });
        }}
        onClose={() => setSearchOpen(false)} />
      <ReferencePanel
        stack={stack}
        onBack={() => dismiss()}
        onClose={() => dismiss(true)}
        onNavigate={() => setStack([])}
        onResult={(key, value) => setStack((previous) => previous.map((frame) => frame.key === key ? { ...frame, result: value ?? undefined } : frame))}
      />
    </div>
    </ReferenceContext.Provider>
  );
}
