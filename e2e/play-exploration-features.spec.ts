import { expect, test, type Locator } from '@playwright/test';
import { openPane } from './helpers/play-desk';

async function enter(locator: Locator, name: string, value: string) {
  const input = locator.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('rolled tile turns and exit marks stay with the current location', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  const shape = explore.getByRole('region', { name: '방·통로 모양', exact: true });
  await enter(shape, '직접 굴린 값', '01');
  await explore.getByText('종이 지도에 모양 옮기기', { exact: true }).click();
  const editor = explore.getByRole('region', { name: '방·통로 모양 편집' });
  const diagram = shape.getByRole('img', { name: /1번 통로 모양 예시/ });
  await editor.getByRole('button', { name: '오른쪽 90° 회전' }).click();
  await editor.getByRole('combobox', { name: '들어온 출입구', exact: true }).selectOption({ label: '1번' });
  await editor.getByRole('combobox', { name: '표시할 출입구', exact: true }).selectOption({ label: '2번' });
  await editor.getByRole('combobox', { name: '출입구 상태', exact: true }).selectOption({ label: '잠김' });
  await expect(editor.getByRole('status')).toContainText('90° · 입구 1번 · 2번 잠김');
  await expect(diagram.locator('g[transform="rotate(90 64 48)"]')).toHaveCount(1);
  await expect(diagram.locator('line[data-entrance]')).toHaveCount(1);
  await expect(diagram.locator('line[data-mark="locked"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.reload();
  await expect(diagram.locator('g[transform="rotate(90 64 48)"]')).toHaveCount(1);
  await expect(diagram.locator('line[data-mark="locked"]')).toHaveCount(1);
  await enter(shape, '직접 굴린 값', '08');
  const newDiagram = shape.getByRole('img', { name: /8번 통로 모양 예시/ });
  await expect(newDiagram.locator('g[transform^=rotate]')).toHaveCount(0);
  await expect(newDiagram.locator('line[data-mark="locked"]')).toHaveCount(0);
});

test('event 55 preserves separate searches, while event 40 exposes only two attempts', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await enter(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await enter(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  const event = explore.getByRole('region', { name: '이벤트', exact: true });
  await enter(event, '직접 굴린 값', '55');
  await openPane(explore, '방 뒤지기');

  const attempts = explore.getByRole('group', { name: '방 뒤지기 시도 선택' });
  await expect(attempts.getByRole('button')).toHaveCount(3);
  for (const [attempt, roll, amount, reward] of [[1, '13', '2', 'Cooking Ingredients'], [2, '4', '3', 'Crafting Supplies']]) {
    await attempts.getByRole('button', { name: `${attempt}회차` }).click();
    const search = explore.getByRole('region', { name: `방 뒤지기 판정 ${attempt}회차` });
    await search.getByLabel('Scavenge 수치').fill('55');
    await enter(search, 'Scavenge D100', '31');
    await enter(search.getByRole('group', { name: '뒤지기 결과 D20' }), '직접 굴린 값', String(roll));
    await enter(search.getByRole('group', { name: `${reward} 수량 D4` }), '직접 굴린 값', String(amount));
  }
  await expect(explore.getByText('2/3회 사용', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal.getByRole('checkbox', { name: 'Cooking Ingredients +2', exact: true })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: 'Crafting Supplies +3', exact: true })).toBeVisible();
  await page.reload();
  await expect(journal.getByRole('checkbox', { name: 'Cooking Ingredients +2', exact: true })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: 'Crafting Supplies +3', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '탐험', exact: true }).click();
  // the finished event is folded to one line; reopen it to enter a different result
  await event.getByRole('button', { name: /^D100 55 · .*다시 보기$/ }).click();
  await enter(event, '직접 굴린 값', '40');
  await expect(attempts.getByRole('button')).toHaveCount(2);
  await expect(explore.getByText('2/2회 사용', { exact: true })).toBeVisible();
});

test('paper-map IDs keep a room kind and notes when revisited in a later location', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await explore.getByRole('button', { name: '통로', exact: true }).click();
  await openPane(explore, '종이 지도 메모');
  const index = explore.getByRole('region', { name: '종이 지도 장소 색인' });
  await index.getByLabel('종이 지도 번호', { exact: true }).fill('B-07');
  await index.getByLabel('장소 메모', { exact: true }).fill('북쪽에서 발소리가 들림');
  await index.getByRole('checkbox', { name: '잠긴 문' }).check();
  await index.getByRole('button', { name: '장소 메모 저장' }).click();
  await expect(index.getByRole('status')).toContainText('B-07 메모를 저장');

  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal.getByText(/B-07 · 통로/).first()).toBeVisible();
  await journal.getByRole('button', { name: '다음 장소', exact: true }).click();
  await page.reload();
  await openPane(explore, '종이 지도 메모');
  await index.getByRole('combobox', { name: '저장한 지도 번호' }).selectOption({ label: 'B-07 (통로)' });
  await index.getByRole('button', { name: '재방문에 불러오기' }).click();
  await expect(explore.getByRole('button', { name: '재방문', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(explore.getByRole('button', { name: '통로', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(index.getByLabel('장소 메모', { exact: true })).toHaveValue('북쪽에서 발소리가 들림');
  await expect(index.getByRole('checkbox', { name: '잠긴 문' })).toBeChecked();
  await expect(explore.getByRole('region', { name: '조우 판정', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('the next-action shortcut follows search rewards, resolved encounters and corrections across attempts', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  const bar = page.getByRole('region', { name: '다음 행동 바로가기' });
  const next = bar.getByRole('button', { name: '다음 행동', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await enter(explore.getByRole('region', { name: '은신처 소모 주사위', exact: true }), '직접 굴린 값', '5');
  await enter(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await enter(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  await enter(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '55');
  await openPane(explore, '방 뒤지기');

  const first = explore.getByRole('region', { name: '방 뒤지기 판정 1회차' });
  await first.getByLabel('Scavenge 수치').fill('55');
  await enter(first, 'Scavenge D100', '31');
  await enter(first.getByRole('group', { name: '뒤지기 결과 D20' }), '직접 굴린 값', '13');
  await expect(next).toHaveAccessibleDescription('Cooking Ingredients 수량 · D4');
  await enter(first.getByRole('group', { name: 'Cooking Ingredients 수량 D4' }), '직접 굴린 값', '2');
  await expect(next).toHaveAccessibleDescription('방 뒤지기 2회차');
  await next.click();
  const secondTab = explore.getByRole('button', { name: '2회차', exact: true });
  await expect(secondTab).toBeFocused();
  await secondTab.press('Enter');

  const second = explore.getByRole('region', { name: '방 뒤지기 판정 2회차' });
  await second.getByLabel('Scavenge 수치').fill('55');
  await enter(second, 'Scavenge D100', '99');
  const encounter = second.getByRole('button', { name: '뒤지기 조우로', exact: true });
  await expect(next).toHaveAccessibleDescription('뒤지기 조우로');
  await encounter.click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Necropede');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  await combat.getByRole('button', { name: '전투만 마치기', exact: true }).click();
  await stages.getByRole('button', { name: '탐험', exact: true }).click();
  await expect(encounter).toHaveCount(0);
  await expect(next).toHaveAccessibleDescription('방 뒤지기 3회차');

  await bar.getByRole('button', { name: '이번 장소 굴림 이력으로 이동' }).click();
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  const preview = history.getByRole('group', { name: '굴림 수정 미리보기' });
  await history.getByRole('button', { name: '방 뒤지기 2회차 D100 99 수정 미리보기' }).click();
  await expect(preview.getByRole('alert')).toContainText('종료한 전투 기록');
  await expect(preview.getByRole('button', { name: '이 굴림부터 다시 입력' })).toBeDisabled();
  await history.getByRole('button', { name: '방 뒤지기 1회차 D100 31 수정 미리보기' }).click();
  await expect(preview).toContainText('Cooking Ingredients 수량 D4 2 다시 확인');
  await expect(preview).not.toContainText('방 뒤지기 2회차');
  await preview.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(first.getByRole('textbox', { name: 'Scavenge D100' })).toBeFocused();
  await expect(first.getByRole('group', { name: '뒤지기 결과 D20' })).toHaveCount(0);
});
