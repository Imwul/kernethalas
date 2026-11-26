import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer } from './helpers/play-desk';

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
  const resistance = lingering.getByRole('group', { name: '중독 저항 Endurance (자유 행동)' });
  await expect(lingering).toContainText('1라운드 지속 피해 · 1');
  await lingering.getByRole('button', { name: '라운드·턴 열기' }).click();
  const board = combat.getByRole('region', { name: '전투 턴·라운드 체크판' });
  await board.getByRole('button', { name: '턴 시작', exact: true }).click();
  await expect(resistance).toHaveCount(0);
  await lingering.getByRole('button', { name: '중독 1 올리기' }).click();
  const tick = lingering.getByRole('button', { name: '1라운드 피해 기록 · 2' });
  await tick.click();
  await expect(lingering.getByRole('button', { name: '1라운드 기록함' })).toBeDisabled();
  await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(tick).toBeEnabled();
  await tick.click();
  await board.getByRole('button', { name: '다음 라운드', exact: true }).click();
  await expect(lingering).toContainText('2라운드 지속 피해 · 2');
  const actor = board.getByRole('combobox', { name: '턴을 확인할 대상' });
  await actor.selectOption({ index: 1 });
  await board.getByRole('button', { name: '턴 시작', exact: true }).click();
  await page.reload();
  await expect(board.getByRole('status')).toContainText('2라운드');
  await expect(board.getByRole('status')).toContainText('Giant Spider 턴 시작');
  await expect(lingering).toContainText('2라운드 지속 피해 · 2');
  await expect(card.getByRole('button', { name: '중독 적용함' })).toBeDisabled();
  await expect(resistance).toHaveCount(0);

  await actor.selectOption('pc');
  await board.getByRole('button', { name: '턴 시작', exact: true }).click();
  await check(resistance, 'Endurance', '92');
  await expect(lingering).toContainText('이번 라운드의 중독 저항을 사용했습니다.');
  await board.getByRole('button', { name: '턴 시작', exact: true }).click();
  await expect(resistance).toHaveCount(0);
  await board.getByRole('button', { name: '다음 라운드', exact: true }).click();
  await board.getByRole('button', { name: '턴 시작', exact: true }).click();

  await check(resistance, 'Endurance', '12');
  await expect(warnings).toHaveCount(0);
  await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(resistance).toBeVisible();
  await check(resistance, 'Endurance', '12');
  await expect(combat.getByRole('group', { name: 'PC 지속 피해 상태 추가' })).toBeVisible();

  await go(page, '저널');
  await expect(page.getByRole('checkbox', { name: '1라운드 지속 피해 2 (중독 2 · Armor 무시)' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '중독 해제 (Endurance 저항 성공)' })).toBeVisible();
});

test('only a room entered with lasting conditions asks for its Health damage at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '상태');
  await drawer.getByRole('checkbox', { name: '출혈' }).check();
  await drawer.getByRole('checkbox', { name: '화상' }).check();
  await closeDrawer(page);
  const entry = page.getByRole('region', { name: '지속 피해' });
  await expect(entry).toHaveCount(0);

  const explore = page.getByRole('region', { name: '장소 탐험' });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await expect(entry).toContainText('다음 방부터 방마다 Health −1');
  await go(page, '저널');
  await page.getByRole('region', { name: '이번 장소 기록' }).getByRole('button', { name: '다음 장소', exact: true }).click();
  await go(page, '탐험');
  await explore.getByRole('button', { name: '통로', exact: true }).click();
  await expect(entry).toHaveCount(0);
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await expect(entry.getByRole('alert')).toHaveText('이 방에 들어오며 지속 피해 · Health −2');
  await entry.getByRole('button', { name: '화상 끄기 · Exhaustion +2' }).click();
  await expect(entry.getByRole('alert')).toContainText('Health −1');
  const undo = page.getByRole('button', { name: '직전 굴림 되돌리기' });
  await undo.click();
  await expect(entry.getByRole('alert')).toContainText('Health −2');
  await entry.getByRole('button', { name: '화상 끄기 · Exhaustion +2' }).click();
  await entry.getByRole('button', { name: '붕대 치료 (Medicine)' }).click();
  await expect(entry.getByRole('region', { name: '지속 피해와 붕대 처치' })).toBeVisible();
  await entry.getByRole('button', { name: '피해 기록 · Health −1' }).click();
  await expect(entry).toContainText('지속 피해 기록함 · Health −1');
  await undo.click();
  await expect(entry.getByRole('button', { name: '피해 기록 · Health −1' })).toBeEnabled();
  await entry.getByRole('button', { name: '피해 기록 · Health −1' }).click();
  await explore.getByRole('button', { name: '통로', exact: true }).click();
  await go(page, '저널');
  const damage = page.getByRole('checkbox', { name: '출혈 · Health −1 (지속 피해 · Armor 무시)' });
  await expect(damage).toHaveCount(0);
  await go(page, '탐험');
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await go(page, '저널');
  await expect(damage).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('camp treatment removes only the selected condition and its roll can be rewound', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  const status = await openDrawer(page, '상태');
  await status.getByRole('checkbox', { name: '출혈' }).check();
  await status.getByRole('checkbox', { name: '중독' }).check();
  await closeDrawer(page);
  await go(page, '휴식·정리');
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '야영', exact: true }).click();
  await wrap.getByRole('button', { name: /^요리 · 제작 · 그 밖의 야영 활동/ }).click();
  const treatment = wrap.getByRole('group', { name: '치료할 상태' });
  await treatment.getByRole('checkbox', { name: '출혈' }).check();
  const die = wrap.getByRole('textbox', { name: '직접 굴린 D20', exact: true });
  await die.fill('12');
  await die.press('Enter');
  await wrap.getByRole('button', { name: '야영 완료 확인' }).click();
  await page.reload();
  const warnings = page.getByRole('group', { name: '캐릭터 경고' });
  await expect(warnings.getByRole('button', { name: '중독' })).toBeVisible();
  await expect(warnings.getByRole('button', { name: '출혈' })).toHaveCount(0);
  await go(page, '저널');
  const journal = page.getByRole('group', { name: '종이 시트에 반영' });
  await expect(journal.getByRole('checkbox', { name: 'Bandage −1 (야영)' })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: 'Exhaustion +1 (야영 활동)' })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: '출혈 해제 (야영 치료)' })).toBeVisible();
  const history = await openDrawer(page, '이력');
  await history.getByRole('button', { name: '야영 판정 D20 12 수정 미리보기' }).click();
  await history.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(warnings.getByRole('button', { name: '출혈' })).toBeVisible();
  await expect(die).toBeFocused();
  await go(page, '저널');
  await expect(journal.getByRole('checkbox', { name: 'Bandage −1 (야영)' })).toHaveCount(0);
});

test('rewinding a creature action also rewinds its applied condition and round damage', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = by(page, 'region', '조우와 전투 도구');
  await by(combat, 'combobox', '조우 방식').selectOption('search');
  await by(combat, 'searchbox', '생물 이름').fill('Giant Spider');
  await by(combat, 'button', 'Giant Spider').click();
  const card = by(combat, 'region', '전투 카드');
  const roll = by(card, 'textbox', '직접 굴린 값');
  const apply = by(card, 'button', 'PC에 적용 · 중독 (1)');
  await roll.fill('1');
  await roll.press('Enter');
  await apply.click();
  const effects = by(combat, 'region', '전투 중 지속 피해');
  await by(effects, 'button', '중독 1 올리기').click();
  await by(effects, 'button', '1라운드 피해 기록 · 2').click();
  const history = await openDrawer(page, '이력');
  await by(history, 'button', '행동 D6 1 수정 미리보기').click();
  await expect(history.getByRole('group', { name: '굴림 수정 미리보기' })).toContainText('1라운드 지속 피해');
  await by(history, 'button', '이 굴림부터 다시 입력').click();
  await expect(effects).toHaveCount(0);
  await roll.fill('1');
  await roll.press('Enter');
  await apply.click();
  await expect(by(effects, 'button', '1라운드 피해 기록 · 1')).toBeEnabled();
});

test('the incoming hit handoff focuses its D20 input at 320px', async ({ page }) => {
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = by(page, 'region', '조우와 전투 도구');
  await by(combat, 'combobox', '조우 방식').selectOption('search');
  await by(combat, 'searchbox', '생물 이름').fill('Giant Spider');
  await by(combat, 'button', 'Giant Spider').click();
  const card = by(combat, 'region', '전투 카드');
  await by(card, 'button', '공격 판정').click();
  const attack = by(card, 'region', '공격 판정 해석기');
  await by(attack, 'button', '적이 공격').click();
  await by(attack, 'textbox', '공격자 D100').fill('31');
  await by(attack, 'textbox', '방어자 수치').fill('50');
  await by(attack, 'textbox', '방어자 D100').fill('92');
  await page.setViewportSize({ width: 320, height: 760 });
  const handoff = by(attack, 'button', 'PC 명중 부위 D20');
  await handoff.scrollIntoViewIfNeeded();
  await handoff.click();
  const hit = by(card, 'textbox', '직접 굴린 값');
  await expect(hit).toBeFocused();
  await expect(hit).toBeInViewport({ ratio: 1 });
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
