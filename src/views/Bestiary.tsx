import { useMemo } from 'react';
import { tableById } from '../content';
import { armorKo, creatures, PART_KO, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import { Link, navigate, useLocation } from '../lib/router';
import '../styles/bestiary.css';

/** Bestiary: every creature, Overseer and minion with the numbers you need at the table. */

type Group = 'creature' | 'overseer' | 'minion';
const GROUPS: { id: Group; ko: string }[] = [
  { id: 'creature', ko: '일반 생물' },
  { id: 'overseer', ko: 'Overseer' },
  { id: 'minion', ko: '소환수' },
];
const groupOf = (c: CreatureRecord): Group => (c.group === 'creature' ? 'creature' : c.group === 'minion' ? 'minion' : 'overseer');
const TYPES = Object.keys(TYPE_KO);

const SORTS = {
  name: { ko: '이름', key: (c: CreatureRecord) => c.name },
  health: { ko: 'Health', key: (c: CreatureRecord) => -num(c.health) },
  cs: { ko: 'Combat Skill', key: (c: CreatureRecord) => -num(c.combatSkill) },
  mr: { ko: 'Magic Resistance', key: (c: CreatureRecord) => -num(c.magicResistance) },
} as const;
type SortId = keyof typeof SORTS;

const num = (s: string) => parseInt(s, 10) || 0;
/** "8+4 per ⅃" → "8 +4/레벨" */
const health = (s: string) => s.replace(/\s*\+\s*(\d+)\s*per\s*⅃/, ' +$1/레벨').replace('⅃', '레벨');

// Which roll brings each creature up: Combat Encounters A/B (D6 1–3 → A, 4–6 → B, then D20), Overseer (D10).
const ROLLS = (() => {
  const out = new Map<string, string[]>();
  const add = (tableId: string, label: string) =>
    tableById.get(tableId)?.rows.forEach((r) =>
      r.next?.forEach((n) => out.set(n.id, [...(out.get(n.id) ?? []), `${label} ${r.min === r.max ? r.min : `${r.min}–${r.max}`}`])),
    );
  add('t-encounter-a', '조우 A');
  add('t-encounter-b', '조우 B');
  add('t-overseer', 'Overseer 표');
  return out;
})();
// Creatures that only appear through someone else
const SUMMONED_BY: Record<string, { label: string; href: string }[]> = {
  'cr-lesser-demon': [{ label: 'Infernal Archon 소환', href: '/ref/cr-infernal-archon' }],
  // only on the first-domain encounter table (D20: 1–7 / 8–14 / 15–20, p.244)
  'cr-blightfang-rats': [{ label: '도입 도메인 1–7', href: '/ref/first-domain-rules' }],
  'cr-skeletal-horrors': [{ label: '도입 도메인 8–14', href: '/ref/first-domain-rules' }],
  'cr-flesh-eater': [{ label: '도입 도메인 15–20', href: '/ref/first-domain-rules' }],
  'cr-arcane-companion': [{ label: 'Arcanist Tier 4', href: '/ref/m-arcanist' }],
  'cr-fire-elemental': [{ label: 'Flamecaster Tier 4', href: '/ref/m-flamecaster' }],
  'cr-frost-elemental': [{ label: 'Frostweaver Tier 4', href: '/ref/m-frostweaver' }],
  'cr-skeleton': [{ label: 'Gravecaller Tier 1', href: '/ref/m-gravecaller' }],
  'cr-wight': [{ label: 'Gravecaller Tier 4', href: '/ref/m-gravecaller' }],
};

export function Bestiary() {
  const { search } = useLocation();
  const g = search.get('g') as Group | null;
  const t = search.get('t');
  const s = (search.get('s') as SortId | null) ?? 'name';
  const sort = SORTS[s] ? s : 'name';
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(search);
    if (v) p.set(k, v);
    else p.delete(k);
    navigate(`/bestiary${p.toString() ? `?${p}` : ''}`, { replace: true, keepScroll: true });
  };
  const list = useMemo(() => {
    const key = SORTS[sort].key;
    return creatures
      .filter((c) => (!g || groupOf(c) === g) && (!t || c.types.includes(t)))
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        return typeof ka === 'number' && typeof kb === 'number' ? ka - kb || a.name.localeCompare(b.name) : String(ka).localeCompare(String(kb));
      });
  }, [g, t, sort]);
  const count = (x: Group) => creatures.filter((c) => groupOf(c) === x && (!t || c.types.includes(t))).length;

  return (
    <div className="bestiary">
      <header className="page-head">
        <h1 className="page-title">생물 도감</h1>
        <p className="lede">모든 생물·Overseer·소환수의 기본 수치와 등장 굴림. 수치는 레벨 적응 전 값이며, 이름을 누르면 행동 표와 특성 전체가 열립니다.</p>
      </header>

      <div className="filterbar" role="group" aria-label="분류">
        <button aria-pressed={!g} onClick={() => set('g', null)}>
          전체<span className="count">{creatures.filter((c) => !t || c.types.includes(t)).length}</span>
        </button>
        {GROUPS.map((x) => (
          <button key={x.id} aria-pressed={g === x.id} onClick={() => set('g', g === x.id ? null : x.id)}>
            {x.ko}
            <span className="count">{count(x.id)}</span>
          </button>
        ))}
      </div>
      <div className="filterbar" role="group" aria-label="유형">
        {TYPES.map((x) => (
          <button key={x} aria-pressed={t === x} onClick={() => set('t', t === x ? null : x)}>
            {TYPE_KO[x]}
          </button>
        ))}
      </div>
      <div className="bestiary-sort">
        <label htmlFor="bestiary-sort">정렬</label>
        <select id="bestiary-sort" value={sort} onChange={(e) => set('s', e.target.value === 'name' ? null : e.target.value)}>
          {(Object.keys(SORTS) as SortId[]).map((k) => (
            <option key={k} value={k}>
              {SORTS[k].ko}
              {k === 'name' ? '' : ' 높은 순'}
            </option>
          ))}
        </select>
        <span className="bestiary-count" role="status">
          {list.length}종
        </span>
      </div>

      {list.length === 0 ? (
        <p className="empty" role="status">
          이 조건에 맞는 생물이 없습니다.{' '}
          <button className="linkbtn" onClick={() => navigate('/bestiary', { replace: true, keepScroll: true })}>
            필터 모두 해제
          </button>
        </p>
      ) : (
        <table className="bestiary-table">
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">유형</th>
              <th scope="col" className="n">수</th>
              <th scope="col" className="n">Health</th>
              <th scope="col">Armor</th>
              <th scope="col" className="n">CS</th>
              <th scope="col" className="n">MR</th>
              <th scope="col">약점</th>
              <th scope="col">특성</th>
              <th scope="col">등장</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => {
              const rolls = ROLLS.get(c.id) ?? [];
              const via = SUMMONED_BY[c.id] ?? [];
              return (
                <tr key={c.id}>
                  <th scope="row" className="name">
                    <Link to={`/ref/${c.id}`}>{c.name}</Link>
                  </th>
                  <td data-label="유형">{c.types.map((x) => TYPE_KO[x] ?? x).join(' · ')}</td>
                  <td data-label="수" className="n">
                    {c.number}
                  </td>
                  <td data-label="Health" className="n">
                    {health(c.health)}
                  </td>
                  <td data-label="Armor">{armorKo(c.armor)}</td>
                  <td data-label="Combat Skill" className="n">
                    {c.combatSkill}
                  </td>
                  <td data-label="Magic Res." className="n">
                    {c.magicResistance}
                  </td>
                  <td data-label="약점" className="weak">{c.weakSpot ? (PART_KO.get(c.weakSpot) ?? c.weakSpot) : '—'}</td>
                  <td data-label="특성" className="traits">
                    {c.traits.length ? c.traits.join(', ') : '—'}
                  </td>
                  <td data-label="등장" className="rolls">
                    {rolls.join(' · ')}
                    {via.map((v, i) => (
                      <span key={v.href}>
                        {rolls.length || i ? ' · ' : ''}
                        <Link to={v.href}>{v.label}</Link>
                      </span>
                    ))}
                    {!rolls.length && !via.length && '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bestiary-foot">
        조우 굴림: D6 1–3이면 조우 A, 4–6이면 조우 B 표에서 D20. Overseer는 새 도메인에서 D10.{' '}
        <Link to="/oracle/t-encounter-general">조우 표 열기</Link>
      </p>
    </div>
  );
}
