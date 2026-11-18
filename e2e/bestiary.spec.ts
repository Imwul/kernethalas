import { expect, test } from '@playwright/test';

test('manual encounter lookup validates D20 and preserves the filtered mobile list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bestiary?g=overseer&s=health');
  const lookup = page.getByRole('region', { name: '굴림 번호로 찾기' });
  await expect(lookup.getByRole('textbox', { name: 'D10 결과' })).toBeVisible();
  await lookup.getByRole('button', { name: /조우 B/ }).click();
  const roll = lookup.getByRole('textbox', { name: 'D20 결과' });
  await roll.fill('21');
  await lookup.getByRole('button', { name: '생물 열기' }).click();
  await expect(lookup.getByRole('alert')).toContainText('1에서 20 사이');
  await roll.fill('2');
  await roll.press('Enter');
  const beast = page.getByRole('dialog', { name: 'Necropede' });
  await expect(beast).toBeVisible();
  await beast.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(page).toHaveURL(/\/bestiary\?g=overseer&s=health$/);
  await expect(roll).toHaveValue('2');
  await expect(page.getByRole('group', { name: '분류' }).getByRole('button', { name: /^Overseer\s*10$/ })).toHaveAttribute('aria-pressed', 'true');
});

test('manual Overseer lookup follows the D10 table without a page change', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/bestiary');
  const firstRow = page.locator('.bestiary-table tbody tr').first();
  await expect(firstRow).toHaveCSS('display', 'table-row');
  const lookup = page.getByRole('region', { name: '굴림 번호로 찾기' });
  await lookup.getByRole('button', { name: /Overseer/ }).click();
  await lookup.getByRole('textbox', { name: 'D10 결과' }).fill('5');
  await lookup.getByRole('button', { name: '생물 열기' }).click();
  await expect(page.getByRole('dialog', { name: 'Infernal Archon' })).toBeVisible();
  await expect(page).toHaveURL(/\/bestiary$/);
  await expect(firstRow).toHaveCSS('display', 'grid');
});

test('name search accepts Korean and English while preserving filters and sort', async ({ page }) => {
  await page.goto('/bestiary?g=creature&t=Undead&s=health');
  const input = page.getByRole('searchbox', { name: '생물 이름 검색' });
  const names = page.locator('.bestiary-table tbody th');
  await input.fill('necro');
  await expect(names).toHaveText(['Necropede']);
  await input.fill('네크로피드');
  await expect(names).toHaveText(['Necropede']);
  await names.getByRole('link').click();
  await page.getByRole('dialog', { name: 'Necropede' }).getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(input).toHaveValue('네크로피드');
  expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({
    g: 'creature', t: 'Undead', s: 'health', q: '네크로피드',
  });

  await input.fill('인퍼널 아콘');
  await expect(names).toHaveCount(0);
  await page.getByRole('button', { name: '필터 모두 해제' }).click();
  await expect(names).toHaveText(['Infernal Archon']);
  await expect(page.getByLabel('정렬')).toHaveValue('health');
  await page.getByRole('button', { name: '이름 검색어 지우기' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('');
  await expect(page).toHaveURL(/\/bestiary\?s=health$/);
});
