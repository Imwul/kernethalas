import { useContext, useId, useMemo, useRef, useState } from 'react';
import { entryById, hrefOf, tableById } from '../content';
import { armorKo, creatureName, creatures, PART_KO, TYPE_KO, type CreatureRecord } from '../content/entries/creatures';
import { bestiaryEncounterHref } from '../lib/bestiary-encounter';
import { tableSides } from '../lib/dice';
import { readOracleValue } from '../lib/oracle';
import { Link, navigate, useLocation } from '../lib/router';
import { findCreatureNames } from '../lib/search';
import { ContextLink, ReferenceContext } from '../components/ReferenceContext';
import { ISearch } from '../components/icons';
import '../styles/bestiary.css';
import { ChoiceButtons } from '../components/ChoiceButtons';

/** Bestiary: every creature, Overseer and minion with the numbers you need at the table. */

type Group = CreatureRecord['group'];
const GROUPS: { id: Group; ko: string }[] = [
  { id: 'creature', ko: '일반 생물' },
  { id: 'overseer', ko: 'Overseer' },
  { id: 'overseer-summon', ko: 'Overseer 소환수' },
  { id: 'minion', ko: '소환수' },
];
const TYPES = Object.keys(TYPE_KO);

const LOOKUP_TABLES = [
  { id: 't-encounter-a', label: '조우 A' },
  { id: 't-encounter-b', label: '조우 B' },
  { id: 't-overseer', label: 'Overseer' },
] as const;
type LookupId = (typeof LOOKUP_TABLES)[number]['id'];

const formatRange = ({ min, max }: { min: number; max: number }) => min === max ? String(min) : `${min}–${max}`;
const encounterChoice = tableById.get('t-encounter-general');
const rollHint = (tableId: LookupId) => {
  const row = encounterChoice?.rows.find((result) => result.next?.some((next) => next.id === tableId));
  if (row && encounterChoice) return `${encounterChoice.dice} ${formatRange(row)}`;
  return tableById.get(tableId)?.dice;
};

const SORTS = {
  name: { ko: '이름', key: (c: CreatureRecord) => creatureName(c) },
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
  for (const { id, label } of LOOKUP_TABLES) {
    for (const row of tableById.get(id)?.rows ?? []) {
      for (const { id: target } of row.next ?? []) {
        out.set(target, [...(out.get(target) ?? []), `${label} ${formatRange(row)}`]);
      }
    }
  }
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

function EncounterLookup({ group }: { group: Group | null }) {
  const preview = useContext(ReferenceContext);
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const submit = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState<LookupId | null>(null);
  const [roll, setRoll] = useState('');
  const [issue, setIssue] = useState<{ tableId: LookupId; message: string } | null>(null);
  const tableId = selected ?? (group === 'overseer' ? 't-overseer' : 't-encounter-a');
  const table = tableById.get(tableId)!;
  const sides = tableSides(table.dice);
  const error = issue?.tableId === tableId ? issue.message : '';

  return (
    <section className="bestiary-lookup" aria-labelledby={`${id}-title`}>
      <div className="bestiary-lookup-head">
        <h2 id={`${id}-title`}>굴림 번호로 찾기</h2>
        <Link to={hrefOf(tableId)}>전체 표</Link>
      </div>
      <form noValidate onSubmit={(event) => {
        event.preventDefault();
        const value = readOracleValue(roll.trim(), sides);
        if (value === null) {
          setIssue({ tableId, message: `1에서 ${sides} 사이의 정수를 입력하세요.` });
          input.current?.focus();
          return;
        }
        const row = table.rows.find(({ min, max }) => min <= value && value <= max);
        const creature = row?.next?.find((target) => entryById.get(target.id)?.kind === 'creature');
        if (table.verification !== 'verified' || !creature) {
          setIssue({ tableId, message: '해당 번호의 생물을 확인할 수 없습니다. 전체 표에서 확인하세요.' });
          return;
        }
        setIssue(null);
        if (preview) preview(creature.id, { opener: submit.current ?? undefined });
        else navigate(hrefOf(creature.id));
      }}>
        <div className="bestiary-lookup-tables" role="group" aria-label="조회 표">
          {LOOKUP_TABLES.map(({ id: choice, label }) => (
            <button key={choice} type="button" aria-pressed={tableId === choice} onClick={() => {
              setSelected(choice);
              setIssue(null);
            }}>
              <span>{label}</span>
              <span className="bestiary-lookup-hint">{rollHint(choice)}</span>
            </button>
          ))}
        </div>
        <div className="bestiary-lookup-entry">
          <div>
            <label htmlFor={`${id}-roll`}>{table.dice} 결과</label>
            <input
              id={`${id}-roll`}
              ref={input}
              inputMode="numeric"
              autoComplete="off"
              placeholder={`1–${sides}`}
              value={roll}
              onChange={(event) => {
                setRoll(event.target.value);
                setIssue(null);
              }}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </div>
          <button ref={submit} className="btn primary" type="submit">생물 열기</button>
        </div>
        {error && <p className="field-err" id={`${id}-error`} role="alert">{error}</p>}
      </form>
    </section>
  );
}

export function Bestiary() {
  const { search } = useLocation();
  const g = search.get('g') as Group | null;
  const t = search.get('t');
  const query = search.get('q') ?? '';
  const nameInput = useRef<HTMLInputElement>(null);
  const s = (search.get('s') as SortId | null) ?? 'name';
  const sort = Object.hasOwn(SORTS, s) ? s : 'name';
  const set = (changes: Record<string, string | null>) => {
    const p = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    navigate(`/bestiary${p.toString() ? `?${p}` : ''}`, { replace: true, keepScroll: true });
  };
  const matching = useMemo(() => {
    const names = query.trim() ? new Set(findCreatureNames(query)) : null;
    return creatures.filter((c) => (!t || c.types.includes(t)) && (!names || names.has(c.id)));
  }, [query, t]);
  const list = useMemo(() => {
    const key = SORTS[sort].key;
    return matching
      .filter((c) => !g || c.group === g)
      .sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        return typeof ka === 'number' && typeof kb === 'number' ? ka - kb || a.name.localeCompare(b.name) : String(ka).localeCompare(String(kb));
      });
  }, [g, matching, sort]);
  const count = (x: Group) => matching.filter((c) => c.group === x).length;

  return (
    <div className="bestiary">
      <header className="page-head">
        <h1 className="page-title">생물 도감</h1>
        <p className="lede">모든 생물·Overseer·소환수의 기본 수치와 등장 굴림. 수치는 레벨 적응 전 값이며, 이름을 누르면 행동 표와 특성 전체가 열립니다.</p>
      </header>

      <div className="bestiary-name-search">
        <label className="situation-search">
          <ISearch />
          <input
            ref={nameInput}
            type="search"
            aria-label="생물 이름 검색"
            placeholder="생물 이름 (necro, 네크로피드)"
            value={query}
            onChange={(event) => set({ q: event.target.value })}
          />
        </label>
        {query && <button type="button" className="btn ghost" aria-label="이름 검색어 지우기" onClick={() => {
          set({ q: null });
          nameInput.current?.focus();
        }}>지우기</button>}
      </div>

      <EncounterLookup group={g} />

      <div className="filterbar" role="group" aria-label="분류">
        <button aria-pressed={!g} onClick={() => set({ g: null })}>
          전체<span className="count">{matching.length}</span>
        </button>
        {GROUPS.map((x) => (
          <button key={x.id} aria-pressed={g === x.id} onClick={() => set({ g: g === x.id ? null : x.id })}>
            {x.ko}
            <span className="count">{count(x.id)}</span>
          </button>
        ))}
      </div>
      <div className="filterbar" role="group" aria-label="유형">
        {TYPES.map((x) => (
          <button key={x} aria-pressed={t === x} onClick={() => set({ t: t === x ? null : x })}>
            {TYPE_KO[x]}
          </button>
        ))}
      </div>
      <div className="bestiary-sort">
        <ChoiceButtons label="정렬" value={sort} onChange={(next) => set({ s: next === 'name' ? null : next })}
          options={(Object.keys(SORTS) as SortId[]).map((k) => ({ value: k, label: k === 'name' ? SORTS[k].ko : `${SORTS[k].ko} 높은 순` }))} />
        <span className="bestiary-count" role="status">
          {list.length}종
        </span>
      </div>

      {list.length === 0 ? (
        <p className="empty" role="status">
          이 조건에 맞는 생물이 없습니다.{' '}
          {(g || t) && <button className="linkbtn" onClick={() => set({ g: null, t: null })}>
            필터 모두 해제
          </button>}
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
                    <ContextLink id={c.id}>{creatureName(c)}</ContextLink>
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
                    <div className="bestiary-creature-actions">
                      <span>
                        {rolls.join(' · ')}
                        {via.map((v, i) => (
                          <span key={v.href}>
                            {rolls.length || i ? ' · ' : ''}
                            <Link to={v.href}>{v.label}</Link>
                          </span>
                        ))}
                        {!rolls.length && !via.length && '—'}
                      </span>
                      <Link className="bestiary-encounter-link" to={bestiaryEncounterHref(c.id)}
                        aria-label={`${creatureName(c)} 조우에 추가`}>조우에 추가</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="bestiary-foot">
        <Link to="/oracle/t-encounter-general">조우 표 열기</Link>
      </p>
    </div>
  );
}
