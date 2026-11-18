/**
 * Optional local source overlay.
 * If the user runs `npm run overlay` against their own PDF, original English wording is written
 * to src/local/source-overlay.json (git-ignored) and shown next to the Korean summaries.
 * Public builds never contain it unless someone deliberately commits that file.
 */
interface Overlay {
  version: string;
  tables: Record<string, Record<string, string>>;
  creatures: Record<string, Record<string, string>>;
}

const found = import.meta.glob<Overlay>('../local/source-overlay.json', { eager: true, import: 'default' });
export const overlay: Overlay | null = (Object.values(found)[0] as Overlay | null | undefined) ?? null;

export function tableRowSource(tableId: string, min: number): string | undefined {
  return overlay?.tables[tableId]?.[String(min)];
}
export function creatureActionSource(creatureId: string, action: string): string | undefined {
  return overlay?.creatures[creatureId]?.[action];
}
