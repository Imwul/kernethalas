import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDrawer } from './helpers/play-desk';

async function roll(scope: Locator, group: string, value: string) {
  const input = scope.getByRole('group', { name: group, exact: true }).getByRole('textbox', { name: '직접 굴린 값' });
  await input.fill(value);
  await input.press('Enter');
}

async function allot(creator: Locator, skill: string, amount: number) {
  await creator.getByRole('group', { name: `${skill} 분배` }).getByRole('button', { name: `+${amount}`, exact: true }).click();
}

const noOverflow = async (page: Page, width: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test('a survivor built from typed dice and one-tap choices lists every paper value at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/atlas/p-new-run?view=list');
  const creator = page.getByRole('region', { name: '새 생존자 만들기' });

  await roll(creator, 'Health D6+10', '4');
  await roll(creator, 'Toughness 3D6+20', '3 4 5');
  await roll(creator, 'Aether D6+8', '2');
  await roll(creator, 'Sanity D6+10', '6');
  await expect(creator.getByRole('group', { name: 'Toughness 3D6+20' }).getByRole('status')).toContainText('Toughness 32');
  await creator.getByRole('button', { name: 'II. Skill ›' }).click();

  const board = creator.getByRole('status', { name: '분배 칸' });
  await expect(board).toContainText('10/10 남음');
  await expect(creator.getByText('기본 20', { exact: true })).toBeVisible();
  await allot(creator, 'Bladed Weapons', 60);
  await expect(creator.getByRole('group', { name: 'Shafted Weapons 분배' }).getByRole('button', { name: '+60', exact: true })).toBeDisabled();
  await expect(creator.getByRole('group', { name: 'Athletics 분배' }).getByRole('button', { name: '+60', exact: true })).toHaveCount(0);
  await allot(creator, 'Shafted Weapons', 40);
  for (const skill of ['Athletics', 'Dodge', 'Perception']) await allot(creator, skill, 30);
  for (const skill of ['Stealth', 'Medicine']) await allot(creator, skill, 20);
  for (const skill of ['Reason', 'Scavenge', 'Thievery']) await allot(creator, skill, 10);
  await expect(board).toContainText('0/10 남음');
  await expect(board).toContainText('Bladed');
  await expect(creator.getByLabel('Perception 합계')).toHaveText('+30 → 50');
  await creator.getByRole('button', { name: 'III. Resistance ›' }).click();
  await creator.getByRole('group', { name: '40으로 시작할 Resistance' }).getByRole('button', { name: /Endurance/ }).click();
  await creator.getByRole('button', { name: 'IV. Mastery ›' }).click();

  const browser = creator.getByRole('region', { name: 'Mastery 둘러보기' });
  const list = browser.getByRole('list', { name: 'Mastery 목록' });
  await expect(list.getByRole('listitem')).toHaveCount(20);
  await expect(list.getByRole('button', { name: /^Abyssal Reaver/ })).toContainText('Aether 능력 4');
  await list.getByRole('button', { name: /^Abyssal Reaver/ }).click();
  await expect(browser.getByRole('heading', { level: 3 })).toHaveText('Abyssal Reaver');
  await browser.getByRole('button', { name: /^다음 Mastery/ }).click();
  await expect(browser.getByRole('heading', { level: 3 })).toHaveText('Arcanist');
  await expect(browser.getByRole('list', { name: 'Arcanist 테크트리' }).getByRole('listitem')).toHaveCount(6);
  await browser.getByRole('button', { name: '이 Mastery 선택' }).click();
  await browser.getByRole('button', { name: /^다음 Mastery/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(browser.getByRole('heading', { level: 3 })).toHaveText('Brawler');
  await browser.getByRole('button', { name: '이 Mastery 선택' }).click();
  await page.keyboard.press('ArrowRight');
  await expect(browser.getByRole('button', { name: '2개를 이미 골랐습니다' })).toBeDisabled();
  await creator.getByRole('button', { name: 'V. Goal ›' }).click();

  const goals = creator.getByRole('group', { name: 'Personal Goal 목록' });
  await goals.getByRole('button', { name: /Overseer Overthrown/ }).click();
  await creator.getByRole('textbox', { name: '목표 찾기' }).fill('Undead');
  await goals.getByRole('button', { name: /Wraithstalker/ }).click();
  await creator.getByRole('button', { name: 'VI. 장비 ›' }).click();

  await creator.getByRole('group', { name: 'Bladed 무기' }).getByRole('button', { name: /Longsword/ }).click();
  await expect(creator.getByRole('list', { name: 'Longsword 특성' })).toContainText('Parrying');
  await roll(creator, '무작위 방어구 D10', '1');
  await roll(creator, 'Torso 등급 D100', '65');
  await expect(creator.getByRole('group', { name: 'Torso 등급 D100' }).getByRole('status')).toContainText('Mail · Armor 2 · Integrity D8');
  await roll(creator, 'Cooking Ingredients D10', '4');
  await roll(creator, 'Crafting Supplies D10+5', '2');
  await roll(creator, '동전 D20', '11');
  await creator.getByRole('button', { name: 'VII. 정리 ›' }).click();

  const summary = creator.locator('dl[aria-label="종이에 적을 값"]');
  await expect(summary).toContainText('Health 14 · Toughness 32 · Aether 10 · Sanity 16 · Exhaustion 0');
  await expect(summary).toContainText('Bladed Weapons 60');
  await expect(summary).toContainText('Endurance 40 · Resolve 20 · Spellward 20');
  await expect(summary).toContainText('Arcanist (Tier 1');
  await expect(summary).toContainText('Overseer Overthrown · Wraithstalker');
  await expect(summary).toContainText('Longsword · Mail (D8) · Torch · Cooking Ingredients 4 · Crafting Supplies 7 · 11₵');
  await expect(creator.getByRole('button', { name: '캐릭터 탭에 채우기' })).toHaveCount(0);
  await noOverflow(page, 360);
});

test('full auto fills the character tab, the Mastery tree and the gear ledger, and Exhaustion steers checks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '캐릭터');
  await drawer.getByRole('button', { name: '새 생존자 만들기' }).click();
  await drawer.getByRole('button', { name: '완전 자동 생성' }).click();
  await expect(drawer.getByRole('heading', { name: 'VII. 정리' })).toBeVisible();
  await drawer.getByRole('button', { name: '캐릭터 탭에 채우기' }).click();
  await expect(drawer.getByText('시작 장비를 장부에 넣었습니다', { exact: false })).toBeVisible();
  await drawer.getByRole('button', { name: '캐릭터 탭 보기' }).click();

  await expect(drawer.getByRole('textbox', { name: 'PC 레벨' })).toHaveValue('1');
  await expect(drawer.getByRole('textbox', { name: 'XP', exact: true })).toHaveValue('0');
  const tabs = drawer.getByRole('group', { name: '캐릭터 항목' });
  await tabs.getByRole('button', { name: /^Mastery/ }).click();
  const trees = drawer.getByRole('region', { name: 'Mastery 테크트리' });
  await expect(trees).toContainText('Ability Point 2 / 2 사용');
  const first = trees.getByRole('list', { name: /^기본 1 .* 테크트리$/ });
  await expect(trees.getByRole('list', { name: /^기본 2 .* 테크트리$/ })).toBeVisible();
  await first.getByRole('button', { name: /Tier II .*다음 해금/ }).click();
  await expect(trees.getByText('남은 Ability Point(0)보다 많습니다.')).toBeVisible();
  await tabs.getByRole('button', { name: /^기본/ }).click();
  await drawer.getByRole('textbox', { name: 'PC 레벨' }).fill('2');
  await expect(tabs.getByRole('button', { name: /^Mastery/ })).toContainText('AP 1 남음');
  await tabs.getByRole('button', { name: /^Mastery/ }).click();
  await expect(trees).toContainText('1점 남음');
  await trees.getByRole('button', { name: /Tier II까지 배움으로 표시/ }).click();
  await expect(trees).toContainText('Ability Point 3 / 3 사용');
  await expect(first.getByRole('button', { name: /Tier II .*배움/ })).toBeVisible();

  await tabs.getByRole('button', { name: /^상태/ }).click();
  const exhaustion = drawer.getByRole('region', { name: 'Exhaustion', exact: true });
  await exhaustion.getByRole('textbox', { name: '현재 Exhaustion' }).fill('17');
  await expect(exhaustion.getByRole('status').first()).toContainText('모든 판정 불리');
  await exhaustion.getByRole('button', { name: '날 재료 먹기 · −1' }).click();
  const check = exhaustion.getByRole('group', { name: '날 재료 Endurance 판정' });
  await expect(check.getByRole('button', { name: '불리 (Disadvantage)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(check).toContainText('Exhaustion 17 · 모든 판정 불리');
  await check.getByRole('button', { name: '유리 (Advantage)' }).click();
  await expect(check.getByRole('button', { name: '유리 (Advantage)' })).toHaveAttribute('aria-pressed', 'true');
  await expect(check.getByRole('button', { name: '불리 (Disadvantage)' })).toHaveAttribute('aria-pressed', 'false');
  await check.getByRole('textbox', { name: '직접 굴린 D100' }).fill('95');
  await check.getByRole('textbox', { name: '직접 굴린 D100' }).press('Enter');
  await expect(exhaustion.getByRole('list', { name: '이번 장소 Exhaustion 기록' })).toContainText('Exhaustion −1 (날 Cooking Ingredients');
  await expect(exhaustion.getByRole('textbox', { name: '현재 Exhaustion' })).toHaveValue('16');

  await page.getByRole('button', { name: '저널', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Exhaustion −1 \(날 Cooking Ingredients/ })).toBeVisible();
  const gear = await openDrawer(page, '장비');
  await expect(gear).toContainText('Torch');
  await expect(gear).toContainText('Crafting Supplies');
  await noOverflow(page, 1440);
});

test('XP from the character tab feeds the level-up, which raises the level and resets XP', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '캐릭터');
  await drawer.getByRole('textbox', { name: 'PC 레벨' }).fill('2');
  await drawer.getByRole('textbox', { name: 'XP', exact: true }).fill('1040');
  await expect(drawer.getByText(/레벨업 가능/)).toBeVisible();

  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('group', { name: '정리할 항목' }).getByRole('button', { name: 'XP·레벨업', exact: true }).click();
  const advancement = page.getByRole('region', { name: '레벨업과 능력 해금' });
  await expect(advancement.getByRole('textbox', { name: '종이 시트 레벨' })).toHaveValue('2');
  await expect(advancement.getByRole('textbox', { name: '보유 XP' })).toHaveValue('1040');
  await advancement.getByRole('group', { name: '레벨업 혜택 하나' }).getByRole('button', { name: 'Health +D4' }).click();
  await roll(advancement, 'Health 증가량 D4', '3');
  await advancement.getByRole('button', { name: '레벨업 기록' }).click();
  await expect(drawer.getByRole('textbox', { name: 'PC 레벨' })).toHaveValue('3');
  await expect(drawer.getByRole('textbox', { name: 'XP', exact: true })).toHaveValue('0');
});
