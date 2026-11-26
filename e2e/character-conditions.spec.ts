import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDrawer } from './helpers/play-desk';

const by = (scope: Pick<Locator, 'getByRole'>, role: Parameters<Locator['getByRole']>[0], name: string) => scope.getByRole(role, { name, exact: true });

async function go(page: Page, stage: string) {
  await by(by(page, 'navigation', '플레이 단계'), 'button', stage).click();
}

async function check(scope: Locator, skill: string, roll: string) {
  await scope.getByRole('textbox', { name: `${skill} 수치` }).fill(skill === 'Endurance' ? '50' : '40');
  const input = scope.getByRole('textbox', { name: '직접 굴린 D100' });
  await input.fill(roll);
  await input.press('Enter');
}

test('a creature poison reaches the PC, each round asks for its damage, and Endurance ends it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('Giant Spider');
  await combat.getByRole('button', { name: 'Giant Spider', exact: true }).click();

  const card = combat.getByRole('region', { name: '전투 카드' }).first();
  await card.getByRole('textbox', { name: '직접 굴린 값' }).first().fill('1');
  await card.getByRole('button', { name: '확인', exact: true }).first().click();
  await card.getByRole('button', { name: 'PC에 적용 · 중독 (1)' }).click();
  await expect(card.getByRole('button', { name: '중독 적용함' })).toBeDisabled();
  const warnings = page.getByRole('group', { name: '캐릭터 경고' });
  await expect(warnings.getByRole('button', { name: '중독' })).toBeVisible();

  const lingering = combat.getByRole('region', { name: '전투 중 지속 피해' });
  await expect(lingering).toContainText('1라운드 지속 피해 · 1');
  await lingering.getByRole('button', { name: '중독 1 올리기' }).click();
  await lingering.getByRole('button', { name: '1라운드 피해 기록 · 2' }).click();
  await expect(lingering.getByRole('button', { name: '1라운드 기록함' })).toBeDisabled();
  await lingering.getByRole('button', { name: '2라운드로' }).click();
  await expect(lingering).toContainText('2라운드 지속 피해 · 2');

  await check(lingering.getByRole('group', { name: '중독 저항 Endurance (자유 행동)' }), 'Endurance', '12');
  await expect(warnings).toHaveCount(0);
  await expect(combat.getByRole('group', { name: 'PC 지속 피해 상태 추가' })).toBeVisible();

  await go(page, '저널');
  await expect(page.getByRole('checkbox', { name: '1라운드 지속 피해 2 (중독 2 · Armor 무시)' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '중독 해제 (Endurance 저항 성공)' })).toBeVisible();
});

test('a place entered while bleeding asks for its Health damage and offers a bandage at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '상태');
  await drawer.getByRole('checkbox', { name: '출혈' }).check();
  await drawer.getByRole('button', { name: '닫기' }).click();
  const entry = page.getByRole('region', { name: '지속 피해' });
  await expect(entry).toContainText('다음 장소부터 장소마다 Health −1 · 출혈');

  await page.getByRole('region', { name: '장소 탐험' }).getByRole('button', { name: '방', exact: true }).click();
  await go(page, '저널');
  await page.getByRole('region', { name: '이번 장소 기록' }).getByRole('button', { name: '다음 장소', exact: true }).click();
  await go(page, '탐험');
  await expect(entry.getByRole('alert')).toHaveText('이 장소에 들어오며 지속 피해 · Health −1');
  await entry.getByRole('button', { name: '붕대 치료 (Medicine)' }).click();
  await expect(entry.getByRole('region', { name: '지속 피해와 붕대 처치' })).toBeVisible();
  await entry.getByRole('button', { name: '피해 기록 · Health −1' }).click();
  await expect(entry).toContainText('지속 피해 기록함 · Health −1');
  await go(page, '저널');
  await expect(page.getByRole('checkbox', { name: '출혈 · Health −1 (지속 피해 · Armor 무시)' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('Madness at Sanity 0 restores Sanity, and death is recorded with an undo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '캐릭터');
  await drawer.getByRole('textbox', { name: 'PC 레벨' }).fill('2');
  await drawer.getByRole('textbox', { name: '이름' }).fill('Mara');
  const tabs = drawer.getByRole('group', { name: '캐릭터 항목' });
  await tabs.getByRole('button', { name: /^상태/ }).click();

  const sanity = drawer.getByRole('region', { name: 'Sanity', exact: true });
  await sanity.getByRole('textbox', { name: '최대 Sanity' }).fill('12');
  await sanity.getByRole('textbox', { name: '현재 Sanity' }).fill('0');
  await expect(page.getByRole('group', { name: '캐릭터 경고' }).getByRole('button', { name: 'Sanity 0 · 광기' })).toBeVisible();
  const madness = sanity.getByRole('alert');
  const input = madness.getByRole('textbox', { name: '직접 굴린 값' });
  await input.fill('10');
  await input.press('Enter');
  await madness.getByRole('button', { name: '광기 기록 · Sanity 12으로 회복' }).click();
  await expect(sanity.getByRole('textbox', { name: '현재 Sanity' })).toHaveValue('12');

  const exhaustion = drawer.getByRole('region', { name: 'Exhaustion', exact: true });
  await exhaustion.getByRole('textbox', { name: '현재 Exhaustion' }).fill('21');
  await drawer.getByRole('button', { name: '사망 기록 · 새 생존자로' }).click();
  await expect(drawer.getByText('Mara · 레벨 2 · Exhaustion 21 이상로 사망 기록')).toBeVisible();
  await drawer.getByRole('button', { name: '되돌리기' }).click();
  await tabs.getByRole('button', { name: /^기본/ }).click();
  await expect(drawer.getByRole('textbox', { name: '이름' })).toHaveValue('Mara');
  await expect(drawer.getByRole('button', { name: '지난 생존자' })).toHaveCount(0);

  await go(page, '저널');
  await expect(page.getByRole('checkbox', { name: 'XP +100 (광기)' })).toBeVisible();
});
