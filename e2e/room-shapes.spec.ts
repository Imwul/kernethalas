import { expect, test } from '@playwright/test';

test('room and corridor results have diagrams in the roller and the full table', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/oracle/t-room-shape?r=3&view=one');

  const roller = page.getByRole('region', { name: '표 굴리기' });
  const corridor = roller.getByRole('img', { name: '3번 통로 모양 예시 · 출입구 1개' });
  await expect(corridor.locator('line')).toHaveCount(1);
  await expect(roller.getByText('출입구 배치 예시', { exact: true })).toBeVisible();

  const manual = roller.getByRole('textbox', { name: '직접 굴린 값' });
  await manual.fill('29');
  await manual.press('Enter');
  const room = roller.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' });
  await expect(room.locator('line')).toHaveCount(8);
  await expect(corridor).toHaveCount(0);

  await roller.getByRole('button', { name: '전체 표', exact: true }).click();
  const table = page.getByRole('table', { name: /Room & Corridor Shape/ });
  await expect(table.getByRole('img')).toHaveCount(100);
  await expect(table.locator('tr[aria-current="true"]').getByRole('img')).toHaveAccessibleName('29번 방 모양 예시 · 출입구 8개');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('play mode shows the same schematic for physical room shape rolls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const shape = page.getByRole('region', { name: '방·통로 모양', exact: true });
  const manual = shape.getByRole('textbox', { name: '직접 굴린 값' });
  await manual.fill('00');
  await manual.press('Enter');
  await expect(shape.getByRole('img', { name: '100번 방 모양 예시 · 출입구 3개' })).toBeVisible();
});
