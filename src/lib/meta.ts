/**
 * One title + description per page. Used by the app for the browser tab, and by the build
 * (vite.config.ts → prerenderMeta) to write a static HTML file per route so that shared links
 * show the rule's own title and summary in chat apps and search results.
 */
import { entries, tables, procedures, entryById, tableById, procById } from '../content';

export const SITE_NAME = 'Ossuary Index';
export const SITE_URL = 'https://ker-nethalas-ossuary.vercel.app';
export const SITE_DESCRIPTION = 'Ker Nethalas: Gravebound Edition v1.2 비공식 한국어 규칙 레퍼런스 — 규칙 색인, 무작위 표, 절차 도해, 판정 문답.';

export interface PageMeta {
  title: string;
  description: string;
}

const SECTION: Record<string, PageMeta> = {
  '/': { title: `${SITE_NAME} — Ker Nethalas 규칙 레퍼런스`, description: SITE_DESCRIPTION },
  '/play': { title: `플레이 모드 — ${SITE_NAME}`, description: '종이 시트와 저널을 곁에 두고 탐험, 조우, 전투, 휴식과 전리품을 한 화면에서 처리합니다.' },
  '/ref': { title: `규칙 색인 — ${SITE_NAME}`, description: '규칙·상태·생물·장비·Mastery 전체 색인. 항목마다 원본 쪽수와 검증 상태를 표시합니다.' },
  '/bestiary': { title: `생물 도감 — ${SITE_NAME}`, description: '모든 생물·Overseer·소환수의 기본 수치(Health·Armor·Combat Skill·Magic Resistance), 약점, 특성, 등장 굴림을 한눈에.' },
  '/oracle': { title: `무작위 표 — ${SITE_NAME}`, description: '책의 공식 무작위 표와 굴림 도구. 결과는 어디에도 저장되지 않습니다.' },
  '/atlas': { title: `절차 도해 — ${SITE_NAME}`, description: '전투·탐험·야영 등 복잡한 절차를 단계별 도해로 정리했습니다.' },
  '/rulings': { title: `판정 문답 — ${SITE_NAME}`, description: '플레이 중 자주 헷갈리는 상황과 원문 기준 답.' },
  '/workbench': { title: `작업대 — ${SITE_NAME}`, description: '규칙을 나란히 펼쳐 비교하는 작업대.' },
  '/sources': { title: `출처와 수록 범위 — ${SITE_NAME}`, description: '판본, 저작권 처리 방식, 수록 범위와 검증 현황.' },
};

const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const page = (title: string, description: string): PageMeta => ({ title: `${title} — ${SITE_NAME}`, description: clip(description) });

export function pageMeta(path: string): PageMeta {
  if (SECTION[path]) return SECTION[path];
  const [, section, id] = path.split('/');
  if (section === 'ref' && id) {
    const e = entryById.get(id);
    if (e) return page(e.ko, e.summary);
  }
  if (section === 'oracle' && id) {
    const t = tableById.get(id);
    if (t) return page(t.ko, `${t.dice === '—' ? '조회표' : t.dice} · ${t.usage}`);
  }
  if (section === 'atlas' && id) {
    const p = procById.get(id);
    if (p) return page(p.ko, `${p.situation} — ${p.summary}`);
  }
  const missing = { title: `페이지를 찾을 수 없습니다 — ${SITE_NAME}`, description: SITE_DESCRIPTION };
  // an id that matched nothing is a missing page, not the section index
  if (id) return missing;
  return SECTION[`/${section}`] ?? missing;
}

/** Every route worth a static file, for the build-time prerender. */
export function allRoutes(): string[] {
  return [
    ...Object.keys(SECTION),
    ...entries.map((e) => `/ref/${e.id}`),
    ...tables.map((t) => `/oracle/${t.id}`),
    ...procedures.map((p) => `/atlas/${p.id}`),
  ];
}
