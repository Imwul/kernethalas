import { expect, test, type Page } from '@playwright/test';
import { closeDrawer, openDrawer } from './helpers/play-desk';

const legacyRoom = {
  active: 'journal', placeName: '오래된 묘실', roomLedgerId: 'old-place', roomNumber: 4,
  paperMap: [{ domainId: 1, paperId: 'B-04', area: 'room', note: '오래된 지도', tags: ['잠긴 문'] }],
};

const stage = (page: Page, name: string) => page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name, exact: true });
const picker = (page: Page) => page.getByRole('region', { name: '플레이 캠페인 관리' });
const gear = (page: Page) => page.getByRole('region', { name: '현재 장비와 소모 내역' });
const placeName = (page: Page) => page.getByRole('textbox', { name: '장소 이름 (선택)', exact: true });

test('legacy room and gear stay in their own live campaign while a new tab resumes the named one', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript((slots) => {
    const defaultRoom = 'kn-play-room-v1';
    if (!sessionStorage.getItem(defaultRoom)) sessionStorage.setItem(defaultRoom, JSON.stringify({ slots, undo: [], history: [] }));
    const gearKey = 'kn-play-gear-v1';
    if (!localStorage.getItem(gearKey)) localStorage.setItem(gearKey, JSON.stringify({
      items: [{ id: 'ration', name: 'Ration', count: 3, weight: 'light', location: 'pack' }], entries: [],
    }));
  }, legacyRoom);
  await page.goto('/play');
  await expect(stage(page, '저널')).toHaveAttribute('aria-current', 'step');
  await expect(placeName(page)).toHaveValue('오래된 묘실');
  await openDrawer(page, '장비');
  await expect(gear(page)).toContainText('Ration');
  await closeDrawer(page);

  await page.getByLabel('플레이 캠페인 선택', { exact: true }).click();
  await picker(page).getByRole('button', { name: '새 캠페인', exact: true }).click();
  await picker(page).getByRole('textbox', { name: '캠페인 이름' }).fill('심연 원정대');
  await picker(page).getByRole('button', { name: '만들고 열기', exact: true }).click();
  await expect(page).toHaveURL(/\/play\?campaign=[0-9a-f-]+$/);
  const expedition = page.url();
  await page.getByRole('button', { name: '나중에 설정', exact: true }).click();
  await expect(stage(page, '탐험')).toHaveAttribute('aria-current', 'step');
  await openDrawer(page, '장비');
  await expect(gear(page)).not.toContainText('Ration');
  await gear(page).getByRole('button', { name: '장비 추가', exact: true }).click();
  await gear(page).getByRole('textbox', { name: '품목 이름', exact: true }).fill('Torch');
  await gear(page).getByRole('button', { name: '장부에 저장', exact: true }).click();
  await closeDrawer(page);
  await stage(page, '저널').click();
  await placeName(page).fill('붉은 관문');
  const saves = page.locator('.play-checkpoints');
  await openDrawer(page, '저장');
  await saves.getByRole('button', { name: '저장 지점 만들기', exact: true }).click();
  await expect(saves.getByRole('button', { name: '붉은 관문 이어서 하기', exact: true })).toBeVisible();
  await page.close();

  const resume = await context.newPage();
  await resume.setViewportSize({ width: 320, height: 800 });
  await resume.goto('/');
  await expect(resume.getByText('붉은 관문 · 저널', { exact: true })).toBeVisible();
  await resume.getByRole('link', { name: '심연 원정대 이어하기', exact: true }).click();
  await expect(resume).toHaveURL(expedition);
  await expect(placeName(resume)).toHaveValue('붉은 관문');
  await openDrawer(resume, '장비');
  await expect(gear(resume)).toContainText('Torch');
  await expect(gear(resume)).not.toContainText('Ration');

  const first = await context.newPage();
  await first.goto('/play?campaign=default');
  await expect(placeName(first)).toHaveValue('오래된 묘실');
  await openDrawer(first, '장비');
  await expect(gear(first)).toContainText('Ration');
  await expect(gear(first)).not.toContainText('Torch');
  await openDrawer(first, '저장');
  await expect(first.getByRole('button', { name: '붉은 관문 이어서 하기', exact: true })).toHaveCount(0);
  await placeName(first).fill('기본 원정대의 다음 방');
  await expect(placeName(resume)).toHaveValue('붉은 관문');
  expect(await resume.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('an older tab with a distinct legacy draft is kept as a recoverable campaign', async ({ page }) => {
  await page.addInitScript((slots) => {
    const key = 'kn-play-room-v1';
    localStorage.setItem(key, JSON.stringify({ slots: { ...slots, placeName: '이미 저장된 도메인' }, undo: [], history: [] }));
    sessionStorage.setItem(key, JSON.stringify({ slots, undo: [], history: [] }));
  }, legacyRoom);
  await page.goto('/play');
  await expect(page.getByLabel('플레이 캠페인 선택').getByText('이전 탭 복구 1', { exact: true })).toBeVisible();
  await expect(placeName(page)).toHaveValue('오래된 묘실');
  await page.getByLabel('플레이 캠페인 선택', { exact: true }).click();
  await picker(page).getByRole('combobox', { name: '플레이할 캠페인' }).selectOption('default');
  await picker(page).getByRole('button', { name: '캠페인 열기', exact: true }).click();
  await expect(placeName(page)).toHaveValue('이미 저장된 도메인');
});

test('home resumes a map-only place using the current domain’s paper ID', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('kn-play-room-v1', JSON.stringify({
    slots: {
      active: 'combat', placeName: '', roomNumber: 7, domainId: 2, 'explore/paper-map-key': 'b-07',
      paperMap: [{ domainId: 1, paperId: 'b-07' }, { domainId: 2, paperId: 'B-07' }],
    }, undo: [], history: [],
  })));
  await page.goto('/');
  await expect(page.getByText('B-07 · 조우·전투', { exact: true })).toBeVisible();
});

test('a second tab cannot overwrite newer progress in the same campaign', async ({ page, context }) => {
  await page.goto('/play');
  await stage(page, '저널').click();
  await placeName(page).fill('첫 상태');

  const other = await context.newPage();
  await other.goto('/play?campaign=default');
  await expect(placeName(other)).toHaveValue('첫 상태');
  await page.bringToFront();
  await placeName(page).fill('저장된 진도');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kn-play-room-v1') ?? '{}').slots?.placeName)).toBe('저장된 진도');
  await other.bringToFront();
  await expect(other.getByText(/다른 탭에서 이 캠페인을 변경했습니다/)).toBeVisible();
  await placeName(other).fill('두 번째 탭의 사본');
  await page.reload();
  await expect(placeName(page)).toHaveValue('저장된 진도');
  await other.reload();
  await expect(placeName(other)).toHaveValue('두 번째 탭의 사본');

  await other.getByRole('button', { name: '최근 저장 확인' }).click();
  await other.getByRole('button', { name: '저장된 진행 열기' }).click();
  await expect(placeName(other)).toHaveValue('저장된 진도');
  await expect(other.getByText(/다른 탭에서 이 캠페인을 변경했습니다/)).toHaveCount(0);
});
