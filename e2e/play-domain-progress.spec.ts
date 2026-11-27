import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer, openPane } from './helpers/play-desk';
import { choose } from './helpers/choice';

const explore = (page: Page) => page.getByRole('region', { name: '장소 탐험' });
async function showDomain(page: Page, name: string) {
  const drawer = await openDrawer(page, '도메인');
  await expect(drawer.getByRole('heading', { level: 2 })).toHaveText(name);
  return drawer;
}

async function enter(scope: Locator, name: string, value: string) {
  const field = scope.getByRole('textbox', { name, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

async function advance(page: Page) {
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('button', { name: '다음 장소', exact: true }).click();
}

async function place(page: Page, value: '방' | '통로') {
  await explore(page).getByRole('group', { name: '장소 종류' }).getByRole('button', { name: value, exact: true }).click();
}

test('physical Lair and Exit checks carry across rooms, undo, reload and the trip back', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const lairName = '지하묘지의빛바랜은신처와돌층계가이어지는검은예배당';

  for (const [index, die] of ['D10', 'D8', 'D6', 'D4'].entries()) {
    await place(page, '방');
    const lair = explore(page).getByRole('region', { name: '은신처 소모 주사위' });
    await expect(lair).toContainText(`현재 주사위 ${die}`);
    await enter(lair, '직접 굴린 값', '2');
    if (index === 0) {
      await expect(lair.getByRole('status')).toContainText('다음 주사위 D8');
      await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
      await expect(lair).toContainText('현재 주사위 D10');
      await enter(lair, '직접 굴린 값', '2');
      await page.reload();
      await expect(lair.getByRole('status')).toContainText('다음 주사위 D8');
    }
    if (die === 'D4') {
      await expect(lair.getByRole('status')).toContainText('Overseer 은신처 발견');
      await enter(explore(page), '긴장 주사위 굴린 값', '3');
      await expect(explore(page).getByRole('button', { name: 'Overseer 조우로' })).toBeVisible();
      await expect(explore(page).getByRole('region', { name: '조우 판정', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: '저널', exact: true }).click();
      await page.getByRole('textbox', { name: '장소 이름 (선택)' }).fill(lairName);
    }
    await advance(page);
  }

  for (const die of ['D8', 'D6', 'D4']) {
    await place(page, '통로');
    const exit = explore(page).getByRole('region', { name: '출구 소모 주사위' });
    await enter(exit, '직접 굴린 값', '2');
    if (die !== 'D4') await advance(page);
    else await expect(exit.getByRole('status')).toContainText('도메인 출구 발견');
  }

  await enter(explore(page), '긴장 주사위 굴린 값', '3');
  const encounter = explore(page).getByRole('region', { name: '조우 판정', exact: true });
  await expect(encounter).toBeVisible();
  await enter(encounter, '직접 굴린 값', '1');
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('textbox', { name: '장소 이름 (선택)', exact: true }).fill('출구 통로');
  await page.getByRole('textbox', { name: '덧붙일 메모 (선택)', exact: true }).fill('출구 왼쪽의 종이 표식');
  await page.getByRole('button', { name: '탐험', exact: true }).click();
  await explore(page).getByRole('button', { name: '출구로 이동 선택' }).click();
  await explore(page).getByRole('button', { name: '이 도메인에 남기' }).click();
  await expect(explore(page).getByRole('button', { name: '출구로 이동 확정' })).toHaveCount(0);
  await explore(page).getByRole('button', { name: '출구로 이동 선택' }).click();
  await explore(page).getByRole('button', { name: '출구로 이동 확정' }).click();
  await showDomain(page, '도메인 2');
  await closeDrawer(page);
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'XP +50 · 새 도메인 첫 진입' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: '탐험', exact: true }).click();
  await place(page, '방');
  await openPane(explore(page), '은신처·출구 직접 표시');
  await explore(page).getByRole('checkbox', { name: '이 방이 Overseer 은신처' }).check();
  await advance(page);
  await place(page, '통로');
  await expect(explore(page).getByRole('region', { name: '출구 소모 주사위' })).toBeVisible();
  await openPane(explore(page), '은신처·출구 직접 표시');
  await explore(page).getByRole('checkbox', { name: '지도에 표시된 출구 위치' }).check();
  await enter(explore(page), '긴장 주사위 굴린 값', '3');
  await explore(page).getByRole('button', { name: '출구로 이동 선택' }).click();
  await explore(page).getByRole('combobox', { name: '도착할 도메인' }).selectOption('1');
  await explore(page).getByRole('button', { name: '출구로 이동 확정' }).click();
  const effects = page.getByRole('region', { name: '도메인 효과' });
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'XP +50 · 새 도메인 첫 진입' })).toHaveCount(0);
  await showDomain(page, '도메인 1');
  await expect(effects.getByRole('region', { name: '도메인 진행 설정' })).toContainText('발견한 출구');
  await expect(effects.getByRole('region', { name: '도메인 진행 설정' })).toContainText(lairName);
  await effects.getByText('탐험 연대기', { exact: true }).click();
  const timeline = effects.getByRole('region', { name: '도메인 탐험 연대기', exact: true });
  await timeline.getByText('출구 통로', { exact: true }).click();
  await expect(timeline.getByText('출구 왼쪽의 종이 표식', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('the introductory paper map uses its own encounter lookup and a marked exit', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  await showDomain(page, '도메인 1');
  const effects = page.getByRole('region', { name: '도메인 효과' });
  const settings = effects.getByRole('region', { name: '도메인 진행 설정' });
  await choose(settings, '도메인 방식', 'intro');
  await settings.getByRole('button', { name: '첫 진입 기록 · XP +50' }).click();
  await expect(settings.getByRole('button', { name: '첫 진입 기록 · XP +50' })).toHaveCount(0);
  await closeDrawer(page);

  await place(page, '방');
  await expect(explore(page).getByRole('button', { name: '모양으로 결정' })).toHaveCount(0);
  await explore(page).getByText('도입 지도', { exact: true }).click();
  await expect(explore(page).getByRole('region', { name: '은신처 소모 주사위' })).toHaveCount(0);
  await enter(explore(page), '긴장 주사위 굴린 값', '3');
  await enter(explore(page).getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '10');
  const intro = explore(page).getByRole('region', { name: '도입 도메인 조우' });
  await enter(intro, '직접 굴린 값', '15');
  await expect(intro.getByRole('status')).toContainText('살점 포식자');
  await intro.getByRole('button', { name: '도입 도메인 조우로' }).click();
  await expect(page.getByRole('heading', { name: '살점 포식자', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '탐험', exact: true }).click();
  await explore(page).getByRole('checkbox', { name: '지도에 표시된 출구 위치' }).check();
  await expect(explore(page).getByRole('region', { name: '출구 소모 주사위' })).toHaveCount(0);
  await explore(page).getByRole('button', { name: '출구로 이동 선택' }).click();
  await explore(page).getByRole('button', { name: '출구로 이동 확정' }).click();
  await showDomain(page, '도메인 2');
  await expect(effects.getByRole('combobox', { name: '도메인 전환' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});
