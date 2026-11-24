import { expect, test, type Locator } from '@playwright/test';
import { openDrawer, openPane, setViewOption } from './helpers/play-desk';

const region = (scope: Pick<Locator, 'getByRole'>, name: string) => scope.getByRole('region', { name, exact: true });
const button = (scope: Pick<Locator, 'getByRole'>, name: string) => scope.getByRole('button', { name, exact: true });

async function enter(scope: Locator, name: string, value: string) {
  const input = scope.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('focus view folds finished steps, exposes follow-up rolls and returns to the previous stage position', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  const explore = region(page, '장소 탐험');
  // Finished entry rolls fold by default; turning the view off and on again keeps the choice.
  await setViewOption(page, '집중 보기', false);
  await setViewOption(page, '집중 보기', true);
  await button(explore, '방').click();
  await enter(region(explore, '은신처 소모 주사위'), '직접 굴린 값', '5');
  const tension = region(explore, '긴장 주사위');
  await enter(tension, '긴장 주사위 굴린 값', '3');
  const unfold = tension.getByRole('button', { name: 'D8 3 · 다음 D8 다시 보기' });
  await expect(unfold).toHaveAttribute('aria-expanded', 'false');
  await unfold.click();
  await expect(tension.getByRole('status')).toContainText('D8 결과3');

  const encounter = region(explore, '조우 판정');
  await enter(encounter, '직접 굴린 값', '1');
  await expect(encounter.getByRole('button', { name: /D20 1.*다시 보기/ })).toHaveAttribute('aria-expanded', 'false');
  const event = region(explore, '이벤트');
  await enter(event, '직접 굴린 값', '59');
  await expect(event.getByRole('button', { name: /D100 59.*다시 보기/ })).toHaveAttribute('aria-expanded', 'false');
  const follow = explore.getByRole('group', { name: 'Exhaustion 감소 D4', exact: true });
  await expect(follow).toBeVisible();
  await button(region(page, '다음 행동 바로가기'), '다음 행동').click();
  await expect(follow.getByRole('textbox', { name: '직접 굴린 값', exact: true })).toBeFocused();

  const heading = page.getByRole('heading', { name: '이번 장소 탐험', exact: true });
  const offset = () => heading.evaluate((element) => element.getBoundingClientRect().top);
  const original = await offset();
  await button(stages, '저널').click();
  await button(stages, '탐험').click();
  await expect.poll(async () => Math.abs(await offset() - original)).toBeLessThanOrEqual(3);
  await page.reload();
  await page.getByRole('button', { name: '보기 설정', exact: true }).click();
  await expect(page.getByRole('group', { name: '보기 설정' }).getByRole('button', { name: '집중 보기', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('a pinned reference tool preserves controls across phases without recording a play roll', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const pinned = page.locator('.play-pinned-tool');
  await openDrawer(page, '도구');
  const tools = pinned.getByRole('combobox', { name: '플레이에 고정할 도구' });
  await tools.selectOption('p-tension');
  const tension = pinned.locator('.tension-tool');
  await enter(tension, '긴장 주사위 굴린 값', '3');
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  await button(stages, '조우·전투').click();
  await expect(tension.getByRole('status')).toContainText('D8 결과3');
  await page.getByRole('button', { name: '이번 장소 굴림 이력으로 이동' }).click();
  await expect(region(page, '이번 장소 굴림 이력')).toContainText('이 장소의 판정을 확인하면');
  await openDrawer(page, '도구');
  for (const width of [320, 1366, 3440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(tension.getByRole('status')).toContainText('D8 결과3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.reload();
  await openDrawer(page, '도구');
  await expect(tools).toHaveValue('p-tension');
});

test('changing a recorded supply reward shows only the affected paper line and marks its replacement on confirmation', async ({ page }) => {
  await page.goto('/play');
  const explore = region(page, '장소 탐험');
  await button(explore, '방').click();
  await enter(region(explore, '긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await enter(region(explore, '조우 판정'), '직접 굴린 값', '1');
  await enter(region(explore, '이벤트'), '직접 굴린 값', '55');
  await openPane(explore, '방 뒤지기');
  const search = region(explore, '방 뒤지기 판정 1회차');
  await search.getByLabel('Scavenge 수치').fill('55');
  await enter(search, 'Scavenge D100', '31');
  await enter(search.getByRole('group', { name: '뒤지기 결과 D20' }), '직접 굴린 값', '4');
  const amount = search.getByRole('group', { name: 'Crafting Supplies 수량 D4' });
  await enter(amount, '직접 굴린 값', '3');

  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  await button(stages, '저널').click();
  const journal = region(page, '이번 장소 기록');
  const applied = journal.getByRole('group', { name: '종이 시트에 반영' });
  await applied.getByRole('checkbox', { name: 'Crafting Supplies +3', exact: true }).check();
  await applied.getByRole('checkbox', { name: '광원 −1', exact: true }).check();
  await button(journal, '장비 장부에서 변경 확인').click();
  const gear = region(page, '현재 장비와 소모 내역');
  await button(gear, '장부에 반영 Crafting Supplies +3').click();
  await expect(region(gear, '가방')).toContainText('Crafting Supplies');
  const history = region(await openDrawer(page, '이력'), '이번 장소 굴림 이력');
  await button(history, 'Crafting Supplies 수량 D4 3 수정 미리보기').click();
  await button(history, '이 굴림부터 다시 입력').click();
  await expect(amount.getByRole('textbox', { name: '직접 굴린 값' })).toBeFocused();
  await enter(amount, '직접 굴린 값', '1');
  await button(stages, '저널').click();
  const correction = region(journal, '종이 시트 정정표');
  await expect(correction).toContainText('Crafting Supplies +3');
  await expect(correction).toContainText('Crafting Supplies +1');
  await expect(correction).not.toContainText('광원');
  const ledgerCorrection = region(journal, '장부 정정 필요');
  await expect(ledgerCorrection).toContainText('Crafting Supplies +3');
  await expect(ledgerCorrection).toContainText('Crafting Supplies +1');
  await page.reload();
  await button(correction, 'Crafting Supplies +3 정정 반영').click();
  await expect(correction).toHaveCount(0);
  await expect(applied.getByRole('checkbox', { name: 'Crafting Supplies +1', exact: true })).toBeChecked();
  await expect(applied.getByRole('checkbox', { name: '광원 −1', exact: true })).toBeChecked();
  await button(journal, '다음 장소').click();
  await openDrawer(page, '도메인');
  await page.getByText('탐험 연대기', { exact: true }).click();
  const timeline = region(page, '도메인 탐험 연대기');
  await timeline.getByText('장소 1', { exact: true }).click();
  await expect(timeline.getByRole('checkbox', { name: '장부 정정 · Crafting Supplies +3 → Crafting Supplies +1' })).toBeVisible();
});
