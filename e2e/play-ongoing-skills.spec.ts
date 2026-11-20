import { expect, test, type Locator, type Page } from '@playwright/test';

const by = (scope: Pick<Locator, 'getByRole'>, role: Parameters<Locator['getByRole']>[0], name: string) => scope.getByRole(role, { name, exact: true });
const button = (scope: Pick<Locator, 'getByRole'>, name: string) => by(scope, 'button', name);
const region = (scope: Pick<Locator, 'getByRole'>, name: string) => by(scope, 'region', name);

async function roll(scope: Locator, name: string, value: string) {
  const input = by(scope, 'textbox', name);
  await input.fill(value);
  await input.press('Enter');
}

async function go(page: Page, stage: string) {
  await button(by(page, 'navigation', '플레이 단계'), stage).click();
}

test('ongoing conditions and abilities survive a room transition, and rests reopen the matching uses', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const panel = page.locator('.play-ongoing');
  const toggle = panel.locator(':scope > summary');
  await toggle.click();
  const ongoing = region(panel, '현재 남은 상태와 능력');
  await by(ongoing, 'checkbox', '출혈').check();
  await ongoing.getByText('사용·유지 상태 직접 추가', { exact: true }).click();
  for (const [name, kind] of [['Vanish', 'rest'], ['Absolution', 'camp']]) {
    await by(ongoing, 'textbox', '능력 이름').fill(name);
    await by(ongoing, 'combobox', '기록할 상태').selectOption(kind);
    await button(ongoing, '상태 기록').click();
  }

  await go(page, '조우·전투');
  const combat = region(page, '조우와 전투 도구');
  await combat.getByText('Mastery 능력과 마법 전투', { exact: true }).click();
  const mastery = region(combat, 'PC Mastery 능력');
  await by(mastery, 'combobox', '종이 시트의 Mastery').selectOption('m-abyssal-reaver');
  await by(mastery, 'combobox', '배운 마지막 Tier').selectOption('2');
  await by(mastery, 'combobox', '사용할 능력').selectOption({ label: 'Hellish Weapon' });
  await button(mastery, '능력 사용 기록').click();
  await expect(ongoing).toContainText('최대 Aether −5');

  await go(page, '탐험');
  await button(region(page, '장소 탐험'), '방').click();
  await go(page, '저널');
  const journal = region(page, '이번 장소 기록');
  await button(journal, '다음 장소').click();
  await page.reload();
  await toggle.click();
  await expect(by(ongoing, 'checkbox', '출혈')).toBeChecked();
  await expect(ongoing).toContainText('다음 방 · Health −1');
  await expect(ongoing).toContainText('Hellish Weapon');
  await expect(ongoing).toContainText('Absolution');
  await expect(ongoing).toContainText('Vanish');

  await go(page, '휴식·정리');
  const wrap = region(page, '휴식과 전리품 정리');
  await button(wrap, '숨 고르기').click();
  await roll(by(wrap, 'group', '숨 고르기 회복 D10'), '직접 굴린 값', '4');
  await button(wrap, '숨 고르기 완료 확인').click();
  await expect(button(wrap, '숨 고르기 완료됨')).toBeDisabled();
  await expect(ongoing).not.toContainText('Vanish');
  await expect(ongoing).toContainText('Absolution');
  await expect(ongoing).toContainText('Hellish Weapon');

  await button(wrap, '야영').click();
  await roll(region(wrap, '야영 계산기'), '직접 굴린 D20', '20');
  await button(wrap, '야영 완료 확인').click();
  await expect(ongoing).not.toContainText('Absolution');
  await expect(by(ongoing, 'checkbox', '출혈')).toBeChecked();
  await button(ongoing, 'Hellish Weapon 유지 해제 기록').click();
  await go(page, '저널');
  await expect(by(journal, 'checkbox', '최대 Aether +5 (Hellish Weapon 유지 해제)')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('Scavenge saves a basic value, explains modifiers in history and reuses the value in the next room', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = region(page, '장소 탐험');
  const enterRoom = async () => {
    await button(explore, '방').click();
    await roll(region(explore, '긴장 주사위'), '긴장 주사위 굴린 값', '3');
    await roll(region(explore, '조우 판정'), '직접 굴린 값', '1');
    await roll(region(explore, '이벤트'), '직접 굴린 값', '55');
    await explore.getByText('방 뒤지기', { exact: true }).click();
    return region(explore, '방 뒤지기 판정 1회차');
  };
  const first = await enterRoom();
  const skill = by(first, 'textbox', '보정 Scavenge Skill');
  await skill.fill('55');
  await first.getByText('기본값·보정', { exact: true }).click();
  await button(first, '현재 수치를 기본값으로 저장').click();
  await button(first, '보정 추가').click();
  await by(first, 'textbox', '보정값 1').fill('−10');
  await button(first, '보정 추가').click();
  await by(first, 'combobox', '보정 이유 2').selectOption('난이도');
  await by(first, 'textbox', '보정값 2').fill('+20');
  await expect(first.locator('.play-skill-total')).toContainText('기본 55 · 상태·어둠 −10 · 난이도 +20 = 65');
  await roll(first, 'Scavenge D100', '61');
  await expect(by(first, 'group', '뒤지기 결과 D20')).toBeVisible();
  await go(page, '저널');
  const history = region(page, '이번 장소 굴림 이력');
  await expect(history).toContainText('기본 55 · 상태·어둠 −10 · 난이도 +20 = 65');
  await button(region(page, '이번 장소 기록'), '다음 장소').click();
  await page.reload();
  const next = await enterRoom();
  await next.getByText('기본값·보정', { exact: true }).click();
  await button(next, 'Scavenge 55 불러오기').click();
  await expect(by(next, 'textbox', '보정 Scavenge Skill')).toHaveValue('55');
  await expect(next.getByRole('textbox', { name: /^보정값/ })).toHaveCount(0);
});
