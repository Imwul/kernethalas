import { expect, test, type Locator } from '@playwright/test';
import { openPane } from './helpers/play-desk';

async function selectCreature(combat: Locator, name: string) {
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill(name);
  await combat.getByRole('button', { name, exact: true }).click();
}

test('compares one damage type across the current lineup and remembers the selection', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Umbra Fiend');
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await combat.getByRole('button', { name: '다른 생물 추가' }).click();
  await combat.getByRole('searchbox', { name: '추가할 생물 이름' }).fill('Infernal Tormentor');
  await combat.getByRole('button', { name: 'Infernal Tormentor', exact: true }).click();
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await openPane(combat, '피해 비교');

  const panel = combat.getByRole('region', { name: '조우 피해 유형 비교' });
  const type = panel.getByRole('combobox', { name: '비교할 피해 유형' });
  const first = panel.getByRole('row', { name: /Umbra Fiend 1/ });
  const duplicate = panel.getByRole('row', { name: /Umbra Fiend 2/ });
  const tormentor = panel.getByRole('row', { name: /Infernal Tormentor 1/ });
  const secondTormentor = panel.getByRole('row', { name: /Infernal Tormentor 2/ });
  await expect(first).toContainText('저항');
  await expect(duplicate).toContainText('저항');
  await panel.getByRole('checkbox', { name: '마법 피해' }).check();
  await expect(first).toContainText('보통 피해');

  await type.selectOption('Holy');
  await expect(tormentor).toContainText('취약 · 피해 ×2');
  await type.selectOption('Infernal');
  await expect(tormentor).toContainText('적용량만큼 회복');
  await type.selectOption('Fire');
  await tormentor.getByText('임시 효과', { exact: true }).click();
  await tormentor.getByRole('checkbox', { name: /Infernal Shapechange/ }).check();
  await expect(tormentor).toContainText('면역 · 피해 0');
  await expect(secondTormentor).toContainText('보통 피해');
  await type.selectOption('Poison');
  await expect(first).toContainText('보통 피해');
  await expect(first).toContainText('중독 상태 면역');

  await page.reload();
  await expect(type).toHaveValue('Poison');
  await expect(duplicate).toContainText('중독 상태 면역');
  await type.selectOption('Fire');
  await expect(tormentor).toContainText('면역 · 피해 0');
  for (const width of [320, 3440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(panel.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('checks chosen targets and timings by hand and starts a fresh board for a new encounter', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Necropede');
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await openPane(combat, '라운드');

  const board = combat.getByRole('region', { name: '전투 턴·라운드 체크판' });
  const position = board.getByRole('status');
  const actor = board.getByRole('combobox', { name: '턴을 확인할 대상' });
  const actorForEffect = board.getByRole('combobox', { name: '효과 대상', exact: true });
  const effect = board.getByRole('combobox', { name: '확인할 효과' });
  const timing = board.getByRole('combobox', { name: '확인 시점' });
  await expect(position).toContainText('1라운드');
  await board.getByText('확인 항목 추가', { exact: true }).click();
  await board.getByRole('textbox', { name: '수치·메모 (선택)' }).fill('2');
  await board.getByRole('button', { name: '효과 추가' }).click();
  const bleed = board.getByRole('checkbox', { name: '확인 · 출혈' });
  await bleed.check();

  await actorForEffect.selectOption({ label: 'Necropede 2' });
  await effect.selectOption('custom');
  await timing.selectOption('end');
  await board.getByRole('textbox', { name: '효과 이름' }).fill('장벽 해제 확인');
  await board.getByRole('button', { name: '효과 추가' }).click();
  const barrier = board.getByRole('checkbox', { name: '확인 · 장벽 해제 확인' });
  await actor.selectOption({ label: 'Necropede 1' });
  await board.getByRole('button', { name: '턴 종료' }).click();
  await expect(position).toContainText('Necropede 1 턴 종료');
  await expect(barrier).toHaveCount(0);

  await actor.selectOption({ label: 'Necropede 2' });
  await board.getByRole('button', { name: '턴 시작' }).click();
  await expect(position).toContainText('Necropede 2 턴 시작');
  await expect(barrier).toHaveCount(0);
  await board.getByRole('button', { name: '턴 종료' }).click();
  await barrier.check();
  await expect(barrier).toBeChecked();
  await page.reload();
  await expect(position).toContainText('Necropede 2 턴 종료');
  await expect(barrier).toBeChecked();

  await board.getByRole('button', { name: '다음 라운드' }).click();
  await expect(position).toContainText('2라운드');
  await expect(board.getByText('초기화를 확인하세요.', { exact: false })).toBeVisible();
  await expect(bleed).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await combat.getByRole('button', { name: '조우 다시 선택' }).click();
  await selectCreature(combat, 'Necropede');
  await openPane(combat, '라운드');
  await expect(position).toContainText('1라운드');
  await expect(board.getByRole('list', { name: '등록한 효과' })).toHaveCount(0);
});
