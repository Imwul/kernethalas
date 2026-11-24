import { expect, test, type Locator } from '@playwright/test';

async function enterRoll(panel: Locator, label: string, value: string) {
  const die = panel.getByRole('group', { name: label, exact: true });
  await die.getByRole('textbox', { name: '직접 굴린 값' }).fill(value);
  await die.getByRole('button', { name: '확인', exact: true }).click();
}

test('play resolves handwritten loot rolls and keeps the journal while opening camp', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await expect(wrap.getByRole('group', { name: '귀중품 D20', exact: true })).toHaveCount(0);
  await enterRoll(wrap, '전리품 D6', '5');
  await expect(wrap.getByRole('group', { name: '귀중품 D20', exact: true })).toHaveCount(0);
  await wrap.getByRole('button', { name: '귀중품 이어서' }).click();
  await enterRoll(wrap, '귀중품 D20', '1');
  await wrap.getByRole('button', { name: '물약 발견 이어서' }).click();
  const potion = wrap.getByRole('region', { name: '물약 기록' });
  await potion.getByRole('combobox', { name: '물약 감정' }).selectOption('stone');
  await enterRoll(potion, '물약 종류 D20', '7');
  await enterRoll(potion, '물약 노화 D20', '11');
  const line = potion.getByRole('region', { name: '저널용 한 줄' });
  await expect(line).toContainText('Heal 물약');
  const sections = wrap.getByRole('group', { name: '정리할 항목' });
  await sections.getByRole('button', { name: '야영', exact: true }).click();
  await expect(wrap.getByRole('region', { name: '야영 계산기' })).toBeVisible();
  await sections.getByRole('button', { name: '전리품', exact: true }).click();
  await expect(line).toContainText('Heal 물약');
  await wrap.getByRole('button', { name: '물약 발견 접기' }).click();
  await wrap.getByRole('button', { name: '물약 발견 이어서' }).click();
  await expect(line).toContainText('Heal 물약');
  await sections.getByRole('button', { name: '숨 고르기', exact: true }).click();
  await enterRoll(wrap, '숨 고르기 회복 D10', '8');
  await expect(wrap.getByRole('group', { name: '숨 고르기 회복 D10', exact: true }).getByRole('status')).toContainText('Toughness +10');
  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('전리품 Heal 물약');
  await expect(journal).toContainText('숨 고르기 Toughness +10');
});

async function enterNecropede(combat: Locator) {
  await combat.getByRole('textbox', { name: 'D6 결과', exact: true }).fill('4');
  await combat.getByRole('button', { name: 'D6 확인', exact: true }).click();
  await combat.getByRole('textbox', { name: 'D20 결과', exact: true }).fill('2');
  await combat.getByRole('button', { name: '생물 선택', exact: true }).click();
  await expect(combat.getByRole('heading', { name: 'Necropede', exact: true })).toBeVisible();
}

test('a failed physical camp check resumes its saved plan after the encounter', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  await stages.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '야영', exact: true }).click();
  const camp = wrap.getByRole('region', { name: '야영 계산기' });
  const campDie = camp.getByLabel('직접 굴린 D20');
  const benefits = camp.getByRole('region', { name: '야영 기본 혜택' });
  await camp.getByLabel('방어벽 재료 수').fill('1');
  await campDie.fill('2');
  await campDie.press('Enter');
  await expect(camp.getByRole('status')).toContainText('D20 2 +5 = 7');
  await expect(benefits).toHaveCount(0);
  await camp.getByRole('button', { name: '야영 중 조우로' }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await enterNecropede(combat);
  await page.reload();
  await expect(combat.getByRole('heading', { name: 'Necropede' })).toBeVisible();
  await combat.getByRole('button', { name: '전투만 마치기', exact: true }).click();

  await expect(campDie).toHaveValue('2');
  await expect(camp.getByLabel('방어벽 재료 수')).toHaveValue('1');
  await expect(benefits.getByRole('heading')).toHaveText('야영 기본 혜택 절반(내림)');
  await benefits.getByText('회복량 직접 계산', { exact: true }).click();
  await benefits.getByLabel('잃은 Toughness').fill('7');
  await enterRoll(benefits, '야영 Sanity 회복 D4', '3');
  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  const sheet = journal.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet.getByText('Crafting Supplies −1 (야영)', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Toughness +3 (야영)', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Sanity +1 (야영)', { exact: true })).toBeVisible();
  await expect(journal).toContainText('야영 D20 2 +5 = 7 (실패 · 조우 종료)');

  await stages.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await campDie.fill('3');
  await campDie.press('Enter');
  await expect(camp.getByRole('button', { name: '야영 중 조우로' })).toBeVisible();
  await expect(benefits).toHaveCount(0);
  await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(campDie).toHaveValue('2');
  await expect(benefits).toBeVisible();
});

test('each defeated creature has an independent loot roll and paper change', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투' }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await enterNecropede(combat);
  await combat.getByRole('button', { name: '같은 생물 추가', exact: true }).click();
  await combat.getByRole('button', { name: '승리 후 전투 마치기', exact: true }).click();
  // A finished fight opens on its after-fight steps; loot is the next tab.
  await page.getByRole('region', { name: '휴식과 전리품 정리' }).getByRole('button', { name: '전리품', exact: true }).click();
  const loot = page.getByRole('region', { name: '전리품 굴림' });
  await enterRoll(loot.getByRole('region', { name: 'Necropede 1 처치 보상' }), '자원 D10', '7');
  await enterRoll(loot.getByRole('region', { name: 'Necropede 2 처치 보상' }), '자원 D10', '3');
  await page.reload();
  await expect(loot.getByRole('region', { name: 'Necropede 1 처치 보상' })).toContainText('Crafting Supplies 1');
  await expect(loot.getByRole('region', { name: 'Necropede 2 처치 보상' })).toContainText('Cooking Ingredients 1');
  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  const sheet = journal.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet.getByText('Crafting Supplies +1 · Necropede 1 처치 보상', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Cooking Ingredients +1 · Necropede 2 처치 보상', { exact: true })).toBeVisible();
});

test('domain darkness triggers a short rest check and its result can clear that effect', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
  const room = exploration.getByRole('button', { name: '방', exact: true });
  const entry = exploration.getByRole('region', { name: '긴장 주사위', exact: true });
  await room.click();
  await entry.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('4');
  await entry.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('2');
  await entry.getByRole('button', { name: '긴장 주사위 확인' }).click();
  const darkness = exploration.getByRole('region', { name: '짙어지는 어둠', exact: true });
  await darkness.getByRole('textbox', { name: '직접 굴린 값' }).fill('15');
  await darkness.getByRole('button', { name: '확인', exact: true }).click();
  await stages.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('button', { name: '다음 장소', exact: true }).click();

  await room.click();
  await entry.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('6');
  await entry.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('3');
  await entry.getByRole('button', { name: '긴장 주사위 확인' }).click();
  await stages.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '숨 고르기', exact: true }).click();
  await enterRoll(wrap, '숨 고르기 회복 D10', '8');
  const extra = wrap.getByRole('region', { name: '숨 고르기 후 긴장 판정' });
  await expect(extra.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('4');
  await extra.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('1');
  await extra.getByRole('button', { name: '긴장 주사위 확인' }).click();
  const followUp = extra.getByRole('region', { name: '짙어지는 어둠 후속 판정' });
  await enterRoll(extra, '짙어지는 어둠 D100', '67');
  await enterRoll(followUp, '광원 감소 D4', '3');
  await expect(followUp.getByRole('list', { name: '종이 시트에 반영할 결과' })).toContainText('광원 −3');
  await enterRoll(extra, '짙어지는 어둠 D100', '33');
  await expect(extra.getByRole('group', { name: '짙어지는 어둠 D100' })).toContainText('짙어지는 어둠으로 생긴 다른 효과를 모두 해제한다');
  await expect(followUp.getByRole('group', { name: '광원 감소 D4' })).toHaveCount(0);
  await expect(followUp.getByLabel('해제한 어둠 효과 수')).toHaveValue('1');
  await stages.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('숨 고르기 후 어둠 D100 33');
  await expect(journal).toContainText('다음 장소는 긴장 주사위 D8로 시작합니다.');
  const sheet = journal.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet.getByRole('checkbox', { name: 'Sanity −1', exact: true })).toBeVisible();
  await expect(sheet.getByRole('checkbox', { name: '광원 −3', exact: true })).toHaveCount(0);
});
