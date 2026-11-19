import { expect, test, type Page } from '@playwright/test';

async function openEquipment(page: Page) {
  const panels = page.getByRole('region', { name: '소지칸 검산' });
  if (!(await panels.isVisible())) {
    await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '휴식·정리' }).click();
    if (!(await panels.isVisible())) await page.getByText('소지칸·상인 거래', { exact: true }).click();
  }
  await expect(panels).toBeVisible();
}

test('carrying capacity previews mixed loot bundles and retains counts at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await openEquipment(page);
  const carry = page.getByRole('region', { name: '소지칸 검산' });
  await carry.getByLabel('Backpack', { exact: true }).check();
  await carry.getByLabel('Pouch 수', { exact: true }).selectOption('2');
  await carry.getByLabel('Normal 보유 수량').fill('2');
  await carry.getByLabel('Heavy 보유 수량').fill('1');
  await carry.getByLabel('Light 보유 수량').fill('9');
  await carry.getByLabel('동전 보유 수량').fill('99');
  const results = carry.getByLabel('소지칸 계산 결과');
  await expect(results).toContainText('최대 소지40칸');
  await expect(results).toContainText('획득 전여유 34칸');

  await carry.getByLabel('Light 추가 수량').fill('2');
  await carry.getByLabel('보석 추가 수량').fill('2');
  await carry.getByLabel('Heavy 추가 수량').fill('17');
  await expect(results).toContainText('획득 후초과 2칸');
  await carry.getByLabel('Heavy 추가 수량').fill('-1');
  await expect(carry.getByRole('alert')).toBeVisible();
  await expect(results).toHaveCount(0);
  await carry.getByLabel('Heavy 추가 수량').fill('16');
  await expect(results).toContainText('획득 후여유 0칸');
  await page.reload();
  await openEquipment(page);
  await expect(carry.getByLabel('Heavy 추가 수량')).toHaveValue('16');
  await expect(results).toContainText('획득 후여유 0칸');
  await expect(page.locator('.play-equipment')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

test('merchant confirms catalog purchases, rarity sales, and negotiated prices in the same ledger', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
  await exploration.getByRole('button', { name: '방', exact: true }).click();
  const tension = exploration.getByRole('region', { name: '긴장 주사위', exact: true });
  await tension.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('5');
  await tension.getByRole('button', { name: '긴장 주사위 확인' }).click();
  for (const [label, roll] of [['조우 판정', '9'], ['이벤트', '25']]) {
    const panel = exploration.getByRole('region', { name: label, exact: true });
    await panel.getByRole('textbox', { name: '직접 굴린 값', exact: true }).fill(roll);
    await panel.getByRole('button', { name: '확인', exact: true }).click();
  }
  await exploration.getByRole('button', { name: '상인 거래로', exact: true }).click();
  const merchant = page.getByRole('region', { name: '상인 거래' });
  const choice = merchant.getByLabel('거래할 품목');
  const direction = merchant.getByLabel('거래 방식');
  const quantity = merchant.getByLabel('수량', { exact: true });
  const add = merchant.getByRole('button', { name: '거래 목록에 추가' });

  await choice.selectOption({ label: 'Torch' });
  await quantity.fill('2');
  await add.click();
  await direction.selectOption('sell');
  await choice.selectOption({ label: 'Dagger' });
  await expect(merchant.locator('.play-trade-unit')).toHaveText('3₵');
  await quantity.fill('2');
  await add.click();
  await choice.selectOption({ label: 'Rare 마법 아이템' });
  await add.click();
  await choice.selectOption('custom');
  await merchant.getByLabel('품목 이름').fill('기록이 새겨진 동판');
  await merchant.getByLabel('합의 단가 (₵)').fill('12');
  await add.click();

  await expect(merchant.getByLabel('거래 합계')).toContainText('동전 증감+398₵');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(3440);
  const journalStage = page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '저널' });
  await journalStage.click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).not.toContainText('동전 +398₵');
  await openEquipment(page);
  await merchant.getByRole('button', { name: '거래 기록에 반영', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await journalStage.click();
  const sheet = journal.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet.getByText('동전 +398₵ (거래)', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Torch +2 (거래)', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Dagger −2 (거래)', { exact: true })).toBeVisible();
  await expect(journal).toContainText('동전 +398₵ · 구매 Torch 2개');
  await page.reload();
  await expect(sheet.getByText('동전 +398₵ (거래)', { exact: true })).toBeVisible();
});
