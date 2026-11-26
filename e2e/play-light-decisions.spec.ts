import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer, openPane } from './helpers/play-desk';

const region = (scope: Locator | Page, name: string) => scope.getByRole('region', { name, exact: true });
const button = (scope: Locator | Page, name: string) => scope.getByRole('button', { name, exact: true });
const field = (scope: Locator | Page, name: string) => scope.getByRole('textbox', { name, exact: true });
const stage = (page: Page, name: string) => button(page.getByRole('navigation', { name: '플레이 단계' }), name).click();

async function roll(scope: Locator, name: string, value: string) {
  const input = field(scope, name);
  await input.fill(value);
  await input.press('Enter');
}

async function gear(page: Page, name: string, count: string) {
  const drawer = await openDrawer(page, '장비');
  await button(drawer, '장비 추가').click();
  const form = drawer.getByRole('form', { name: '장비 등록' });
  await field(form, '품목 이름').fill(name);
  await field(form, '현재 수량').fill(count);
  await button(form, '장부에 저장').click();
  await closeDrawer(page);
}

test('tracked light stays distinct from equipment counts across a room and reload', async ({ page }) => {
  await page.goto('/play');
  await gear(page, 'Torch', '1');
  const explore = region(page, '장소 탐험');
  await button(explore, '방').click();
  const entry = region(explore, '입장할 때 쓸 광원');
  await openPane(entry, '광원 기록');
  await expect(entry).toContainText('예비 Torch 1개');
  await button(entry, '장비 장부에서 사용 기록').click();
  const drawer = page.locator('#play-drawer');
  await button(drawer, 'Torch · 가방 1개 사용').click();
  await button(drawer, '사용 확정').click();
  await closeDrawer(page);
  await expect(entry).toContainText('예비 Torch 0개');
  await button(entry, '횃불·램프 20 입력').click();
  await button(entry, '잔량 저장').click();
  await expect(entry).toContainText('광원 20 → 19');
  await roll(region(explore, '긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await expect(entry).toContainText('현재 광원 19');
  await stage(page, '저널');
  const journal = region(page, '이번 장소 기록');
  await expect(journal.getByRole('checkbox', { name: '광원 −1', exact: true })).toBeVisible();
  await button(journal, '다음 장소').click();
  await page.reload();
  await button(explore, '방').click();
  await expect(entry).toContainText('광원 19 → 18');
  await openPane(entry, '광원 기록');
  await expect(entry).toContainText('예비 Torch 0개');
});

test('zero light offers a deliberate dark-room Resolve check, followed by an optional rest plan', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/play');
  await gear(page, 'Crafting Supplies', '1');
  const explore = region(page, '장소 탐험');
  await button(explore, '방').click();
  const entry = region(explore, '입장할 때 쓸 광원');
  await openPane(entry, '광원 기록');
  await field(entry, '현재 광원 잔량').fill('0');
  await button(entry, '잔량 저장').click();
  const tension = region(explore, '긴장 주사위');
  await expect(tension).toHaveCount(0);
  await expect(entry).toContainText('남은 광원이 0입니다');
  await entry.getByRole('combobox', { name: '입장할 때 쓸 광원' }).selectOption('dark');
  const resolve = entry.getByRole('group', { name: '어두운 방 Resolve 판정' });
  await expect(entry.getByRole('link', { name: 'Blinded', exact: true })).toBeVisible();
  await field(resolve, 'Resolve 수치').fill('45');
  await roll(resolve, '직접 굴린 D100', '92');
  await roll(tension, '긴장 주사위 굴린 값', '3');
  await stage(page, '저널');
  const journal = region(page, '이번 장소 기록');
  await expect(journal.getByRole('checkbox', { name: 'Sanity −1 (광원 없이 새 방 진입)' })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: '광원 −1', exact: true })).toHaveCount(0);
  await stage(page, '휴식·정리');
  const rest = region(page, '휴식과 전리품 정리');
  const choices = region(rest, '계속 탐험과 휴식 비용 비교');
  await expect(choices).toContainText('광원 0 → 0 · 5 부족');
  await expect(choices).toContainText('성공 D20 12–20');
  await button(rest, '야영').click();
  const camp = region(rest, '야영 계산기');
  await field(camp, '방어벽 재료 수').fill('1');
  await expect(choices).toContainText('성공 D20 7–20');
  await expect(choices).toContainText('활동 Exhaustion +1');
  await expect(choices).toContainText('Crafting Supplies 1개');
  await field(camp, '방어벽 재료 수').fill('2');
  await expect(choices).toContainText('Crafting Supplies 2개 (장부 1개 부족)');
  await openPane(camp, '요리 · 제작 · 그 밖의 야영 활동');
  await field(camp, '요리할 Ration 수').fill('1');
  await expect(choices).toContainText('Cooking Ingredients 1개');
  await expect(field(camp, '직접 굴린 D20')).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
