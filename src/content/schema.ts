/**
 * Content schema for the Ossuary Index.
 *
 * Copyright rule (Gravebound Edition, p.4): mechanics may be used freely, but the
 * book's wording must not be copied or translated. Every `ko` string in this folder
 * is an original summary written for this app. Original English wording only ever
 * comes from the optional, git-ignored local overlay (src/local/source-overlay.json)
 * that a user generates from their own PDF.
 */

export type Book =
  | 'core' // Ker Nethalas — Gravebound Edition, Core Rulebook v1.2
  | 'rr' // Player Rules Reference (Gravebound Edition)
  | 'flow-combat' // Combat Flowchart (kernethalas.com)
  | 'flow-explore'; // Domain Exploration Loop (kernethalas.com)

export interface SourceRef {
  book: Book;
  pages: number[];
}

/**
 * verified    – checked line by line against Core v1.2
 * discrepancy – Core v1.2 checked; a secondary source (RR / flowchart) disagrees. Core wins; see notes.
 * ambiguous   – the rule text leaves a case open; the app does not fill the gap
 * partial     – structure verified, some fields intentionally omitted (e.g. creature action text)
 * pending     – indexed only; summary not written yet
 */
export type Verification = 'verified' | 'discrepancy' | 'ambiguous' | 'partial' | 'pending';

export type Category =
  | 'core'
  | 'combat'
  | 'conditions'
  | 'health'
  | 'exploration'
  | 'survival'
  | 'creatures'
  | 'overseers'
  | 'equipment'
  | 'loot'
  | 'character';

export type EntryKind = 'rule' | 'condition' | 'trait' | 'creature' | 'item' | 'term' | 'mastery';

/**
 * Relations are only recorded when the source itself links the two topics
 * (basis: 'source'), or flagged as an editorial cross-reference (basis: 'editorial')
 * so the UI never presents an inferred link as an official one.
 */
export type RelationStrength = 'required' | 'conditional' | 'optional';
export interface Relation {
  id: string;
  strength: RelationStrength;
  basis: 'source' | 'editorial';
  note?: string;
}

export interface Note {
  type: 'discrepancy' | 'ambiguity' | 'clarification' | 'optional-rule';
  text: string;
  source?: SourceRef;
}

export interface Entry {
  id: string;
  kind: EntryKind;
  category: Category;
  en: string;
  ko: string;
  /** extra search terms, Korean and English */
  aliases: string[];
  tags?: string[];
  summary: string;
  /** 적용 시점 */
  when?: string;
  /** 판정 방식 */
  resolution?: string[];
  /** 결과별 효과 */
  /** meta: short usage line shown above the text (action type · cost · requirement) */
  outcomes?: { label: string; text: string; meta?: string }[];
  /** 세부 사항 */
  details?: string[];
  /** 예외 및 주의 */
  exceptions?: string[];
  notes?: Note[];
  tables?: string[];
  procedures?: string[];
  related: Relation[];
  source: SourceRef[];
  verification: Verification;
  /** creature or item structured stats */
  stats?: Record<string, string>;
}

export interface TableRow {
  min: number;
  max: number;
  /** short English label from the book (names only, never sentences) */
  label?: string;
  /** original Korean summary */
  ko: string;
  /** follow-up tables / entries this result points to, as stated by the book */
  next?: { id: string; note?: string }[];
  /** extra columns, e.g. avoidance skill for Traps */
  cols?: Record<string, string>;
}

export type TableMode =
  /** rows hold full Korean summaries */
  | 'summary'
  /** flavor text: only the number and a page pointer are shipped publicly */
  | 'local-only';

export interface OracleTable {
  id: string;
  en: string;
  ko: string;
  aliases: string[];
  dice: string; // 'D4' | 'D6' | 'D8' | 'D10' | 'D20' | 'D100'
  group: 'exploration' | 'combat' | 'survival' | 'loot' | 'magic-items' | 'creatures' | 'character' | 'flavor';
  usage: string;
  mode: TableMode;
  /** row labels are only the English for the Korean text: show the Korean alone */
  gloss?: boolean;
  columns?: { key: string; ko: string }[];
  rows: TableRow[];
  related: Relation[];
  source: SourceRef[];
  verification: Verification;
  notes?: Note[];
}

export type NodeKind = 'start' | 'step' | 'check' | 'branch' | 'outcome' | 'table' | 'loop' | 'note';

export interface ProcNode {
  id: string;
  kind: NodeKind;
  title: string;
  en?: string;
  body: string;
  /** grid placement for the plan drawing: column (0..), row (0..) */
  col: number;
  row: number;
  span?: number;
  refs?: string[]; // reference entry or procedure IDs
  tables?: string[]; // table ids
  /** 필수 / 조건부 / 선택 */
  need?: 'required' | 'conditional' | 'optional';
}

export interface ProcEdge {
  from: string;
  to: string;
  label?: string;
}

export interface Procedure {
  id: string;
  en: string;
  ko: string;
  aliases: string[];
  situation: string;
  summary: string;
  group: 'combat' | 'exploration' | 'survival' | 'loot';
  cols: number;
  nodes: ProcNode[];
  edges: ProcEdge[];
  source: SourceRef[];
  verification: Verification;
  notes?: Note[];
}

export interface Ruling {
  id: string;
  q: string;
  qEn?: string;
  aliases: string[];
  answer: string;
  conditions?: string[];
  exceptions?: string[];
  matrix?: { head: string[]; rows: string[][]; caption?: string };
  refs: string[];
  tables?: string[];
  source: SourceRef[];
  verification: Verification;
}
