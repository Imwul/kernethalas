import { useState } from 'react';
import { entries, tables, procedures, rulings, CATEGORY_LABEL, entryById, kindOf, tableById, titleOf } from '../content';
import { coreTableIndex } from '../content/core-table-index';
import { creatures } from '../content/entries/creatures';
import { masteryIds } from '../content/entries/masteries';
import { overlay } from '../lib/overlay';
import { V_LABEL, XRef } from '../components/bits';
import { ISearch } from '../components/icons';
import type { Verification } from '../content/schema';
import '../styles/sources.css';

const STATUSES: { id: Verification; label: string }[] = [
  { id: 'verified', label: '대조' },
  { id: 'discrepancy', label: '불일치' },
  { id: 'ambiguous', label: '불명확' },
  { id: 'partial', label: '일부' },
  { id: 'pending', label: '대기' },
];

const all = [...entries, ...tables, ...procedures, ...rulings];
const creatureActions = creatures.reduce((count, creature) => count + creature.actions.length, 0);
const flagged = all.flatMap((item) => {
  if (item.verification === 'discrepancy' || item.verification === 'ambiguous') return [{ id: item.id, label: V_LABEL[item.verification] }];
  const issue = 'notes' in item && item.notes?.find(({ type }) => type === 'ambiguity' || type === 'discrepancy');
  return issue ? [{ id: item.id, label: V_LABEL[issue.type === 'ambiguity' ? 'ambiguous' : 'discrepancy'] }] : [];
});
const totals: [string, { verification: Verification }[]][] = [
  ...Object.entries(CATEGORY_LABEL).map(([id, label]): [string, typeof entries] => [label.ko, entries.filter((entry) => entry.category === id)]),
  ['오라클·조회표', tables],
  ['절차 도해', procedures],
  ['판정 문답', rulings],
];
const chapters = [
  { title: '기본 개념', pages: '9–13', refs: ['dice-notation', 'game-terms'] },
  { title: '캐릭터 생성과 성장', pages: '15–67', refs: ['character-creation', 'masteries', 'leveling-up', 'personal-goals', 'starting-a-run'] },
  { title: '판정·전투·생존', pages: '69–93', refs: ['skill-check', 'p-combat-round', 'conditions', 'bandage-treatment', 'lingering-damage', 'sanity'] },
  { title: '지하 탐험', pages: '95–127', refs: ['p-explore-room', 'p-locks-traps', 'p-tension', 'setting-camp'] },
  { title: '조우와 생물', pages: '129–203', refs: ['encounter-setup', 'creature-stat-block', 'creature-traits', 'ruthlessness', 'overseers'] },
  { title: '장비와 전리품', pages: '205–241', refs: ['encumbrance', 'spoils', 'magic-item-generation', 'relics', 'container-relics'] },
  { title: '도입 도메인', pages: '243–246', refs: ['first-domain-rules'] },
];
const indexedTables = coreTableIndex.map((item) => ({
  ...item,
  searchTitles: [item.title, ...item.refs.map((id) => titleOf(id).ko)].map((title) => title.toLowerCase()),
  searchablePages: new Set([
    ...item.pages,
    ...item.refs.flatMap((id) => (tableById.get(id) ?? entryById.get(id))?.source.filter((source) => source.book === 'core').flatMap((source) => source.pages) ?? []),
  ]),
}));

function TableIndex() {
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const page = term.match(/^(?:p\.?\s*)?(\d+)(?:\s*쪽)?$/i)?.[1];
  const filtered = indexedTables.filter(({ searchTitles, searchablePages }) => (
    page ? searchablePages.has(Number(page)) : !term || searchTitles.some((title) => title.includes(term))
  ));
  const linked = coreTableIndex.filter(({ refs }) => refs.length && refs.every((id) => kindOf(id))).length;
  return (
    <section id="core-table-index" className="sources-section" aria-labelledby="table-index-heading">
      <h2 id="table-index-heading">룰북 표 색인</h2>
      <p>코어북 247쪽의 표 항목 {coreTableIndex.length}개 중 {linked}개를 앱의 규칙 또는 표에 연결했습니다. 같은 표를 가리키는 항목도 있습니다.</p>
      <label className="situation-search source-search">
        <ISearch />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 방어, Relics, 240" aria-label="색인 표 이름 또는 쪽수" />
      </label>
      {term && <p className="source-count" role="status">{filtered.length ? `${filtered.length}개 항목` : '해당 이름이나 쪽수의 색인 항목이 없습니다.'}</p>}
      <ul className="source-register">
        {filtered.map(({ title, pages, refs, note }) => {
          const pageOnly = refs.some((id) => tableById.get(id)?.mode === 'local-only');
          return (
            <li key={title}>
              <span className="source-pages">{pages.join('·')}쪽</span>
              <div className="source-line-content">
                <h3 lang="en">{title}</h3>
                <div className="source-refs">{refs.filter(kindOf).map((id) => <XRef key={id} id={id} />)}</div>
                {pageOnly && <p className="source-entry-note">묘사 본문은 표시된 원본 쪽수에서 확인할 수 있습니다.</p>}
                {note && <p className="source-entry-note">{note}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Sources() {
  return (
    <div className="sources-page">
      <header className="page-head">
        <h1 className="page-title">출처와 수록 범위</h1>
        <p className="lede">기준 판본은 Blackoath Entertainment의 Gravebound Edition v1.2입니다.</p>
        <nav className="source-jumps" aria-label="출처 화면 목차">
          <a href="#core-chapters">장별 찾아보기</a>
          <a href="#core-table-index">룰북 표 색인</a>
          <a href="#coverage-status">검증 현황</a>
        </nav>
      </header>

      <section id="core-chapters" className="sources-section" aria-labelledby="core-chapters-heading">
        <h2 id="core-chapters-heading">장별 찾아보기</h2>
        <p>룰북의 순서대로 주요 규칙을 엽니다. 각 규칙에는 인용한 쪽수와 검증 상태가 표시됩니다.</p>
        <ul className="source-register">
          {chapters.map(({ title, pages, refs }) => (
            <li key={title}>
              <span className="source-pages">{pages}쪽</span>
              <div className="source-line-content">
                <h3>{title}</h3>
                <div className="source-refs">{refs.map((id) => <XRef key={id} id={id} />)}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <TableIndex />

      <section id="coverage-status" className="sources-section" aria-labelledby="coverage-status-heading">
        <h2 id="coverage-status-heading">검증 현황</h2>
        <table className="cov">
          <caption className="sr-only">분류별 항목 수와 원문 검증 상태</caption>
          <thead>
            <tr>
              <th scope="col">구분</th>
              <th scope="col" className="n">합계</th>
              {STATUSES.map(({ id, label }) => (
                <th key={id} scope="col" className="n" title={V_LABEL[id]} aria-label={V_LABEL[id]}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totals.map(([name, items]) => <CoverageRow key={name} name={name} items={items} />)}
          </tbody>
          <tfoot><CoverageRow name="전체" items={all} /></tfoot>
        </table>
        <ul className="bullets source-notes">
          <li>Mastery {masteryIds.length}종의 Feature와 Tier 1–5 능력, 생물 {creatures.length}종의 수치와 행동 {creatureActions}개의 요약을 제공합니다.</li>
          <li>도입 도메인의 시작 불이익과 전용 조우는 플레이 화면에서 굴릴 수 있습니다. 고정 지도와 방별 지시는 보유한 코어북 PDF를 열어 243–246쪽을 확인하세요.</li>
          <li>방·통로 모양 100종은 종류와 출입구 수에 맞춘 지도 예시를 제공합니다. 출입구 배치는 작성 중인 지도에 맞춰 바꿀 수 있습니다.</li>
          <li>방 묘사 100건과 통로 묘사 20건은 한국어로 요약했습니다. 다른 분위기 표는 각 표에 표시된 수록 범위와 출처를 확인하세요.</li>
        </ul>
      </section>

      <section className="sources-section" aria-labelledby="flagged-heading">
        <h2 id="flagged-heading">불일치와 불명확 항목</h2>
        <ul className="source-register flagged-register">
          {flagged.map((item) => (
            <li key={item.id}>
              <span className="source-pages">{item.label}</span>
              <XRef id={item.id} showKind />
            </li>
          ))}
        </ul>
      </section>

      <section className="sources-section" aria-labelledby="source-method-heading">
        <h2 id="source-method-heading">인용과 검증 기준</h2>
        <ul className="bullets">
          <li>코어북에 더해 공식 Player Rules Reference, Combat Flowchart, Domain Exploration Loop를 참고합니다. 보조 자료와 차이가 있을 때는 코어북을 기준으로 설명하고 차이를 표시합니다.</li>
          <li>규칙의 문장은 메커니즘을 새로 요약한 것입니다. 본인 PDF에서 만든 로컬 원문 오버레이는 현재 {overlay ? '활성 상태' : '비활성 상태'}입니다.</li>
          <li>빌드에서는 표 범위의 누락·중복, 주사위식, 연결 대상, 절차 그래프, 생물 행동 범위를 자동 검사합니다.</li>
        </ul>
      </section>
    </div>
  );
}

function CoverageRow({ name, items }: { name: string; items: { verification: Verification }[] }) {
  return (
    <tr>
      <th scope="row">{name}</th>
      <td className="n">{items.length}</td>
      {STATUSES.map(({ id }) => <td key={id} className="n">{items.filter((item) => item.verification === id).length || '·'}</td>)}
    </tr>
  );
}
