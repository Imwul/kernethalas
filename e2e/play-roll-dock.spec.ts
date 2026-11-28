import { expect, test, type Page } from '@playwright/test';
import { choose } from './helpers/choice';

const dock = (page: Page) => page.getByRole('region', { name: '다음 행동 바로가기' });
const entry = (page: Page) => dock(page).getByRole('textbox', { name: '다음 굴림 결과 입력' });
const target = (page: Page) => dock(page).locator('#play-jump-roll-target');

async function type(page: Page, value: string) {
  await entry(page).fill(value);
  await entry(page).press('Enter');
}

for (const { width, height } of [{ width: 360, height: 760 }, { width: 1440, height: 900 }]) {
  test(`the dice tray takes each result for the tool that asks next at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/play');
    const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
    await expect(target(page)).toContainText(/방\s*·\s*통로 모양/);
    await type(page, '29');
    await expect(explore.getByRole('img', { name: /29번 방 모양/ })).toBeVisible();
    await expect(target(page)).toContainText('은신처 소모 주사위');
    await expect(entry(page)).toBeFocused();
    await type(page, '8');
    await expect(target(page)).toContainText('긴장 주사위');
    await type(page, '2');
    await expect(target(page)).toContainText('조우 판정');
    await type(page, '12');
    // With nothing left to roll, the tray offers the next step itself.
    await expect(dock(page)).toHaveAttribute('data-kind', 'step');
    const step = dock(page).getByRole('button', { name: '다음 단계 진행' });
    await expect(step).toHaveAccessibleDescription(/조우 표로/);
    await step.click();
    await expect(page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }))
      .toHaveAttribute('aria-current', 'step');
    await expect(target(page)).toContainText('표 선택');
    await dock(page).getByRole('button', { name: '직전 굴림 되돌리기' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('the tray points at a missing score instead of guessing it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/play');
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Necropede');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  // Skip the start step here: the tray would ask for Initiative first.
  const start = combat.getByRole('button', { name: /^조우 시작/ });
  await start.click();
  await expect(start).toHaveAttribute('aria-expanded', 'false');
  const card = combat.getByRole('region', { name: '전투 카드' });
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill('1');
  await card.getByRole('textbox', { name: '직접 굴린 값' }).press('Enter');
  const attack = card.getByRole('region', { name: '적 공격' });
  await attack.getByRole('textbox', { name: '공격자 D100', exact: true }).fill('31');
  await expect(target(page)).toContainText('방어자');
  await type(page, '79');
  await expect(dock(page).getByRole('status')).toHaveText('먼저 입력할 값 · 방어자 수치');
  await expect(attack.getByRole('textbox', { name: '방어자 수치', exact: true })).toBeFocused();
  await attack.getByRole('textbox', { name: '방어자 수치', exact: true }).fill('45');
  await expect(attack.getByRole('status', { name: '공격 판정 결과' })).toContainText('공격자 명중');
  await expect(target(page)).toContainText('명중 부위');

  // A number key anywhere on the desk starts the entry in the tray.
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('7');
  await expect(entry(page)).toBeFocused();
  await expect(entry(page)).toHaveValue('7');
  await page.keyboard.press('Enter');
  await expect(card.getByRole('region', { name: 'PC 명중 부위' }).getByRole('status')).toContainText('복부');
});
