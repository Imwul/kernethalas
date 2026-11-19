import { expect, test, type Locator, type Page } from '@playwright/test';

async function enterDie(group: Locator, value: string) {
  const input = group.getByRole('textbox', { name: '직접 굴린 값', exact: true });
  await input.fill(value);
  await input.press('Enter');
}

async function register(gear: Locator, name: string, quantity: string, armor?: string) {
  await gear.getByRole('button', { name: '장비 추가', exact: true }).click();
  const form = gear.getByRole('form', { name: '장비 등록' });
  await form.getByRole('textbox', { name: '품목 이름' }).fill(name);
  await form.getByRole('textbox', { name: '현재 수량' }).fill(quantity);
  if (armor) {
    await form.getByRole('combobox', { name: '보관 위치' }).selectOption('equipped');
    await form.getByRole('combobox', { name: '방어구 내구도' }).selectOption(armor);
  }
  await form.getByRole('button', { name: '장부에 저장' }).click();
  await expect(form).toHaveCount(0);
}

function playNavigation(page: Page) {
  return (name: string) => page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name, exact: true }).click();
}

test('records Overseer recovery and applies armor wear to an equipped item only on confirmation at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const go = playNavigation(page);
  const disclosure = page.locator('.play-gear-fold > summary');
  const gear = page.getByRole('region', { name: '현재 장비와 소모 내역' });
  await disclosure.click();
  await register(gear, 'Leather Armor', '1', 'D8');
  await disclosure.click();
  await go('조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('t-overseer');
  const result = combat.getByRole('textbox', { name: 'D10 결과' });
  await result.fill('5');
  await result.press('Enter');
  await combat.getByRole('button', { name: '승리 후 전투 마치기' }).click();

  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await expect(wrap.getByRole('region', { name: '전투 종료 처리 목록' })).toContainText('Sanity D4 회복');
  await wrap.getByRole('button', { name: '전투 종료', exact: true }).click();
  await enterDie(wrap.getByRole('group', { name: '전투 후 Toughness 회복 D4' }), '2');
  await enterDie(wrap.getByRole('group', { name: 'Infernal Archon 처치 후 Sanity 회복 D4' }), '3');
  await wrap.getByText('사용한 방어구 내구도', { exact: true }).click();
  const worn = wrap.getByRole('combobox', { name: '이번 전투에 사용한 장부 방어구' });
  await worn.selectOption({ label: 'Leather Armor · D8' });
  await enterDie(wrap.getByRole('region', { name: '방어구 내구도 굴림' }), '1');
  await page.getByRole('button', { name: '저널 기록 보기', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('Sanity +3');
  await expect(journal).toContainText('Toughness +2');
  await expect(journal).toContainText('XP +200');
  await journal.getByRole('button', { name: '장비 장부에서 변경 확인' }).click();
  const equipped = gear.getByRole('region', { name: '착용', exact: true });
  await expect(equipped).toContainText('내구도 D8');
  const apply = gear.getByRole('button', { name: '장부에 반영 Leather Armor 내구도 D8 → D6' });
  await apply.click();
  await expect(apply).toBeDisabled();
  await expect(equipped).toContainText('내구도 D6');
  await journal.getByRole('button', { name: '다음 장소', exact: true }).click();
  await page.reload();
  await disclosure.click();
  await expect(equipped).toContainText('내구도 D6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('paper records offer a one-time inventory change, undo, and valid carrying totals at 3440px', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  const go = playNavigation(page);
  const disclosure = page.locator('.play-gear-fold > summary');
  const gear = page.getByRole('region', { name: '현재 장비와 소모 내역' });
  await disclosure.click();
  await register(gear, 'Bandage', '3');
  await disclosure.click();
  await go('휴식·정리');
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '치료·성장', exact: true }).click();
  const treatment = wrap.getByRole('region', { name: '지속 피해와 붕대 처치' });
  await treatment.getByRole('textbox', { name: '보정 Medicine' }).fill('50');
  await enterDie(treatment.getByRole('group', { name: 'Medicine D100' }), '29');
  await enterDie(treatment.getByRole('group', { name: '붕대 회복 D4' }), '3');
  await treatment.getByRole('button', { name: '붕대 처치 기록' }).click();
  await disclosure.click();
  const bag = gear.getByRole('region', { name: '가방', exact: true });
  const amount = bag.locator('.play-gear-amount');
  const apply = gear.getByRole('button', { name: '장부에 반영 Bandage −1 (붕대 처치)', exact: true });
  await expect(amount).toHaveText('3');
  await apply.click();
  await expect(amount).toHaveText('2');
  await expect(apply).toBeDisabled();
  await gear.getByText(/장비 변경 내역/).click();
  await expect(gear).toContainText('Bandage · 3 → 2');
  await gear.getByRole('button', { name: '마지막 장부 변경 되돌리기' }).click();
  await expect(amount).toHaveText('3');
  await expect(apply).toBeEnabled();
  await wrap.locator('..').getByText('소지칸·상인 거래', { exact: true }).click();
  const carry = page.getByRole('region', { name: '소지칸 검산' });
  await carry.getByRole('button', { name: '장부에서 보유 수량 가져오기' }).click();
  await expect(carry.getByRole('textbox', { name: 'Light 보유 수량' })).toHaveValue('3');
  await wrap.getByRole('button', { name: '전리품', exact: true }).click();
  await wrap.getByRole('combobox', { name: '전리품 표' }).selectOption('t-resources');
  await enterDie(wrap.getByRole('group', { name: '자원 D10' }), '7');
  await gear.getByRole('button', { name: '장부에 반영 Crafting Supplies +1', exact: true }).click();
  await expect(bag).toContainText('Crafting Supplies');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});
