import { expect, test, type Locator, type Page } from '@playwright/test';
import { detectTrap, skillRoll } from './helpers/skill-roll';

const WIDTH = Number(process.env.KN_FIELD_WIDTH ?? '320');
const region = (scope: Page | Locator, name: string) => scope.getByRole('region', { name, exact: true });
const button = (scope: Page | Locator, name: string) => scope.getByRole('button', { name, exact: true });
const box = (scope: Page | Locator, name: string) => scope.getByRole('textbox', { name, exact: true });
const choice = (scope: Page | Locator, name: string) => scope.getByRole('combobox', { name, exact: true });

async function roll(scope: Locator, label: string, value: string) {
  const input = box(scope, label);
  await input.fill(value);
  await input.press('Enter');
}

async function go(page: Page, label: string) {
  await button(page.getByRole('navigation', { name: '플레이 단계' }), label).click();
}

async function roomEvent(explore: Locator, result: string) {
  await roll(region(explore, '긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await roll(region(explore, '조우 판정'), '직접 굴린 값', '1');
  await roll(region(explore, '이벤트'), '직접 굴린 값', result);
}

test('numbered and manually labeled door reports return with the paper map without rewarding old XP', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.goto('/play');
  const explore = region(page, '장소 탐험');
  await roll(region(explore, '방·통로 모양'), '직접 굴린 값', '80');
  await explore.getByText('종이 지도에 모양 옮기기', { exact: true }).click();
  const tile = region(explore, '방·통로 모양 편집');
  await choice(tile, '표시할 출입구').selectOption({ label: '2번' });
  await explore.getByText('종이 지도 메모', { exact: true }).click();
  const paperMap = region(explore, '종이 지도 장소 색인');
  await box(paperMap, '종이 지도 번호').fill('B-07');
  await paperMap.getByRole('checkbox', { name: '잠긴 문', exact: true }).check();
  await button(paperMap, '장소 메모 저장').click();
  await roomEvent(explore, '55');
  await button(tile, '2번 출입구 조사').click();

  const actions = region(explore, '선택 탐험 행동');
  const mapping = region(actions, '종이 지도 출입구 연결');
  const exit = choice(mapping, '조사할 출입구');
  await expect(exit).toHaveValue('exit:2번 출입구');
  await choice(actions, '조사할 대상').selectOption('present');
  const door = region(actions, '문 조사');
  await detectTrap(door);
  await roll(door, '함정 여부 D10', '6');
  await roll(door, '잠김 여부 D20', '15');
  await skillRoll(door, '자물쇠 따기 판정', 'Thievery', 55, 31);
  await expect(door).toContainText('개방 성공 · XP +10');
  await button(actions, '선택한 출입구에 조사 저장').click();
  await expect(mapping).toContainText('함정 없음 · 문 개방');
  await button(actions, '다른 문 조사').click();

  await exit.selectOption('manual');
  await box(mapping, '출입구 표기').fill('북쪽 쇠창살 뒤');
  await roll(region(actions, '문이 있는가?'), '직접 굴린 값', '9');
  await button(actions, '선택한 출입구에 조사 저장').click();
  await go(page, '저널');
  const journal = region(page, '이번 장소 기록');
  await expect(journal).toContainText('B-07 · 2번 출입구 · 함정 없음 · 문 개방');
  await expect(journal).toContainText('B-07 · 북쪽 쇠창살 뒤 · 문 없음');
  await expect(journal.getByRole('checkbox', { name: 'XP +10', exact: true })).toBeVisible();
  await button(journal, '다음 장소').click();
  await page.reload();
  await explore.getByText('돌아갈 곳', { exact: true }).click();
  const returns = region(explore, '돌아갈 곳 목록');
  const saved = returns.getByRole('list', { name: '출입구별 문과 함정 기록' });
  await expect(saved).toContainText('2번 출입구');
  await expect(saved).toContainText('함정 없음 · 문 개방');
  await expect(saved).toContainText('북쪽 쇠창살 뒤');
  await expect(saved).toContainText('문 없음');
  await button(returns, 'B-07 재방문').click();
  await roll(region(explore, '긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await actions.getByText('문·함정 조사', { exact: true }).click();
  await exit.selectOption({ label: '2번 출입구' });
  await expect(mapping).toContainText('저장한 조사 · 함정 없음 · 문 개방');
  await go(page, '저널');
  await expect(journal.getByRole('checkbox', { name: 'XP +10', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH);
});

test('camp stock distinguishes known shortage from paper inventory before D20', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.goto('/play');
  const gearSummary = page.locator('.play-gear-fold > summary');
  await gearSummary.click();
  const gear = region(page, '현재 장비와 소모 내역');
  await button(gear, '장비 추가').click();
  const gearForm = gear.getByRole('form', { name: '장비 등록' });
  await box(gearForm, '품목 이름').fill('Crafting Supplies');
  await box(gearForm, '현재 수량').fill('1');
  await button(gearForm, '장부에 저장').click();
  await gearSummary.click();
  await go(page, '휴식·정리');
  const wrap = region(page, '휴식과 전리품 정리');
  await button(wrap, '야영').click();
  const camp = region(wrap, '야영 계산기');
  await box(camp, '방어벽 재료 수').fill('2');
  const stock = region(camp, '야영 전 보급 대조');
  await expect(stock.getByText('Crafting Supplies', { exact: true }).locator('..')).toContainText('필요 2개');
  await expect(stock.getByText('Crafting Supplies', { exact: true }).locator('..')).toContainText('가방 1개');
  await expect(stock).toContainText('장부 기준 1개 부족');
  await expect(stock.getByText('Ration', { exact: true }).locator('..')).toContainText('장부 미기록');
  await roll(camp, '직접 굴린 D20', '12');
  await expect(camp).toContainText('야영 판정 성공');
  await expect(stock).toHaveCount(0);
  await gearSummary.click();
  await expect(region(gear, '가방').locator('.play-gear-amount')).toHaveText('1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH);
});

test('a deferred roll reopens the selected attempt and stays identified after changing locations', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.goto('/play');
  const explore = region(page, '장소 탐험');
  await button(explore, '방').click();
  await roomEvent(explore, '55');
  await explore.getByText('방 뒤지기', { exact: true }).click();
  const attempts = explore.getByRole('group', { name: '방 뒤지기 시도 선택' });
  await button(attempts, '2회차').click();

  const disclosure = page.getByText('보류한 굴림', { exact: true });
  await disclosure.click();
  const tray = region(page, '보류한 굴림 목록');
  await choice(tray, '보류할 굴림').selectOption({ label: '방 뒤지기 2회차 · D100' });
  await box(tray, '대상 메모 (선택)').fill('동쪽 항아리');
  await button(tray, '보류 표시').click();
  await expect(tray.getByRole('list')).toContainText('장소 1 · 탐험');
  await expect(tray.getByRole('list')).toContainText('동쪽 항아리');
  await button(attempts, '1회차').click();
  await explore.getByText('방 뒤지기', { exact: true }).click();
  await go(page, '휴식·정리');
  await button(tray, '입력칸으로').click();
  const search = region(explore, '방 뒤지기 판정 2회차');
  await expect(box(search, 'Scavenge D100')).toBeFocused();
  await expect(button(attempts, '2회차')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await disclosure.click();
  await expect(tray.getByRole('list')).toContainText('동쪽 항아리');
  await go(page, '저널');
  await button(region(page, '이번 장소 기록'), '다음 장소').click();
  if (!await tray.isVisible()) await disclosure.click();
  await expect(tray).toContainText('이전 장소');
  await expect(button(tray, '입력칸으로')).toHaveCount(0);
  await button(tray, '방 뒤지기 2회차 보류 해제').click();
  await expect(tray.getByRole('list')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH);
});

test('a deferred combat roll restores its exact enemy when labels are identical', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = region(page, '조우와 전투 도구');
  await choice(combat, '조우 방식').selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Necropede');
  await button(combat, 'Necropede').click();
  const card = region(combat, '전투 카드');
  const action = box(region(card, '표 굴리기'), '직접 굴린 값');
  const original = await action.getAttribute('data-play-roll-field');
  expect(original).toBeTruthy();
  await page.getByText('보류한 굴림', { exact: true }).click();
  const tray = region(page, '보류한 굴림 목록');
  await choice(tray, '보류할 굴림').selectOption(original!);
  await box(tray, '대상 메모 (선택)').fill('첫 Necropede');
  await button(tray, '보류 표시').click();
  await button(combat, '같은 생물 추가').click();
  const roster = combat.getByRole('group', { name: '전투 대상', exact: true });
  await expect(button(roster, 'Necropede 2')).toHaveAttribute('aria-pressed', 'true');
  await expect(action).not.toHaveAttribute('data-play-roll-field', original!);
  await button(tray, '입력칸으로').click();
  await expect(button(roster, 'Necropede 1')).toHaveAttribute('aria-pressed', 'true');
  await expect(action).toHaveAttribute('data-play-roll-field', original!);
  await expect(action).toBeFocused();
});
