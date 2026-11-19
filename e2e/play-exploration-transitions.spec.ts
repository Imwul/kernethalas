import { expect, test, type Locator, type Page } from '@playwright/test';
import { detectTrap, skillRoll } from './helpers/skill-roll';

async function physicalRoll(section: Locator, name: string, value: string) {
  const input = section.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

async function enterPlace(page: Page, place: '방' | '통로', encounter: string) {
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: place, exact: true }).click();
  const tension = explore.getByRole('region', { name: '긴장 주사위', exact: true });
  await tension.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('6');
  await physicalRoll(tension, '긴장 주사위 굴린 값', '2');
  await physicalRoll(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', encounter);
  return { explore, tension };
}

test('a trap event opens the same environmental trap form at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const { explore } = await enterPlace(page, '방', '9');
  const event = explore.getByRole('region', { name: '이벤트', exact: true });
  await physicalRoll(event, '직접 굴린 값', '7');
  const followUp = explore.getByRole('region', { name: '이벤트 후속 판정' });
  await followUp.getByRole('button', { name: '환경 함정 처리로', exact: true }).click();

  const actions = explore.getByRole('region', { name: '선택 탐험 행동' });
  await expect(actions.getByText('환경 함정', { exact: true })).toBeFocused();
  const trap = actions.getByRole('region', { name: '환경 함정 조사', exact: true });
  await expect(trap).toBeVisible();
  await expect(trap.getByRole('textbox', { name: '함정 여부 D10' })).toHaveCount(0);
  await expect(trap.getByRole('textbox', { name: '잠김 여부 D20' })).toHaveCount(0);
  await detectTrap(trap);
  await physicalRoll(trap, '함정 종류 D10', '2');
  await trap.getByLabel('함정 처리 방법').selectOption('disarm');
  await skillRoll(trap, '해제 판정', 'Thievery', 50, 32, 4);
  await expect(trap.getByText('함정 해제 · XP +10', { exact: true })).toBeVisible();
  await page.reload();
  await followUp.getByRole('button', { name: '환경 함정 처리로', exact: true }).click();
  await expect(trap.getByText('함정 해제 · XP +10', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('an event links all three optional room actions and a corridor links only door investigation', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { explore } = await enterPlace(page, '방', '9');
  await expect(explore.getByRole('group', { name: '탐험 후속 행동' })).toHaveCount(0);
  await physicalRoll(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '59');
  const next = explore.getByRole('group', { name: '탐험 후속 행동' });
  const actions = explore.getByRole('region', { name: '선택 탐험 행동' });
  for (const [button, summary] of [
    ['자물쇠·함정 처리', '문·함정 조사'],
    ['방 뒤지기로', '방 뒤지기'],
    ['깊은 수색으로', '깊은 수색'],
  ]) {
    await next.getByRole('button', { name: button, exact: true }).click();
    const heading = actions.getByText(summary, { exact: true });
    await expect(heading).toBeFocused();
    await expect(heading.locator('..')).toHaveAttribute('open', '');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);

  await explore.getByRole('button', { name: '통로', exact: true }).click();
  await physicalRoll(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '14');
  await expect(explore.getByRole('region', { name: '이벤트', exact: true })).toHaveCount(0);
  await expect(next.getByRole('button', { name: '자물쇠·함정 처리', exact: true })).toBeVisible();
  await expect(next.getByRole('button', { name: '방 뒤지기로', exact: true })).toHaveCount(0);
  await expect(next.getByRole('button', { name: '깊은 수색으로', exact: true })).toHaveCount(0);
});

test('combat wrap-up links back to the current room with its encounter and tension rolls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { explore, tension } = await enterPlace(page, '방', '12');
  await explore.getByRole('button', { name: '조우 표로', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await physicalRoll(combat, 'D6 결과', '4');
  await combat.getByRole('textbox', { name: 'D20 결과', exact: true }).fill('2');
  await combat.getByRole('button', { name: '생물 선택', exact: true }).click();
  await combat.getByRole('button', { name: '승리 후 전투 마치기', exact: true }).click();

  const resume = page.getByRole('group', { name: '이 장소 탐험 계속', exact: true });
  await expect(resume.getByRole('button', { name: '자물쇠·함정 처리', exact: true })).toBeVisible();
  await expect(resume.getByRole('button', { name: '방 뒤지기로', exact: true })).toBeVisible();
  await resume.getByRole('button', { name: '깊은 수색으로', exact: true }).click();
  const actions = explore.getByRole('region', { name: '선택 탐험 행동' });
  await expect(actions.getByText('깊은 수색', { exact: true })).toBeFocused();
  await expect(explore.getByRole('region', { name: '조우 판정', exact: true }).getByRole('status')).toContainText('12');
  await expect(tension.getByRole('status')).toContainText('다음 긴장 주사위 D4');
  await expect(explore.getByRole('region', { name: '이벤트', exact: true })).toHaveCount(0);
  await actions.getByRole('button', { name: '깊은 수색 시작' }).click();
  const deep = actions.getByRole('region', { name: '깊은 수색 긴장 굴림' });
  await expect(deep.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('4');
  await physicalRoll(deep, '긴장 주사위 굴린 값', '3');
  await expect(actions.getByRole('region', { name: '용기 조사', exact: true })).toBeVisible();
});
