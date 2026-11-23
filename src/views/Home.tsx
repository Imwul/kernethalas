import { useMemo, useState } from 'react';
import { tableById, hrefOf, titleOf, kindOf } from '../content';
import { SITUATION_GROUPS, situations } from '../content/situations';
import { Link } from '../lib/router';
import { campaignHref, campaignSummary, DEFAULT_PLAY_CAMPAIGN, usePlayCampaigns } from '../lib/play-campaigns';
import { useNav } from '../lib/store';
import { ISearch, IDie } from '../components/icons';
import { XRef } from '../components/bits';
import { KIND_LABEL, docs, findSituations } from '../lib/search';

const ORACLES = ['t-events', 't-growing-darkness', 't-encounter-general', 't-traps', 't-scavenging', 't-spoils', 't-defensive-move-pc', 't-fumble-pc', 't-room-shape', 't-overseer-influence'];

const byId = new Map(docs.map((d) => [d.id, d]));

export function Home({ onSearch }: { onSearch: (q?: string) => void }) {
  const { pins, recent } = useNav();
  const { last, campaigns } = usePlayCampaigns();
  const resume = campaigns.find(({ id }) => id === (last ?? DEFAULT_PLAY_CAMPAIGN));
  const place = resume ? campaignSummary(resume.id) : '';
  return (
    <div className="home archive-home">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="archive-title">
          <h1 id="home-title">Ossuary Index</h1>
          <p>Ker Nethalas · Gravebound Edition v1.2</p>
        </div>
        <div className="home-launch-tools">
          {resume && (resume.playedAt || place) ? <div className="home-play-resume">
            <Link to={campaignHref(resume.id)} className="btn primary home-play-launch"><IDie /> {resume.name} 이어하기</Link>
            {place && <span className="home-play-resume-info">{place}</span>}
          </div> : <Link to="/play" className="btn primary home-play-launch"><IDie /> 플레이 시작</Link>}
          <button className="bigsearch" onClick={() => onSearch()} aria-label="규칙 검색 열기">
            <ISearch />
            <span>규칙, 표, 절차 검색</span>
            <kbd>/</kbd>
          </button>
        </div>
      </section>

      <div className="archive-layout">
        <div className="archive-main">
          <SituationFinder onSearch={onSearch} />
            {recent.length > 0 && (
              <section aria-labelledby="recent">
                <div className="section-head"><h2 id="recent">최근 열람</h2></div>
                <ul className="ledger">{recent.slice(0, 6).map((id) => <LedgerItem key={id} id={id} />)}</ul>
              </section>
            )}
        </div>
        <aside className="archive-index" aria-label="자주 보는 자료">
          <section aria-labelledby="pins">
            <div className="section-head">
              <h2 id="pins">고정 항목</h2>
              <Link to="/workbench" className="more">작업대</Link>
            </div>
            {pins.length ? <ul className="ledger">{pins.map((id) => <LedgerItem key={id} id={id} />)}</ul> : <p className="empty">고정한 항목이 여기에 표시됩니다.</p>}
          </section>
          <section aria-labelledby="oracles">
            <div className="section-head">
              <h2 id="oracles">자주 쓰는 표</h2>
              <Link to="/oracle" className="more">전체 표</Link>
            </div>
            <ul className="ledger">
              {ORACLES.map((id) => {
                const table = tableById.get(id)!;
                return (
                  <li key={id}>
                    <Link to={hrefOf(id)}>
                      <span className="lk"><IDie /></span>
                      <span className="lt">{table.ko}</span>
                      <span className="lr">{table.dice}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SituationFinder({ onSearch }: { onSearch: (q?: string) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<(typeof SITUATION_GROUPS)[number]['id']>('combat');
  const matching = useMemo(() => query.trim() ? findSituations(query) : situations.filter((item) => item.group === group), [group, query]);
  return (
    <section className="situation-finder" aria-labelledby="situation-heading">
      <div className="section-head">
        <h2 id="situation-heading">상황 찾기</h2>
        <Link className="more" to="/atlas">전체 절차</Link>
      </div>
      <label className="situation-search">
        <ISearch />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="현재 상황" placeholder="예: 적 두 명과 싸우고 있다" />
      </label>
      <div className="situation-groups" role="group" aria-label="상황 범주">
        {SITUATION_GROUPS.map(({ id, label }) => (
          <button key={id} aria-pressed={!query.trim() && group === id} onClick={() => { setQuery(''); setGroup(id); }}>{label}</button>
        ))}
      </div>
      <div className="situation-list" aria-label="플레이 상황">
        {!matching.length && (
          <div className="empty finder-empty">
            <p>맞는 상황이 없습니다.</p>
            <button className="linkbtn" onClick={() => onSearch(query)}>전체 자료에서 검색</button>
          </div>
        )}
        {matching.map((item) => (
          <details className="situation-row" key={item.id}>
            <summary>{item.ko}<span aria-hidden="true" className="situ-chevron">›</span></summary>
            <div className="situation-detail">
              <p>{item.description}</p>
              <ul className="situation-links">
                {item.refs.map((id) => <li key={id}><XRef id={id} showKind /></li>)}
              </ul>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function LedgerItem({ id }: { id: string }) {
  const d = byId.get(id);
  if (!kindOf(id)) return null;
  const t = titleOf(id);
  return (
    <li>
      <Link to={hrefOf(id)}>
        <span className="lk">{d ? KIND_LABEL[d.kind] : ''}</span>
        <span className="lt">{t.ko}</span>
        {d && d.group !== KIND_LABEL[d.kind] && <span className="lr">{d.group}</span>}
      </Link>
    </li>
  );
}
