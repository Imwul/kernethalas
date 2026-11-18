/**
 * Bilingual full-text search over all content. No dependencies.
 * - Korean/English normalisation, space-insensitive matching
 * - Hangul initial-consonant (초성) matching, e.g. "ㄴㅇㅈ" → 넘어짐
 * - typo tolerance for Latin tokens and curated play-time phrases
 */
import { entries, tables, procedures, rulings, CATEGORY_LABEL, TABLE_GROUP_LABEL } from '../content';
import { CREATURE_NAME_ALIASES } from '../content/creature-names';
import { phoneticAliases } from './phonetic';
import { situations } from '../content/situations';

export type DocKind = 'rule' | 'condition' | 'trait' | 'creature' | 'item' | 'term' | 'mastery' | 'table' | 'procedure' | 'ruling';

export const SEARCH_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'reference', label: '규칙' },
  { id: 'table', label: '표' },
  { id: 'procedure', label: '절차' },
] as const;

export type SearchFilter = (typeof SEARCH_FILTERS)[number]['id'];

export interface Doc {
  id: string;
  kind: DocKind;
  ko: string;
  en: string;
  summary: string;
  group: string;
  title: string; // normalised
  titleCho: string;
  aliases: string[]; // normalised
  aliasCho: string[];
  body: string; // normalised
  lines: { text: string; normalized: string }[];
  typoWords: string[];
}

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my',
  'of', 'on', 'should', 'that', 'the', 'to', 'what', 'when', 'where', 'which', 'with', 'you',
  '때', '방법', '상황', '어떻게', '언제', '무엇', '하나요', '되나요', '하고', '해요', '합니다',
  '은', '는', '이', '가', '을', '를', '와', '과', '의', '에', '에서', '으로', '로',
]);

function fold(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[’'`´]/g, '');
}

export function norm(value: string): string {
  return fold(value).replace(/[^\p{L}\p{N}]+/gu, '');
}

function words(value: string): string[] {
  return fold(value).match(/[\p{Script=Latin}\p{N}]+|\p{Script=Hangul}+|[\p{L}\p{N}]+/gu) ?? [];
}

function queryTokens(query: string): string[] {
  const tokens = [...new Set(words(query))];
  const significant = tokens.filter((token) => !STOP_WORDS.has(token));
  return significant.length ? significant : tokens;
}

function tokenForms(token: string): string[] {
  const stem = token.replace(/(?<=[가-힣]{2})(?:하나요|하려고|하려면|해야|했어요|했다|에서|에게|으로|까지|의|에|은|는|이|가|을|를|와|과|로)$/u, '');
  return stem !== token ? [token, stem] : [token];
}

export function searchTerms(query: string): string[] {
  return [...new Set(queryTokens(query).flatMap(tokenForms))];
}

export function chosung(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)];
    else if (c >= 0x1100 && c <= 0x1112) out += CHO[c - 0x1100];
    else if (/[ㄱ-ㅎ]/.test(ch)) out += ch;
  }
  return out;
}
const isChoQuery = (q: string) => /^[ㄱ-ㅎᄀ-ᄒ]+$/.test(q);

function oneTypo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)) return true;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const creatureNameIndex = entries.filter(({ kind }) => kind === 'creature').map(({ id, en, ko }) => {
  const names = [en, ko, ...(CREATURE_NAME_ALIASES[id] ?? [])];
  return {
    id,
    normalized: names.map(norm),
    initials: names.map(chosung).filter(Boolean),
    englishWords: words(en),
  };
});

export function findCreatureNames(query: string): string[] {
  const compact = query.replace(/\s/g, '');
  const whole = norm(query);
  if (!whole) return [];
  const initials = isChoQuery(compact) ? chosung(compact) : '';
  return creatureNameIndex.filter((entry) => (
    entry.normalized.some((name) => name.includes(whole)) ||
    (initials && entry.initials.some((name) => name.startsWith(initials))) ||
    (/^[a-z]{4,}$/.test(whole) && entry.englishWords.some((word) => oneTypo(word, whole)))
  )).map(({ id }) => id);
}

const EXTRA_ALIASES: Record<string, string[]> = {
  'attack-check': ['defense', 'defence', 'incoming attack', 'defensive check'],
  armor: ['armour', 'armor reduction', 'armour reduction', '아머'],
  'damage-pool': ['dmg', 'damage roll'],
  initiative: ['init'],
  'hit-location': ['hit loc'],
  advantage: ['adv', 'disadv'],
  't-defensive-move-pc': ['pc defensive move', 'player defensive move'],
  't-defensive-move-npc': ['npc defensive move', 'enemy defensive move'],
};

function mk(id: string, kind: DocKind, ko: string, en: string, aliases: string[], summary: string, body: string[], group: string): Doc {
  const names = [...aliases, ...(EXTRA_ALIASES[id] ?? [])];
  // Hangul spellings of English terms ("프론" → Prone); kept out of the initials index to avoid noise
  const sounds = phoneticAliases([en, ...names]);
  const lines = [...new Set([summary, ...body].filter(Boolean))];
  return {
    id,
    kind,
    ko,
    en,
    summary,
    group,
    title: norm(ko) + '|' + norm(en),
    titleCho: chosung(ko),
    aliases: [...names, ...sounds].map(norm).filter(Boolean),
    aliasCho: names.map(chosung).filter(Boolean),
    body: norm(lines.join(' ')),
    lines: lines.map((line) => ({ text: line, normalized: norm(line) })),
    typoWords: [...new Set([ko, en, ...names].flatMap(words).filter((word) => /^[a-z]{4,}$/.test(word)))],
  };
}

export const docs: Doc[] = [
  ...entries.map((e) =>
    mk(
      e.id,
      e.kind,
      e.ko,
      e.en,
      e.aliases,
      e.summary,
      [
        e.when ?? '',
        ...(e.resolution ?? []),
        ...(e.outcomes ?? []).map((o) => `${o.label} · ${o.text}`),
        ...(e.details ?? []),
        ...(e.exceptions ?? []),
        ...Object.values(e.stats ?? {}),
      ],
      CATEGORY_LABEL[e.category]?.ko ?? e.category,
    ),
  ),
  ...tables.map((t) =>
    mk(
      t.id, 'table', t.ko, t.en, t.aliases, t.usage,
      t.rows.flatMap((row) => [
        row.label && row.label !== row.ko ? `${row.label} · ${row.ko}` : row.ko,
        ...Object.values(row.cols ?? {}),
      ]),
      TABLE_GROUP_LABEL[t.group] ?? t.group,
    ),
  ),
  ...procedures.map((p) =>
    mk(p.id, 'procedure', p.ko, p.en, [...p.aliases, p.situation], p.summary, p.nodes.flatMap((n) => [n.title, n.en ?? '', n.body]), '절차'),
  ),
  ...rulings.map((r) =>
    mk(r.id, 'ruling', r.q, r.qEn ?? '', r.aliases, r.answer, [...(r.conditions ?? []), ...(r.exceptions ?? []), ...(r.matrix?.rows.flat() ?? [])], '판정 문답'),
  ),
];

export interface Hit {
  doc: Doc;
  score: number;
  snippet: string;
}

const KIND_BOOST: Partial<Record<DocKind, number>> = { rule: 4, condition: 6, procedure: 3, table: 2, ruling: 2, creature: -2 };

const situationIndex = situations.map((situation) => ({
  situation,
  phrases: [situation.ko, situation.en, ...situation.aliases].map((text) => ({
    normalized: norm(text),
    tokens: queryTokens(text),
    isPhrase: words(text).length > 1,
  })),
}));

function situationMatches(query: string) {
  const whole = norm(query);
  if (!whole) return [];
  const tokens = queryTokens(query).map(tokenForms);
  return situationIndex
    .map(({ situation, phrases }) => {
      let score = 0;
      let relevantPhrase = false;
      for (const phrase of phrases) {
        if (phrase.normalized === whole) {
          score = Math.max(score, 100);
          relevantPhrase ||= phrase.isPhrase;
        } else if (phrase.isPhrase && whole.includes(phrase.normalized)) {
          score = Math.max(score, 85 + Math.min(phrase.normalized.length, 14));
          relevantPhrase = true;
        } else if (phrase.normalized.startsWith(whole)) {
          score = Math.max(score, 65);
        } else if (whole.length > 1 && phrase.normalized.includes(whole)) {
          score = Math.max(score, 45);
        } else if (tokens.every((forms) => forms.some((token) => phrase.normalized.includes(token)))) {
          score = Math.max(score, 40);
          relevantPhrase ||= tokens.length > 1;
        } else if (tokens.length === 1 && /^[a-z]{4,}$/.test(tokens[0][0]) && phrase.tokens.some((token) => oneTypo(tokens[0][0], token))) {
          score = Math.max(score, 20);
        }
      }
      return { situation, score, relevantPhrase };
    })
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function findSituations(query: string) {
  return query.trim() ? situationMatches(query).map((match) => match.situation) : situations;
}

function passesFilter(kind: DocKind, filter: SearchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'reference') return kind !== 'table' && kind !== 'procedure';
  return kind === filter;
}

function snippetFor(doc: Doc, tokens: string[][], whole: string): string {
  let best = doc.summary;
  let bestScore = 0;
  for (const line of doc.lines) {
    const phraseScore = whole.length >= 5 && line.normalized.includes(whole) ? 3 : 0;
    const score = phraseScore + tokens.filter((forms) => forms.some((token) => line.normalized.includes(token))).length;
    if (score > bestScore) {
      best = line.text;
      bestScore = score;
    }
  }
  if (best.length <= 145) return best;
  const lower = fold(best);
  const matchedIndex = tokens.flat().map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, matchedIndex - 40);
  return `${start ? '…' : ''}${best.slice(start, start + 145).trim()}…`;
}

export function search(query: string, limit = 40, filter: SearchFilter = 'all'): Hit[] {
  const raw = query.trim();
  const whole = norm(raw);
  if (!whole) return [];
  const tokens = queryTokens(raw).map(tokenForms);
  const compact = raw.replace(/\s/g, '');
  const cho = isChoQuery(compact) ? chosung(compact) : '';
  const contextual = new Map<string, number>();
  for (const { situation, score, relevantPhrase } of situationMatches(raw)) {
    if (!relevantPhrase) continue;
    situation.refs.forEach((id, index) => {
      contextual.set(id, Math.max(contextual.get(id) ?? 0, score + 22 - index * 17));
    });
  }
  const hits: Omit<Hit, 'snippet'>[] = [];
  for (const d of docs) {
    if (!passesFilter(d.kind, filter)) continue;
    let score = contextual.get(d.id) ?? 0;
    const [tko, ten] = d.title.split('|');
    if (whole === tko || whole === ten) score += 120;
    else if (tko.startsWith(whole) || ten.startsWith(whole)) score += 70;
    else if (d.title.includes(whole)) score += 45;
    if (d.aliases.includes(whole)) score += 90;
    else if (d.aliases.some((a) => a.startsWith(whole))) score += 40;
    let choHit = false;
    if (cho) {
      if (d.titleCho.startsWith(cho)) score += 60;
      else if (d.aliasCho.some((a) => a.startsWith(cho))) score += 50; // e.g. ㅎㅇㅅㅅ → alias 화염술사 on "Flamecaster"
      else if (d.titleCho.includes(cho)) score += 30;
      choHit = score > 0;
    }
    // the exact phrase inside the body (e.g. a creature action name) beats scattered word hits
    if (whole.length >= 6 && !d.title.includes(whole) && d.body.includes(whole)) score += 24;
    let all = true;
    for (const forms of tokens) {
      if (forms.some((t) => d.title.includes(t))) score += 18;
      else if (forms.some((t) => d.aliases.some((a) => a.includes(t)))) score += 14;
      else if (forms.some((t) => d.body.includes(t))) score += 4;
      else if (/^[a-z]{4,}$/.test(forms[0]) && d.typoWords.some((word) => oneTypo(word, forms[0]))) score += 10;
      else all = false;
    }
    if (!all && !choHit && score < 40) continue;
    if (score <= 0) continue;
    hits.push({ doc: d, score: score + (KIND_BOOST[d.kind] ?? 0) });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.doc.ko.localeCompare(b.doc.ko))
    .slice(0, limit)
    .map((hit) => ({ ...hit, snippet: snippetFor(hit.doc, tokens, whole) }));
}

const FALLBACK_QUERIES: Record<SearchFilter, string[]> = {
  all: ['prone', 'attack-check', 't-growing-darkness'],
  reference: ['prone', 'attack-check', 'armor'],
  table: ['t-growing-darkness', 't-defensive-move-pc', 't-room-shape'],
  procedure: ['p-attack', 'p-explore-room', 'p-tension'],
};

const docsById = new Map(docs.map((doc) => [doc.id, doc]));

export function querySuggestions(query: string, filter: SearchFilter = 'all', limit = 3): string[] {
  const terms = searchTerms(query).filter((term) => term.length > 1);
  const hits = terms
    .flatMap((term) => search(term, limit, filter))
    .filter((hit) => hit.score >= 10)
    .sort((a, b) => b.score - a.score)
    .map((hit) => hit.doc);
  const suggested = hits.length ? hits : FALLBACK_QUERIES[filter].map((id) => docsById.get(id)!);
  const korean = /[ㄱ-ㅎ가-힣ᄀ-ᄒ]/.test(query);
  const original = norm(query);
  const titles = suggested.map((doc) => (korean ? doc.ko : doc.en || doc.ko)).filter((title) => norm(title) !== original);
  return [...new Set(titles)].slice(0, limit);
}

export const KIND_LABEL: Record<DocKind, string> = {
  rule: '규칙',
  condition: '상태',
  trait: '특성',
  creature: '생물',
  item: '아이템',
  term: '용어',
  mastery: 'Mastery',
  table: '표',
  procedure: '절차',
  ruling: '문답',
};
