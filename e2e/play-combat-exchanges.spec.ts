import { expect, test, type Locator, type Page } from '@playwright/test';

async function go(page: Page, stage: string) {
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: stage, exact: true }).click();
}

async function selectCreature(combat: Locator, name: string) {
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill(name);
  await combat.getByRole('button', { name, exact: true }).click();
}

async function addCreature(combat: Locator, name: string) {
  await combat.getByRole('button', { name: '다른 생물 추가' }).click();
  await combat.getByRole('searchbox', { name: '추가할 생물 이름' }).fill(name);
  await combat.getByRole('button', { name, exact: true }).last().click();
}

async function roll(scope: Locator, label: string, value: string) {
  const field = scope.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('an attack exchange records the pair once and keeps skills for the next attack', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Necropede');
  await combat.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = combat.getByRole('region', { name: '공격 판정 해석기' });
  const input = (name: string) => attack.getByRole('textbox', { name, exact: true });
  const confirm = attack.getByRole('button', { name: '공격 교환 확정' });
  await input('공격자 보정 Skill').fill('61');
  await input('공격자 D100').fill('00');
  await input('방어자 보정 Skill').fill('42');
  await expect(confirm).toBeDisabled();
  await input('방어자 D100').fill('31');
  await confirm.click();
  await expect(input('공격자 D100')).toBeDisabled();
  await attack.getByRole('button', { name: '적이 공격', exact: true }).click();
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await go(page, '저널');
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  const record = history.getByRole('button', { name: /공격 교환 · PC → Necropede(?: 1)? D100 × 2 공격 00 \/ 방어 31/ });
  await expect(record).toHaveCount(1);
  await record.click();
  await history.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(combat.getByRole('heading', { name: 'Necropede 1', exact: true })).toBeVisible();
  await expect(attack.getByRole('button', { name: 'PC가 공격', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(input('공격자 D100')).toBeFocused();
  await expect(input('공격자 D100')).toBeEditable();
  await confirm.click();
  await page.reload();
  await attack.getByRole('button', { name: '다음 공격', exact: true }).click();
  await expect(input('공격자 D100')).toBeFocused();
  await expect(input('공격자 D100')).toHaveValue('');
  await expect(input('방어자 D100')).toHaveValue('');
  await expect(input('공격자 보정 Skill')).toHaveValue('61');
  await expect(input('방어자 보정 Skill')).toHaveValue('42');
  await go(page, '저널');
  await expect(record).toHaveCount(1);
});

test('correcting a confirmed pair also rewinds its dependent hit-location roll', async ({ page }) => {
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Necropede');
  const card = combat.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await attack.getByRole('textbox', { name: '공격자 보정 Skill' }).fill('61');
  await attack.getByRole('textbox', { name: '공격자 D100', exact: true }).fill('12');
  await attack.getByRole('textbox', { name: '방어자 D100', exact: true }).fill('90');
  await attack.getByRole('button', { name: '적 명중 부위 보기' }).click();
  await roll(card.getByRole('region', { name: '표 굴리기', exact: true }), '직접 굴린 값', '1');

  await go(page, '저널');
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  await history.getByRole('button', { name: /공격 교환 · PC → Necropede D100 × 2 공격 12 \/ 방어 90/ }).click();
  await expect(history.getByRole('group', { name: '굴림 수정 미리보기' })).toContainText('D20 1 다시 확인');
  await history.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(attack.getByRole('textbox', { name: '공격자 D100', exact: true })).toBeFocused();
  await go(page, '저널');
  await expect(history.getByRole('button', { name: /D20 1 수정 미리보기/ })).toHaveCount(0);
});

test('marked defeats drive creature spoils and unmarked targets can still be fought', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Necropede');
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  const first = combat.getByRole('combobox', { name: 'Necropede 1 상태', exact: true });
  const second = combat.getByRole('combobox', { name: 'Necropede 2 상태', exact: true });
  const victory = combat.getByRole('button', { name: '승리 후 전투 마치기' });
  await first.selectOption('defeated');
  await expect(victory).toBeDisabled();
  await page.reload();
  await expect(first).toHaveValue('defeated');
  await expect(second).toHaveValue('');
  await second.selectOption('left');
  await victory.click();
  const loot = page.getByRole('region', { name: '전리품 굴림', exact: true });
  await expect(loot.getByRole('region', { name: 'Necropede 1 처치 보상' })).toBeVisible();
  await expect(loot.getByRole('region', { name: 'Necropede 2 처치 보상' })).toHaveCount(0);
  await go(page, '조우·전투');
  await expect(second).toBeDisabled();
  await expect(victory).toHaveCount(0);
  await expect(combat.getByRole('button', { name: '같은 생물 추가' })).toBeDisabled();
});

test('only targets still in combat return after retreat', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Necropede');
  await addCreature(combat, 'Infernal Archon');
  await combat.getByRole('combobox', { name: 'Necropede 상태', exact: true }).selectOption('defeated');
  await combat.getByText('도주 판정', { exact: true }).click();
  const flee = combat.getByRole('region', { name: '전투 도주' });
  await flee.getByRole('textbox', { name: 'Dodge 수치' }).fill('50');
  await roll(flee, '직접 굴린 D100', '39');
  await flee.getByRole('button', { name: '후퇴하고 적 편성 기록' }).click();
  await go(page, '탐험');
  await page.getByText('후퇴했던 장소 다시 열기', { exact: true }).click();
  await page.getByRole('button', { name: /재진입$/ }).click();
  await expect(combat.getByRole('heading', { name: 'Infernal Archon', exact: true })).toBeVisible();
  await expect(combat.getByRole('combobox', { name: 'Necropede 상태' })).toHaveCount(0);
});

test('Overseer summons respect the active limit and Shadow Reapers have a separate checklist', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Infernal Archon');
  const card = combat.getByRole('region', { name: '전투 카드' });
  const summon = card.getByRole('region', { name: '소환 처리' });
  const chooseAction = async (value: string) => {
    await roll(card.getByRole('region', { name: '표 굴리기', exact: true }), '직접 굴린 값', value);
    await card.getByText('행동 효과 처리', { exact: true }).click();
  };
  await chooseAction('3');
  await roll(summon, '직접 굴린 값', '3');
  await summon.getByRole('button', { name: '전투에 3체 추가' }).click();
  await expect(summon).toContainText('교전 중 3체 · 추가 가능 1체');
  await chooseAction('3');
  await roll(summon, '직접 굴린 값', '4');
  await summon.getByRole('button', { name: '전투에 1체 추가' }).click();
  await expect(combat.getByRole('group', { name: '전투 대상', exact: true }).getByRole('button', { name: /^Lesser Demon/ })).toHaveCount(4);
  await expect(summon).toContainText('교전 중 4체 · 추가 가능 0체');
  await expect(summon.getByRole('button', { name: /추가$/ })).toHaveCount(0);

  await addCreature(combat, 'Dreadlord');
  await chooseAction('1');
  await roll(summon, '직접 굴린 값', '2');
  const reaper = summon.getByRole('group', { name: 'Shadow Reaper 공격 처리' });
  const first = reaper.getByRole('checkbox', { name: 'Shadow Reaper 1 공격 처리' });
  await expect(reaper).toContainText('Combat Skill 40 · D4 Cold');
  await first.check();
  await page.reload();
  await card.getByText('행동 효과 처리', { exact: true }).click();
  await expect(first).toBeChecked();
  await expect(reaper.getByRole('checkbox')).toHaveCount(2);
  await expect(combat.getByRole('group', { name: '전투 대상', exact: true }).getByRole('button', { name: /Shadow Reaper/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
