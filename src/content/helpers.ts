import type { Relation, SourceRef } from './schema';

export const core = (...pages: number[]): SourceRef => ({ book: 'core', pages });
export const rr = (...pages: number[]): SourceRef => ({ book: 'rr', pages });
export const flowCombat: SourceRef = { book: 'flow-combat', pages: [1] };
export const flowExplore: SourceRef = { book: 'flow-explore', pages: [1] };

/** the book says you must consult this */
export const req = (id: string, note?: string): Relation => ({ id, strength: 'required', basis: 'source', note });
/** the book says this applies under a condition */
export const cond = (id: string, note?: string): Relation => ({ id, strength: 'conditional', basis: 'source', note });
/** the book mentions it as related / optional */
export const opt = (id: string, note?: string): Relation => ({ id, strength: 'optional', basis: 'source', note });
/** editorial cross reference — shown with a distinct label in the UI */
export const ed = (id: string, note?: string): Relation => ({ id, strength: 'optional', basis: 'editorial', note });
