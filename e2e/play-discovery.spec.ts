import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer, setViewOption } from './helpers/play-desk';
import { choose } from './helpers/choice';

const button = (scope: Locator | Page, name: string) => scope.getByRole('button', { name, exact: true });

async function selectOverseer(page: Page, name: string) {
  await button(page.getByRole('navigation', { name: '플레이 단계' }), '조우·전투').click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill(name);
  await button(combat, name).click();
  return { combat, card: combat.getByRole('region', { name: '전투 카드' }) };
}

async function physical(scope: Locator, value: string) {
  const input = scope.getByRole('textbox', { name: '직접 굴린 값', exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('discovery shows defenses and actual action details but suppresses future Overseer rows until revealed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/play');
  await setViewOption(page, '발견 모드', true);
  const { card } = await selectOverseer(page, '공포 군주');
  const defenses = card.getByRole('region', { name: '피해 반응과 상태 면역' });
  const action = card.getByRole('region', { name: '표 굴리기', exact: true });
  await expect(defenses).toContainText('취약 ×2');
  await expect(defenses).toContainText('Holy');
  await expect(defenses).toContainText('상태 면역');
  await expect(card).not.toContainText('Shadow Reapers');
  await expect(card).not.toContainText('Abyssal Projectiles');
  await expect(card.getByRole('region', { name: '소환 처리' })).toHaveCount(0);
  await expect(card.getByRole('region', { name: '처치 보상' })).toHaveCount(0);
  await expect(button(action, '전체 표')).toHaveCount(0);

  await physical(action, '1');
  await expect(action.getByRole('status')).toContainText('Shadow Reapers');
  const summon = card.getByRole('region', { name: '소환 처리' });
  await expect(summon).toBeVisible();
  await physical(summon, '2');
  await expect(summon.getByRole('checkbox')).toHaveCount(2);
  await expect(card).not.toContainText('Abyssal Projectiles');

  await button(card, '전체 행동표 공개').click();
  await expect(card.getByRole('table')).toContainText('Abyssal Projectiles');
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.reload();
  await expect(button(card, '행동표 숨기기')).toHaveAttribute('aria-expanded', 'true');
  await button(card, '행동표 숨기기').click();
  await expect(card.getByRole('table')).toHaveCount(0);
  await expect(action.getByRole('status')).toContainText('Shadow Reapers');
  await expect(summon.getByRole('checkbox')).toHaveCount(2);
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await card.getByRole('link', { name: '도감 전체 보기', exact: true }).click();
  const reference = page.getByRole('dialog', { name: '공포 군주' });
  await expect(reference.getByRole('region', { name: '처치 보상', exact: true })).toBeVisible();
  await button(reference, '전체 표').click();
  await expect(reference.getByRole('table')).toContainText('Abyssal Projectiles');
  await page.keyboard.press('Escape');
  await expect(card.getByRole('table')).toHaveCount(0);
  await expect(summon.getByRole('checkbox')).toHaveCount(2);
  await physical(action, '2');
  await expect(action.getByRole('status')).toContainText('Aura of Despair');
  await expect(card.getByRole('textbox', { name: 'Resolve 수치', exact: true })).toBeVisible();
  await expect(card).not.toContainText('Abyssal Projectiles');
});

test('discovery reveals the domain Overseer on selection and folds spoils until requested', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  await setViewOption(page, '발견 모드', true);
  const drawer = await openDrawer(page, '도메인');
  const domain = drawer.getByRole('region', { name: '도메인 효과', exact: true });
  const roll = domain.getByRole('group', { name: 'Overseer D10', exact: true });
  await physical(roll, '2');
  await expect(roll.getByRole('status')).toContainText('Overseer를 정했습니다.');
  await expect(domain).toContainText('Overseer 미공개');
  await expect(domain).not.toContainText('공포 군주');
  await expect(domain).not.toContainText('공포 군주');
  await physical(domain.getByRole('group', { name: 'Overseer 영향력 D10', exact: true }), '4');
  await expect(domain).toContainText('전투 기술(Combat Skill) +10');

  const historyDrawer = await openDrawer(page, '이력');
  const history = historyDrawer.getByRole('region', { name: '이번 장소 굴림 이력', exact: true });
  await expect(history).toContainText('Overseer');
  await expect(history).not.toContainText('공포 군주');
  await expect(history).not.toContainText('공포 군주');
  await closeDrawer(page);
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  await button(stages, '저널').click();
  await expect(page.getByRole('region', { name: '이번 장소 기록', exact: true })).not.toContainText(/공포 군주|드레드로드/);
  await button(stages, '조우·전투').click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await expect(page.getByRole('complementary', { name: '이 단계에 적용되는 도메인 효과' })).toContainText('숙련');
  await choose(combat, '조우 방식', 't-overseer');
  await expect(combat).not.toContainText('공포 군주');
  await button(combat, '이 도메인의 Overseer 선택').click();
  await expect(combat.getByRole('heading', { name: '공포 군주', exact: true })).toBeVisible();
  await openDrawer(page, '도메인');
  await expect(roll.getByRole('status')).toContainText('공포 군주');
  await expect(domain).toContainText('공포 군주');
  await expect(button(domain, 'Overseer 이름 공개')).toHaveCount(0);
  await closeDrawer(page);
  await button(combat, '승리 후 전투 마치기').click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await button(wrap.getByRole('group', { name: '정리할 항목' }), '전리품').click();
  const spoils = wrap.getByRole('region', { name: '공포 군주 처치 보상' });
  const valuable = spoils.getByRole('group', { name: '귀중품 D20' });
  await expect(valuable).toBeHidden();
  await spoils.getByText('처치 보상 확인', { exact: true }).click();
  await expect(valuable).toBeVisible();
  await physical(valuable, '7');
  await expect(valuable.getByRole('status')).toContainText('Attunement Crystal');
  await page.reload();
  await expect(valuable.getByRole('status')).toContainText('Attunement Crystal');
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});

test('a deliberate domain reveal persists for the current result and normal mode shows the full result', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/play');
  await setViewOption(page, '발견 모드', true);
  const drawer = await openDrawer(page, '도메인');
  const domain = drawer.getByRole('region', { name: '도메인 효과', exact: true });
  const roll = domain.getByRole('group', { name: 'Overseer D10', exact: true });
  await physical(roll, '5');
  await expect(domain).not.toContainText(/지옥 집정관|인퍼널 아콘/);
  await button(domain, 'Overseer 이름 공개').click();
  await expect(roll.getByRole('status')).toContainText('지옥 집정관');
  await page.reload();
  await openDrawer(page, '도메인');
  await expect(roll.getByRole('status')).toContainText('지옥 집정관');

  const historyDrawer = await openDrawer(page, '이력');
  const history = historyDrawer.getByRole('region', { name: '이번 장소 굴림 이력', exact: true });
  await expect(history).not.toContainText(/지옥 집정관|인퍼널 아콘/);
  await button(history, 'Overseer D10 5 수정 미리보기').click();
  await button(history, '이 굴림부터 다시 입력').click();
  await expect(roll.getByRole('textbox', { name: '직접 굴린 값' })).toBeFocused();
  await physical(roll, '4');
  await expect(domain).not.toContainText(/피발굽|고어후프/);
  await expect(button(domain, 'Overseer 이름 공개')).toBeVisible();
  await closeDrawer(page);
  await setViewOption(page, '발견 모드', false);
  await openDrawer(page, '도메인');
  await expect(roll.getByRole('status')).toContainText('피발굽');
  await expect(button(domain, 'Overseer 이름 공개')).toHaveCount(0);
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
