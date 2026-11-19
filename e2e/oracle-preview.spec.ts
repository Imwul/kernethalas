import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1366, height: 1024 }, { width: 320, height: 800 }]) {
  test.describe(`trap table preview at ${viewport.width}px`, () => {
    test.use({ viewport, hasTouch: true });

    test('keeps avoidance skills on one line and allows rolling and finding a row', async ({ page }) => {
      await page.goto('/ref/locks-traps');
      await page.getByRole('link', { name: '표 함정', exact: true }).click();
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
