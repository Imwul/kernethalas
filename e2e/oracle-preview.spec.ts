import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1366, height: 1024 }, { width: 320, height: 800 }]) {
  test.describe(`trap table preview at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true });

    test('keeps avoidance skills on one line and allows rolling and finding a row', async ({ page }) => {
      await page.goto('/ref/locks-traps');
      const link = page.getByRole('link', { name: '표 함정', exact: true });
      await expect(link).toBeVisible();
      await page.evaluate(async () => { await document.fonts.ready; });
      await link.click();
      const panel = page.getByRole('dialog', { name: '함정', exact: true });
      const table = panel.getByRole('table', { name: 'Traps — D10', exact: true });
      await expect(table.locator('tbody tr')).toHaveCount(10);
      await page.evaluate(async () => { await document.fonts.ready; });

      const problems = await table.evaluate((element) => {
        const issues: string[] = [];
        const cells = Array.from(element.querySelectorAll('td[data-col], th:first-child'));
        for (const cell of cells) {
          const text = document.createRange();
          text.selectNodeContents(cell);
          const fragments = Array.from(text.getClientRects()).filter((rect) => rect.width > 0);
          const lines = new Set(fragments.map(({ top }) => Math.round(top))).size;
          const { left, right } = cell.getBoundingClientRect();
          if (lines !== 1 || fragments.some((rect) => rect.left < left - 1 || rect.right > right + 1)) {
            issues.push(`${cell.textContent?.trim()} takes ${lines} lines or extends past its cell`);
          }
        }
        for (const row of element.querySelectorAll('tbody tr')) {
          const [number, result, skill] = Array.from(row.querySelectorAll('td'));
          if (!number?.textContent?.trim() || !result?.textContent?.trim() || !skill?.textContent?.trim()) {
            issues.push('missing number, result, or avoidance skill');
          }
        }
        return issues;
      });
      expect(problems).toEqual([]);

      const widths = await page.locator('.reference-panel-scroll:visible').evaluate((scroller) => ({
        drawerExcess: scroller.scrollWidth - scroller.clientWidth,
        pageExcess: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(widths.drawerExcess).toBeLessThanOrEqual(1);
      expect(widths.pageExcess).toBeLessThanOrEqual(1);

      const physical = panel.getByRole('textbox', { name: '직접 굴린 값', exact: true });
      await physical.fill('8');
      await physical.press('Enter');
      await expect(panel.getByRole('status')).toContainText('Acrobatics');
      await expect(table).toHaveCount(0);
      await panel.getByRole('button', { name: '전체 표', exact: true }).click();
      await panel.getByRole('button', { name: '해당 행으로', exact: true }).click();
      const row = table.locator('tr[aria-current="true"]');
      await expect(row).toContainText('불덩이');
      await expect(row).toBeFocused();
    });
  });
}

test('Escape closes the reading settings before a desktop reference panel', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/ref/locks-traps');
  await page.getByRole('link', { name: '표 함정', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '함정', exact: true });
  await page.getByRole('button', { name: '읽기 설정', exact: true }).click();
  const settings = page.getByRole('dialog', { name: '읽기 설정', exact: true });
  await expect(settings).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(panel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
});

test('an encounter result keeps its place and table view when opening the full page', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/ref/encounter-check');
  await page.locator('main a[href="/oracle/t-encounter-check"]').first().press('Enter');
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '방', exact: true }).click();
  const input = panel.getByRole('textbox', { name: '직접 굴린 값' });
  await input.fill('11');
  await input.press('Enter');
  await expect(panel.getByRole('status')).toContainText('방 · 전투 조우');
  await panel.getByRole('button', { name: '전체 표', exact: true }).click();
  await panel.getByRole('link', { name: '전체 페이지' }).click();
  await expect(page).toHaveURL('/oracle/t-encounter-check?r=11&place=room');
  const main = page.getByRole('main');
  await expect(main.getByRole('button', { name: '방', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(main.getByRole('status')).toContainText('방 · 전투 조우');
  await expect(main.getByRole('table')).toBeVisible();
});

test('quick dice uses the colored oracle readout and search arrows expose their selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/oracle/t-events?r=45&view=one');
  const resultStyle = (node: Element) => {
    const style = getComputedStyle(node);
    return [style.fontFamily, style.fontWeight, style.fontSize, style.color];
  };
  const oracle = await page.locator('main .oracle-result .readout').evaluate(resultStyle);
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '규칙 검색' });
  const query = search.getByRole('searchbox');
  await query.fill('d20');
  await search.getByRole('button', { name: 'D20 굴리기', exact: true }).click();
  expect(await search.locator('.search-dice .readout').evaluate(resultStyle)).toEqual(oracle);

  await query.fill('Prone');
  await query.press('ArrowDown');
  const selected = search.locator('.search-result[data-active="true"] button.search-preview');
  const selectedId = await selected.getAttribute('id');
  expect(selectedId).toBeTruthy();
  await expect(query).toHaveAttribute('aria-activedescendant', selectedId!);
  await expect(selected).toContainText('Prone 상태에서는 어떤 제약이 있는가?');
  await expect(query).toBeFocused();
});
