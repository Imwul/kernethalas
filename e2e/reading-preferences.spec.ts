import { expect, test } from '@playwright/test';

test('reading settings persist across routes and keep trap skills readable in a narrow drawer', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ref/locks-traps');
  await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '읽기 설정', exact: true });
  await settings.getByRole('combobox', { name: '테마', exact: true }).selectOption('dark');
  await settings.getByRole('combobox', { name: '글자 크기', exact: true }).selectOption('large');
  await settings.getByRole('combobox', { name: '읽기 간격', exact: true }).selectOption('spacious');
  await settings.getByRole('checkbox', { name: '높은 대비', exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-reading-text', 'large');
  await expect(page.locator('html')).toHaveAttribute('data-reading-density', 'spacious');
  await expect(page.locator('html')).toHaveAttribute('data-reading-contrast', 'high');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(page.getByRole('button', { name: '읽기 설정', exact: true })).toBeFocused();

  await page.getByRole('main').getByRole('link', { name: '표 함정', exact: true }).click();
  const drawer = page.locator('.reference-panel');
  await expect(drawer).toBeVisible();
  const skill = drawer.locator('td[data-col]').getByText('Acrobatics', { exact: true }).first();
  await expect(skill).toBeVisible();
  expect(await skill.evaluate((cell) => ({
    label: getComputedStyle(cell, '::before').content,
    grid: getComputedStyle(cell.parentElement!).display,
    fits: cell.scrollWidth <= cell.clientWidth + 1,
  }))).toEqual({ label: '"회피 판정"', grid: 'grid', fits: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/oracle/t-traps');
  await expect(page.locator('html')).toHaveAttribute('data-reading-contrast', 'high');
  await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
  await expect(settings.getByRole('combobox', { name: '테마' })).toHaveValue('dark');
  await expect(settings.getByRole('combobox', { name: '글자 크기' })).toHaveValue('large');
  await expect(settings.getByRole('combobox', { name: '읽기 간격' })).toHaveValue('spacious');
  await expect(settings.getByRole('checkbox', { name: '높은 대비' })).toBeChecked();
});
