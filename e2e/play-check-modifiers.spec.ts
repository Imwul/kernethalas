import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer, openPane } from './helpers/play-desk';
import { choiceGroup, choose, chosen } from './helpers/choice';

function button(scope: Page | Locator, name: string | RegExp) {
  return scope.getByRole('button', { name, exact: true });
}

function textbox(scope: Locator, name: string) {
  return scope.getByRole('textbox', { name, exact: true });
}

async function roll(scope: Locator, name: string, value: string) {
  const input = textbox(scope, name);
  await input.fill(value);
  await input.press('Enter');
}

async function go(page: Page, name: string) {
  await button(page.getByRole('navigation', { name: '플레이 단계' }), name).click();
}

async function selectEnemy(page: Page, name = 'Necropede') {
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill(name);
  await button(combat, name).click();
  return combat;
}

async function characterTab(page: Page, label: string) {
  const drawer = await openDrawer(page, '캐릭터');
  const tabs = drawer.getByRole('group', { name: '캐릭터 항목' });
  await button(tabs, new RegExp(`^${label}`)).click();
  return drawer;
}

const disadvantage = (scope: Locator, group: string) =>
  button(scope.getByRole('group', { name: group, exact: true }), '불리 (Disadvantage)');

test('Exhaustion defaults apply to PC checks and repeat attacks, while Madness changes only the affected skill', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/play');
  const drawer = await characterTab(page, '상태');
  await textbox(drawer.getByRole('region', { name: 'Exhaustion', exact: true }), '현재 Exhaustion').fill('17');
  const sanity = drawer.getByRole('region', { name: 'Sanity', exact: true });
  await textbox(sanity, '최대 Sanity').fill('12');
  await textbox(sanity, '현재 Sanity').fill('0');
  const madness = sanity.getByRole('alert');
  await roll(madness, '직접 굴린 값', '6');
  await button(madness, '광기 기록 · Sanity 12으로 회복').click();
  await textbox(sanity, '현재 Sanity').fill('0');
  await roll(madness, '직접 굴린 값', '5');
  await button(madness, '광기 기록 · Sanity 12으로 회복').click();
  await closeDrawer(page);

  const combat = await selectEnemy(page);
  const start = combat.getByRole('region', { name: '조우 시작 계산기' });
  await choose(start, '조우의 공포 특성', '4');
  await expect(disadvantage(start, 'Resolve 유불리')).toHaveAttribute('aria-pressed', 'true');
  await expect(disadvantage(start, 'PC Initiative 유불리')).toHaveAttribute('aria-pressed', 'true');
  await expect(disadvantage(start, '적 Initiative 유불리')).toHaveAttribute('aria-pressed', 'false');
  await textbox(start, 'PC Resolve').fill('55');
  await textbox(start, 'Resolve D100').fill('51');
  await expect(start).toContainText('광기 적용 후 Resolve 45');
  await expect(start.getByRole('status', { name: 'Resolve 결과' })).toHaveText('실패 · Sanity 4 손실');

  const card = combat.getByRole('region', { name: '전투 카드' });
  await button(card, 'PC 공격').click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  const edge = disadvantage(attack, '공격자 유불리');
  await expect(edge).toHaveAttribute('aria-pressed', 'true');
  await edge.click();
  await expect(edge).toHaveAttribute('aria-pressed', 'false');
  await textbox(attack, '공격자 수치').fill('61');
  await textbox(attack, '공격자 D100').fill('12');
  await textbox(attack, '방어자 D100').fill('90');
  await expect(attack.getByRole('status', { name: '공격 판정 결과' })).toContainText('공격자 명중');

  await go(page, '휴식·정리');
  await button(page, '치료·성장').click();
  const treatment = page.getByRole('region', { name: '지속 피해와 붕대 처치' });
  await expect(disadvantage(treatment, '유불리')).toHaveAttribute('aria-pressed', 'true');

  await go(page, '탐험');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await button(explore, '방').click();
  await roll(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await roll(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  await roll(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '55');
  await openPane(explore, '방 뒤지기');
  const scavenge = explore.getByRole('region', { name: '방 뒤지기 판정 1회차' });
  await expect(disadvantage(scavenge, '유불리')).toHaveAttribute('aria-pressed', 'true');
  await textbox(scavenge, 'Scavenge 수치').fill('55');
  await roll(scavenge, 'Scavenge D100', '51');
  await expect(scavenge.getByRole('status')).toContainText('뒤지기 실패');
});

test('opening mode replaces stale Initiative and Living Shadow respects Alert', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/play');
  const combat = await selectEnemy(page);
  const start = combat.getByRole('region', { name: '조우 시작 계산기' });
  const mode = choiceGroup(start, '조우 시작 방식');
  await textbox(start, 'PC 최고 Perception').fill('70');
  await textbox(start, 'PC Initiative D100').fill('22');
  await textbox(start, '적 Initiative D100').fill('80');
  await expect(button(combat, /^조우 시작/)).toContainText('PC 측 선공');
  await choose(start, '조우 시작 방식', 'surprise');
  await expect(button(combat, /^조우 시작/)).not.toContainText('측 선공');

  const drawer = await characterTab(page, 'Goal');
  await button(drawer, 'Perk 직접 추가').click();
  await button(drawer, 'Living Shadow').click();
  await closeDrawer(page);
  await expect(button(combat, /^조우 시작/)).toContainText('기습 성공 · PC 측 선공');
  await openPane(combat, '조우 시작');
  await expect(start.getByRole('status', { name: '기습 결과' })).toContainText('PC 측 첫 공격 +20');
  await start.getByRole('checkbox', { name: '조우에 Alert 적 있음' }).check();
  await expect(chosen(start, '조우 시작 방식')).toHaveAttribute('data-value', 'initiative');
  await expect(mode.getByRole('button', { name: '적에게 기습당함' })).toBeDisabled();
  await expect(start.getByRole('status', { name: '기습 결과' })).toHaveCount(0);
});

test('the next Rot stage remains selected after recording and follows the character into the next room', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/play');
  await go(page, '휴식·정리');
  await button(page, '야영').click();
  await button(page, '부패병 판정').click();
  const rot = page.getByRole('region', { name: '부패병 판정', exact: true });
  await textbox(rot, 'Endurance 수치').fill('30');
  await roll(rot.getByRole('group', { name: 'Endurance D100' }), '직접 굴린 값', '48');
  await button(rot, '부패병 판정 기록').click();
  const stage = rot.getByRole('combobox', { name: '현재 부패병 단계' });
  await expect(stage).toHaveValue('1');
  await roll(rot.getByRole('group', { name: 'Endurance D100' }), '직접 굴린 값', '53');
  await expect(rot.getByRole('status', { name: '부패병 결과' })).toContainText('2단계로 진행');
  await button(rot, '부패병 판정 기록').click();
  await expect(stage).toHaveValue('2');
  await go(page, '탐험');
  await button(page.getByRole('region', { name: '장소 탐험' }), '방').click();
  await go(page, '저널');
  await button(page.getByRole('region', { name: '이번 장소 기록' }), '다음 장소').click();
  await page.reload();
  await go(page, '휴식·정리');
  await button(page, '야영').click();
  await button(page, '부패병 판정').click();
  await expect(stage).toHaveValue('2');
  await expect(rot.getByRole('combobox', { name: '판정 시점' })).toHaveValue('camp');
});

test('advancement keeps the worn Amulet and applies Battle Form independently, and stale learned casts require paper selection', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/play');
  const drawer = await characterTab(page, '기본');
  await textbox(drawer, 'PC 레벨').fill('8');
  await textbox(drawer, 'XP').fill('1040');
  const tabs = drawer.getByRole('group', { name: '캐릭터 항목' });
  await button(tabs, /^Mastery/).click();
  const trees = drawer.getByRole('region', { name: 'Mastery 테크트리' });
  const pick = async (name: string, trigger = '+ 기본 Mastery 고르기') => {
    await button(trees, trigger).click();
    const browser = trees.getByRole('region', { name: 'Mastery 둘러보기' });
    await button(browser.getByRole('list', { name: 'Mastery 목록' }), new RegExp(`^${name}`)).click();
    await button(browser, '이 Mastery 선택').click();
  };
  await pick('Bulwark');
  await pick('Arcanist');
  await pick('Stormbrand', '+ Amulet Mastery');
  await button(trees.getByRole('list', { name: /Bulwark 테크트리/ }), /Battle Form/).click();
  await button(trees, /Tier IV까지 배움으로 표시/).click();
  const arcanist = trees.getByRole('list', { name: /Arcanist 테크트리/ });
  await button(arcanist, /Tier III Create Light/).click();
  await button(trees, /Tier III까지 배움으로 표시/).click();
  await closeDrawer(page);

  await go(page, '휴식·정리');
  await button(page.getByRole('group', { name: '정리할 항목' }), 'XP·레벨업').click();
  const advancement = page.getByRole('region', { name: '레벨업과 능력 해금' });
  await expect(button(advancement, '다른 Mastery')).toHaveCount(0);
  const point = advancement.getByRole('group', { name: 'Ability Point 사용' });
  await expect(button(point, 'Stormbrand · Tier 0')).toBeVisible();
  await button(point, '새 포인트 보관').click();
  await button(advancement.getByRole('group', { name: '레벨업 혜택 하나' }), 'Health +D4').click();
  await roll(advancement.getByRole('group', { name: 'Health 증가량 D4' }), '직접 굴린 값', '3');
  await expect(advancement.getByRole('list', { name: '시트에 옮길 레벨업 결과' })).toContainText('Toughness 최대치 +2 (Battle Form)');
  await button(advancement, '레벨업 기록').click();

  const combat = await selectEnemy(page);
  await openPane(combat, 'Mastery·마법');
  const mastery = combat.getByRole('region', { name: 'PC Mastery 능력' });
  await button(mastery.getByRole('group', { name: 'Arcanist 배운 능력' }), 'Create Light').click();
  await expect(button(mastery, '능력 사용 기록')).toBeVisible();
  await characterTab(page, 'Mastery');
  if (await button(trees, /Tier III부터 배우지 않음으로/).count() === 0) {
    await button(arcanist, /Tier III Create Light/).click();
  }
  await button(trees, /Tier III부터 배우지 않음으로/).click();
  await expect(mastery).toContainText('현재 캐릭터 시트에서 이 능력을 사용할 수 없습니다.');
  await expect(button(mastery, '능력 사용 기록')).toHaveCount(0);
  await closeDrawer(page);
  await button(mastery, '다른 Mastery 직접 선택').click();
  await mastery.getByRole('combobox', { name: '사용할 능력' }).selectOption({ label: 'Create Light' });
  await expect(button(mastery, '능력 사용 기록')).toBeVisible();
});
