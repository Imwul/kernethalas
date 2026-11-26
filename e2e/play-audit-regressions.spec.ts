import { expect, test, type Locator } from '@playwright/test';
import { closeDrawer, openDrawer } from './helpers/play-desk';

async function enter(scope: Locator, value: string, name = '직접 굴린 값') {
  const input = scope.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('intermediate mobile widths keep the campaign menu in bounds and the drawer traps focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  const campaign = page.getByRole('button', { name: '플레이 캠페인 선택' });
  await campaign.click();
  const picker = page.getByRole('region', { name: '플레이 캠페인 관리' });
  await expect(picker).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.keyboard.press('Escape');
  const drawer = await openDrawer(page, '이력');
  await expect(drawer).toHaveJSProperty('open', true);
  await drawer.getByRole('button', { name: '서랍 닫기' }).focus();
  await page.keyboard.press('n');
  await expect(drawer.getByRole('button', { name: '서랍 닫기' })).toBeFocused();
  for (let index = 0; index < 14; index += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement?.closest('#play-drawer'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  const sources = page.getByRole('link', { name: '출처 · 수록 범위 · 검증 현황' });
  await sources.focus();
  await expect.poll(async () => {
    const link = await sources.boundingBox();
    const bar = await page.getByRole('region', { name: '다음 행동 바로가기' }).boundingBox();
    return link && bar ? bar.y - link.y - link.height : -1;
  }).toBeGreaterThan(0);
});

test('a folded Lair die advances keyboard focus to the Tension field', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await enter(explore.getByRole('region', { name: '은신처 소모 주사위' }), '8');
  await expect(explore.getByRole('textbox', { name: '긴장 주사위 굴린 값' })).toBeFocused();
});

test('a survivor can start anew in the same room without inheriting old wounds or penalties', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '캐릭터');
  await drawer.getByRole('textbox', { name: 'PC 레벨' }).fill('1');
  await drawer.getByRole('group', { name: '캐릭터 항목' }).getByRole('button', { name: /^상태/ }).click();
  const exhaustion = drawer.getByRole('region', { name: 'Exhaustion', exact: true });
  await exhaustion.getByRole('textbox', { name: '현재 Exhaustion' }).fill('0');
  for (const value of [5, 5, 5, 5, 1]) await exhaustion.getByRole('button', { name: `+${value}`, exact: true }).click();
  await drawer.getByRole('button', { name: '사망 기록 · 새 생존자로' }).click();
  await drawer.getByRole('button', { name: '새 생존자 만들기' }).click();
  const creator = page.locator('.play-character-workspace .creator');
  await creator.getByRole('button', { name: '완전 자동 생성' }).click();
  await creator.getByRole('button', { name: '캐릭터 탭에 채우기' }).click();
  await expect(creator.getByText('시작 장비를 장부에 넣었습니다', { exact: false })).toBeVisible();
  await creator.getByRole('button', { name: '캐릭터 탭 보기' }).click();
  await drawer.getByRole('group', { name: '캐릭터 항목' }).getByRole('button', { name: /^상태/ }).click();
  await expect(exhaustion.getByRole('textbox', { name: '현재 Exhaustion' })).toHaveValue('0');
  await expect(drawer.getByRole('button', { name: '사망 기록 · 새 생존자로' })).toHaveCount(0);
  await page.reload();
  await openDrawer(page, '캐릭터');
  await expect(exhaustion.getByRole('textbox', { name: '현재 Exhaustion' })).toHaveValue('0');
});

test('introductory damage can be recorded with physical dice and becomes a single paper entry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '도메인');
  await drawer.getByRole('combobox', { name: '도메인 방식' }).selectOption('intro');
  await closeDrawer(page);
  await page.getByText('도입 도메인 지도와 시작 불이익', { exact: true }).click();
  const start = page.getByRole('region', { name: '도입 도메인 시작 불이익' });
  await enter(start.getByRole('group', { name: '시작 피해 D6' }), '3');
  await enter(start.getByRole('group', { name: '시작 Sanity 손실 D4' }), '2');
  await start.getByRole('button', { name: '시작 불이익 기록 · Exhaustion +1' }).click();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: '피해 3 (도입 도메인 시작)' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Sanity −2 (도입 도메인 시작)' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Exhaustion +1 (도입 도메인 시작)' })).toHaveCount(1);
});

test('victory records the XP bonus for a creature strengthened by Growing Darkness', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  const tension = explore.getByRole('region', { name: '긴장 주사위' });
  await tension.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('4');
  await enter(tension, '2', '긴장 주사위 굴린 값');
  await enter(explore.getByRole('region', { name: '짙어지는 어둠' }), '81');
  const drawer = await openDrawer(page, '도메인');
  await enter(drawer.getByRole('group', { name: /^어둠 81 추가 영향력/ }), '1');
  await closeDrawer(page);
  await enter(explore.getByRole('region', { name: '조우 판정' }), '10');
  await explore.getByRole('button', { name: '조우 표로' }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('Giant Spider');
  await combat.getByRole('button', { name: 'Giant Spider', exact: true }).click();
  await combat.getByRole('combobox', { name: 'Giant Spider 상태' }).selectOption('defeated');
  await combat.getByRole('button', { name: '승리 후 전투 마치기' }).click();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'XP +60 (승리)' })).toBeVisible();
});
