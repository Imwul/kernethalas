import { expect, test, type Locator } from '@playwright/test';

async function enterRoll(card: Locator, roll: string) {
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill(roll);
  await card.getByRole('button', { name: '확인', exact: true }).click();
}

test('combat card keeps action, hit location and spoils in context on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ref/cr-necropede');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByLabel('PC 레벨').fill('11');
  const stats = card.locator('.creature-adaptation-stats');
  await expect(stats.locator('strong')).toHaveText(['20', '70', '40']);
  const stickyOffset = await stats.evaluate((element) => {
    window.scrollBy(0, element.getBoundingClientRect().top + 180);
    return element.getBoundingClientRect().top - document.querySelector('.masthead')!.getBoundingClientRect().bottom;
  });
  expect(Math.abs(stickyOffset)).toBeLessThan(2);

  await enterRoll(card, '4');
  await expect(card.getByRole('status')).toContainText('Soul Drain');
  await expect(card.getByRole('status')).toContainText('Endurance');
  await card.getByRole('button', { name: '명중 부위 D20' }).click();
  await enterRoll(card, '20');
  const hitResult = card.getByRole('status');
  await expect(hitResult).toContainText('머리');
  await expect(hitResult.locator('dt').filter({ hasText: 'Armor' }).locator('+ dd')).toHaveText('2');
  await expect(hitResult.locator('dt').filter({ hasText: '약점' }).locator('+ dd')).toHaveText('해당');
  await card.getByRole('button', { name: '행동 D6', exact: true }).click();
  await expect(card.getByRole('status')).toContainText('Soul Drain');
  const aftermath = card.getByRole('region', { name: '전투 종료' });
  await expect(aftermath).toContainText('Toughness D4');
  await expect(aftermath).toContainText('방당 Health 1');
  await expect(aftermath).toContainText('XP +50');
  await card.getByRole('region', { name: '처치 보상' }).getByRole('link', { name: /자원/ }).click();
  await expect(page.getByRole('dialog', { name: /자원/ })).toBeVisible();
});

test('Overseer action opens its summoned creature and preserves the result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ref/cr-infernal-archon');
  const card = page.getByRole('region', { name: '전투 카드' }).first();
  await expect(card.locator('.creature-combat-meta div').filter({ hasText: '라운드당 턴' }).first()).toContainText('2');
  await enterRoll(card, '3');
  await card.getByRole('link', { name: '하급 악마', exact: true }).click();
  const demon = page.getByRole('dialog', { name: '하급 악마' });
  await expect(demon.getByRole('region', { name: '전투 카드' })).toBeVisible();
  await demon.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(card.getByRole('status')).toContainText('Demonic Conjuration');
  await expect(card.getByRole('region', { name: '전투 종료' })).toContainText('XP +200, Sanity D4 회복');
  await expect(card.getByRole('region', { name: '처치 보상' }).getByRole('link')).toHaveCount(3);
});

test('desktop creature has one stat line and room below the roll number', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  const stats = card.locator('.creature-adaptation-stats');
  await expect(stats.locator('abbr')).toHaveText(['Health', 'CS', 'MR']);
  await expect(stats.locator('strong')).toHaveText(['8 + 4 × 레벨', '40', '80']);
  const tops = await stats.locator('strong').evaluateAll((values) => values.map((value) => value.getBoundingClientRect().top));
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
  await enterRoll(card, '5');
  const result = card.getByRole('status');
  await expect(result).toContainText('Abyssal Wither');
  const gap = await result.evaluate((element) => (
    element.querySelector('.oracle-result-meta')!.getBoundingClientRect().top -
    element.querySelector('.readout')!.getBoundingClientRect().bottom
  ));
  expect(gap).toBeGreaterThanOrEqual(8);
});

test('ultrawide keeps the bestiary and workbench in place beside a creature panel', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/bestiary?q=abyssal');
  const list = page.locator('.bestiary-table');
  const before = (await list.boundingBox())!;
  await list.getByRole('link', { name: '심연의 훼방꾼', exact: true }).click();
  const panel = page.getByRole('dialog', { name: '심연의 훼방꾼' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('navigation', { name: '범주 색인' })).toBeVisible();
  await expect(page.locator('.frame-dock')).toBeVisible();
  const after = (await list.boundingBox())!;
  expect(after.x).toBeCloseTo(before.x);
  expect(after.width).toBeCloseTo(before.width);
  const dock = (await page.locator('.frame-dock').boundingBox())!;
  expect(dock.x + dock.width).toBeLessThan((await panel.boundingBox())!.x);

  const card = panel.getByRole('region', { name: '전투 카드' });
  const statTops = await card.locator('.creature-adaptation-stats strong').evaluateAll((values) => values.map(
    (value) => value.getBoundingClientRect().top,
  ));
  expect(new Set(statTops).size).toBe(1);
  await enterRoll(card, '5');
  await expect(card.getByRole('status')).toContainText('Abyssal Wither');
});

test('narrow panel keeps stats visible, separates roll details and restores combat after a defense roll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/bestiary?q=abyssal');
  await page.getByRole('link', { name: '심연의 훼방꾼', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '심연의 훼방꾼' });
  const card = dialog.getByRole('region', { name: '전투 카드' });
  const stats = card.locator('.creature-adaptation-stats');
  await expect(stats.locator('strong')).toHaveText(['8 + 4 × 레벨', '40', '80']);
  const fits = await stats.locator(':scope > div').evaluateAll((cells) => cells.every((cell) => {
    const { right } = cell.getBoundingClientRect();
    return Array.from(cell.querySelectorAll('abbr, strong')).every((item) => item.getBoundingClientRect().right <= right);
  }));
  expect(fits).toBe(true);
  await card.getByLabel('PC 레벨').fill('11');
  await expect(stats.locator('strong')).toHaveText(['52', '50', '80']);
  await expect(card.getByText('기본 Health 8 + 4 × 레벨 · CS 40')).toBeVisible();
  const rowHeight = await stats.evaluate((element) => element.getBoundingClientRect().height);
  expect(rowHeight).toBeLessThan(40);
  await enterRoll(card, '5');
  const result = card.getByRole('status');
  await expect(result).toContainText('범위 5–6');
  const boxes = await result.evaluate((element) => {
    const readout = element.querySelector('.readout')!.getBoundingClientRect();
    const range = element.querySelector('.oracle-result-meta')!.getBoundingClientRect();
    const text = element.querySelector('.oracle-result-text')!.getBoundingClientRect();
    return { readoutRight: readout.right, rangeLeft: range.left, headerBottom: Math.max(readout.bottom, range.bottom), textTop: text.top };
  });
  expect(boxes.rangeLeft - boxes.readoutRight).toBeGreaterThanOrEqual(8);
  expect(boxes.textTop - boxes.headerBottom).toBeGreaterThanOrEqual(8);
  const stickyOffset = await stats.evaluate((element) => {
    const scroll = element.closest('.reference-panel-scroll')!;
    scroll.scrollTop += 180;
    return element.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  });
  expect(Math.abs(stickyOffset)).toBeLessThan(2);

  const reactions = card.getByRole('region', { name: '방어 동작과 펌블' });
  await expect(reactions.getByRole('link', { name: '적 방어 동작' })).toHaveAttribute('href', '/oracle/t-defensive-move-npc');
  await expect(reactions.getByRole('link', { name: 'PC 공격자 펌블' })).toHaveAttribute('href', '/oracle/t-fumble-pc');
  await expect(reactions.getByRole('link', { name: '적 공격자 펌블' })).toHaveAttribute('href', '/oracle/t-fumble-npc');
  const defenseLink = reactions.getByRole('link', { name: 'PC 방어 동작' });
  await defenseLink.click();
  const defense = page.getByRole('dialog', { name: 'PC 방어 동작' });
  await enterRoll(defense, '7');
  await expect(defense.getByRole('status')).toContainText('다음 공격 Advantage');
  await defense.getByRole('button', { name: '심연의 훼방꾼' }).click();
  await expect(defenseLink).toBeFocused();
  await expect(card.getByLabel('PC 레벨')).toHaveValue('11');
  await expect(result).toContainText('Abyssal Wither');
});

test('creature card shows distinct damage responses and condition immunity', async ({ page }) => {
  await page.goto('/ref/cr-pyreborn');
  const defenses = page.getByRole('region', { name: '피해 반응과 상태 면역' });
  await expect(defenses.locator('.vulnerable')).toContainText('Cold');
  await expect(defenses.locator('.restored')).toContainText('Fire');
  await expect(defenses.locator('.immune')).toContainText('중독');
});

async function numberStyle(locator: Locator) {
  return locator.evaluate((element) => {
    const { color, fontFamily, fontSize, fontStyle, fontWeight, fontFeatureSettings, lineHeight } = getComputedStyle(element);
    return { color, fontFamily, fontSize, fontStyle, fontWeight, fontFeatureSettings, lineHeight };
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`oracle result matches the free dice readout in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/oracle#oracle-tools');
    await page.locator('.tray').getByRole('button', { name: 'D6', exact: true }).click();
    const benchmark = await numberStyle(page.locator('.aperture .readout'));
    await page.goto('/oracle/t-events?r=29&view=one');
    const result = page.locator('.oracle-result-value .readout');
    await expect(result).toHaveText('29');
    expect(await numberStyle(result)).toEqual(benchmark);
  });
}
