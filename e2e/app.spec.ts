import { expect, test, type Page } from '@playwright/test';

const ROUTES = [
  '/',
  '/play',
  '/ref',
  '/ref?c=character',
  '/ref/prone',
  '/ref/m-wraith',
  '/ref/cr-veilshifter',
  '/bestiary',
  '/bestiary?g=overseer&s=health',
  '/oracle',
  '/oracle/t-events',
  '/oracle/t-room-shape',
  '/atlas',
  '/atlas/p-explore-room',
  '/atlas/p-new-run',
  '/rulings',
  '/workbench',
  '/sources',
];

/** horizontal overflow in px, and text nodes rendered under 12px (SVG drawings and sr-only excluded) */
async function layoutIssues(page: Page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('svg') || el.classList.contains('sr-only')) continue;
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
      if (!hasText || !el.getBoundingClientRect().width) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 12) small.push(`${el.tagName}.${el.className}`);
    }
    return { overflow: de.scrollWidth - de.clientWidth, small: [...new Set(small)].slice(0, 5) };
  });
}

for (const { width, height } of [
  { width: 360, height: 900 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
  { width: 3440, height: 1440 },
]) {
  test.describe(`layout at ${width}px`, () => {
    test.use({ viewport: { width, height } });
    for (const route of ROUTES) {
      test(`${route} fits the screen and keeps text ≥12px`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator('#root')).not.toBeEmpty();
        const issues = await layoutIssues(page);
        expect(issues.overflow, 'horizontal overflow').toBe(0);
        expect(issues.small, 'text under 12px').toEqual([]);
      });
    }
  });
}

test('rulings questions get the full row (regression: squeezed into one column)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/rulings');
  const w = await page.locator('.ruling .qq').first().evaluate((el) => el.getBoundingClientRect().width);
  expect(w).toBeGreaterThan(300);
});

test('search finds rules by Korean, initials and Hangul spelling of English', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('/');
  const box = page.getByRole('searchbox', { name: '검색어' });
  await expect(box).toBeVisible();
  for (const [q, expected] of [
    ['넘어짐', '넘어짐'],
    ['ㄴㅇㅈ', '넘어짐'],
    ['프론', '넘어짐'],
    ['텐션 다이', '긴장 주사위'],
  ] as const) {
    await box.fill(q);
    await expect(page.locator('#search-results .search-result').first()).toContainText(expected);
  }
});

test('rolling a table highlights exactly one row', async ({ page }) => {
  await page.goto('/oracle/t-events');
  await page.getByRole('button', { name: /^굴리기$/ }).first().click();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
});

test('room & corridor shape lists all 100 results with entrance counts', async ({ page }) => {
  await page.goto('/oracle/t-room-shape');
  await expect(page.locator('table tbody tr')).toHaveCount(100);
  await expect(page.locator('table tbody tr').nth(2)).toContainText('막다른 곳');
});

test('each page ships its own title and link preview', async ({ request }) => {
  const html = await (await request.get('/ref/prone.html')).text();
  expect(html).toContain('<title>넘어짐 — Ossuary Index</title>');
  expect(html).toContain('property="og:image"');
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // let the worker control the page
  await context.setOffline(true);
  await page.goto('/ref/m-zealot');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Zealot');
  await page.goto('/play');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('플레이 모드');
});

test('bestiary lists all 59 creatures, each with a way to appear', async ({ page }) => {
  await page.goto('/bestiary');
  const rows = page.locator('.bestiary-table tbody tr');
  await expect(rows).toHaveCount(59);
  const noRoll = await rows.evaluateAll((trs) => trs.filter((tr) => tr.querySelector('.rolls')?.textContent?.trim() === '—').map((tr) => tr.querySelector('th')?.textContent));
  expect(noRoll).toEqual([]);
  const categories = page.getByRole('group', { name: '분류' });
  await categories.getByRole('button', { name: /^Overseer\s*10$/ }).click();
  await expect(rows).toHaveCount(10);
  await categories.getByRole('button', { name: /^Overseer 소환수/ }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Lesser Demon');
});
