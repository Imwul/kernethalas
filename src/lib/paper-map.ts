import type { EncounterPlace } from '../content/tables/exploration';

export const PAPER_MAP_SLOT = 'paperMap';

export const PAPER_MAP_TAGS = ['잠긴 문', '미개봉 용기', '미탐색 출입구'] as const;
export type PaperMapTag = typeof PAPER_MAP_TAGS[number];

export interface PaperMapLocation {
  domainId: number;
  paperId: string;
  area: EncounterPlace;
  note: string;
  tags: PaperMapTag[];
}

export function paperMapKey(paperId: string) {
  return paperId.trim().toLowerCase();
}
