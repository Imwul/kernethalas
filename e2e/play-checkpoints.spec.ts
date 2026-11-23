import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

const setup = async (page: Page) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  return page.locator('.play-checkpoints');
};

async function enter(roller: Locator, name: string, raw: string) {
  const input = roller.getByRole('textbox', { name, exact: true });
  await input.fill(raw);
  await input.press('Enter');
}

async function rollShape(page: Page, raw: string) {
  await enter(page.getByRole('region', { name: '방·통로 모양', exact: true }), '직접 굴린 값', raw);
}

async function registerGear(page: Page, name: string, amount: string) {
  const disclosure = page.locator('.play-gear-fold > summary');
  await disclosure.click();
  const gear = page.getByRole('region', { name: '현재 장비와 소모 내역' });
  await gear.getByRole('button', { name: '장비 추가', exact: true }).click();
  const form = gear.getByRole('form', { name: '장비 등록' });
  await form.getByRole('textbox', { name: '품목 이름' }).fill(name);
  await form.getByRole('textbox', { name: '현재 수량' }).fill(amount);
  await form.getByRole('button', { name: '장부에 저장' }).click();
  await expect(form).toHaveCount(0);
  await disclosure.click();
}

async function verifyGear(page: Page, gearName: string, absent: string) {
  const disclosure = page.locator('.play-gear-fold > summary');
  await disclosure.click();
  const gear = page.getByRole('region', { name: '현재 장비와 소모 내역' });
  await expect(gear).toContainText(gearName);
  await expect(gear).not.toContainText(absent);
  await disclosure.click();
}

function reviewFor(panel: Locator) {
  return panel.getByRole('region', { name: '저장 지점 검토', exact: true });
}

test('play checkpoints confirm changes and transfer dice, stage, gear and roll history between devices', async ({ page, browser }) => {
  const panel = await setup(page);
  await registerGear(page, 'Bandage', '3');
  await rollShape(page, '29');
  const shape = page.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' });
  await expect(shape).toBeVisible();
  await panel.getByText('플레이 저장·이어하기', { exact: true }).click();
  await panel.getByRole('textbox', { name: '저장 지점 이름', exact: true }).fill('첫 계단');
  await panel.getByRole('button', { name: '저장 지점 만들기', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('첫 계단 저장 완료');
  const downloadPromise = page.waitForEvent('download');
  await panel.getByRole('button', { name: '첫 계단 파일로 저장', exact: true }).click();
  const exported = await readFile((await (await downloadPromise).path())!);
  const decoded = JSON.parse(exported.toString()) as {
    format: string; version: number; checkpoint: { data: { history: { label: string; value: string }[] } };
  };
  expect(decoded.format).toBe('kernethalas-play-checkpoint');
  expect(decoded.version).toBe(1);
  expect(decoded.checkpoint.data.history).toEqual(expect.arrayContaining([
    expect.objectContaining({ label: '방 · 통로 모양', value: '29' }),
  ]));

  await rollShape(page, '03');
  const corridor = page.getByRole('img', { name: '3번 통로 모양 예시 · 출입구 1개' });
  await expect(corridor).toBeVisible();
  await registerGear(page, 'Torch', '2');
  const stages = page.getByRole('navigation', { name: '플레이 단계', exact: true });
  const journal = stages.getByRole('button', { name: '저널', exact: true });
  const explore = stages.getByRole('button', { name: '탐험', exact: true });
  await journal.click();
  await panel.getByRole('button', { name: '첫 계단 이어서 하기', exact: true }).click();
  const review = reviewFor(panel);
  await expect(review).toContainText('장소 1 · 탐험');
  await expect(review.getByRole('heading')).toBeFocused();
  await expect(journal).toHaveAttribute('aria-current', 'step');
  await expect(corridor).not.toBeVisible();
  await review.getByRole('button', { name: '복원하고 이어하기', exact: true }).click();
  await expect(explore).toHaveAttribute('aria-current', 'step');
  await expect(shape).toBeVisible();
  await verifyGear(page, 'Bandage', 'Torch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const otherContext = await browser.newContext();
  try {
    const other = await otherContext.newPage();
    const otherPanel = await setup(other);
    await otherPanel.getByText('플레이 저장·이어하기', { exact: true }).click();
    const upload = otherPanel.getByLabel('플레이 저장 JSON 파일', { exact: true });
    await upload.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{bad') });
    await expect(otherPanel.getByRole('alert')).toBeVisible();
    await expect(reviewFor(otherPanel)).toHaveCount(0);
    await upload.setInputFiles({ name: 'first.json', mimeType: 'application/json', buffer: exported });
    await expect(reviewFor(otherPanel)).toContainText('첫 계단');
    await expect(other.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' })).toHaveCount(0);
    await reviewFor(otherPanel).getByRole('button', { name: '복원하고 이어하기', exact: true }).click();
    await expect(other.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' })).toBeVisible();
    await verifyGear(other, 'Bandage', 'Torch');
    await other.reload();
    await otherPanel.getByText('플레이 저장·이어하기', { exact: true }).click();
    await expect(otherPanel.getByRole('button', { name: '첫 계단 이어서 하기', exact: true })).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test('a later checkpoint retains map edits, resolved search rewards and battle round reminders', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  await rollShape(page, '29');
  await explore.getByText('종이 지도에 모양 옮기기', { exact: true }).click();
  const tile = explore.getByRole('region', { name: '방·통로 모양 편집' });
  await tile.getByRole('button', { name: '오른쪽 90° 회전' }).click();
  await explore.getByText('종이 지도 메모', { exact: true }).click();
  const map = explore.getByRole('region', { name: '종이 지도 장소 색인' });
  await map.getByLabel('종이 지도 번호', { exact: true }).fill('B-07');
  await map.getByRole('checkbox', { name: '잠긴 문' }).check();
  await map.getByRole('button', { name: '장소 메모 저장' }).click();
  await enter(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await enter(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  await enter(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '55');
  await explore.getByText('방 뒤지기', { exact: true }).click();
  const search = explore.getByRole('region', { name: '방 뒤지기 판정 1회차' });
  await search.getByLabel('보정 Scavenge Skill').fill('55');
  await enter(search, 'Scavenge D100', '11');
  await enter(search.getByRole('group', { name: '뒤지기 결과 D20' }), '직접 굴린 값', '13');

  await page.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('textbox', { name: '장소 이름 (선택)', exact: true }).fill('B-07');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Necropede');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  await combat.getByText(/^라운드 정리 · \d+라운드$/).click();
  const board = combat.getByRole('region', { name: '전투 턴·라운드 체크판' });
  await board.getByRole('button', { name: '다음 라운드' }).click();
  await board.getByText('확인 항목 추가', { exact: true }).click();
  await board.getByRole('button', { name: '효과 추가' }).click();
  await board.getByRole('checkbox', { name: '확인 · 출혈' }).check();

  const panel = page.locator('.play-checkpoints');
  await panel.getByText('플레이 저장·이어하기', { exact: true }).click();
  await panel.getByRole('button', { name: '저장 지점 만들기', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('B-07 저장 완료');
  await board.getByRole('button', { name: '다음 라운드' }).click();
  await panel.getByRole('button', { name: 'B-07 이어서 하기', exact: true }).click();
  const review = reviewFor(panel);
  await expect(review).toContainText('B-07 · 조우·전투');
  await review.getByRole('button', { name: '복원하고 이어하기', exact: true }).click();
  await expect(board.getByRole('status')).toContainText('2라운드');
  await expect(board.getByRole('checkbox', { name: '확인 · 출혈' })).toBeChecked();
  await page.getByRole('button', { name: '탐험', exact: true }).click();
  await expect(explore.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' }).locator('g[transform^=rotate]')).toHaveCount(1);
  await expect(search.getByRole('group', { name: 'Cooking Ingredients 수량 D4' })).toBeVisible();
});
