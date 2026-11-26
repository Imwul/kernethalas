import { expect, test, type Locator, type Page } from '@playwright/test';
import { openPane, setViewOption } from './helpers/play-desk';

async function roll(scope: Locator, label: string, value: string) {
  const input = scope.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

async function nextLocation(page: Page) {
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('region', { name: '이번 장소 기록' }).getByRole('button', { name: '다음 장소', exact: true }).click();
}

test('pin room facts, link a player hypothesis, and recall it from either paper-map location', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await setViewOption(page, '집중 보기', false);
  const explore = page.getByRole('region', { name: '장소 탐험' });
  const region = (name: string) => explore.getByRole('region', { name, exact: true });
  const strip = explore.getByRole('group', { name: '종이 지도', exact: true });
  const clues = region('종이 지도 단서');
  const list = clues.getByRole('list', { name: '이 장소의 단서' });
  const input = clues.getByRole('textbox', { name: /^단서 내용/ });
  const save = clues.getByRole('button', { name: '단서 저장', exact: true });

  await explore.getByRole('button', { name: '방', exact: true }).click();
  await openPane(explore, '방 환경 묘사');
  await roll(region('방 환경 묘사 굴림'), '직접 굴린 값', '14');
  await region('방 환경 묘사 굴림').getByRole('button', { name: '환경 묘사를 단서로 남기기' }).click();
  const roomId = clues.getByRole('textbox', { name: '단서를 남길 지도 번호' });
  await expect(roomId).toBeFocused();
  await expect(input).not.toHaveValue('');
  const description = await input.inputValue();
  await roomId.fill('B-07');
  await save.click();
  await expect(list).toContainText(description);
  await expect(list).toContainText('확인한 사실');

  await roll(region('긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await roll(region('조우 판정'), '직접 굴린 값', '1');
  await roll(region('이벤트'), '직접 굴린 값', '55');
  await region('이벤트').getByRole('button', { name: '이벤트를 단서로 남기기' }).click();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(/^D100 55/);
  await save.click();
  await expect(list).toContainText('D100 55');

  await openPane(strip, '종이 지도 메모');
  const memo = region('종이 지도 장소 색인');
  await memo.getByRole('textbox', { name: '장소 메모', exact: true }).fill('방 입구 문에 밀랍 자국');
  await memo.getByRole('button', { name: '장소 메모 저장', exact: true }).click();
  await nextLocation(page);

  await explore.getByRole('button', { name: '방', exact: true }).click();
  await openPane(strip, '단서');
  await roomId.fill('C-02');
  const hypothesis = '석관의 문장이 B-07에 남은 인장과 같은 가문의 표식일 수 있다.';
  await input.fill(hypothesis);
  const status = clues.getByRole('combobox', { name: '단서 구분' });
  await expect(status).toHaveValue('hypothesis');
  await clues.getByRole('combobox', { name: '연결할 장소 (선택)' }).selectOption('B-07');
  await save.click();
  await expect(list).toContainText('연결 장소 B-07');
  await nextLocation(page);
  await page.reload();

  await openPane(strip, '돌아갈 곳');
  const returns = region('돌아갈 곳 목록');
  await returns.getByRole('button', { name: '단서', exact: true }).click();
  await expect(returns.getByRole('button', { name: 'C-02 재방문', exact: true })).toBeVisible();
  await returns.getByRole('button', { name: 'B-07 재방문', exact: true }).click();
  const recap = region('재방문 단서');
  await expect(recap).toContainText(hypothesis);
  await expect(recap).toContainText('C-02에서 연결');
  await expect(recap).toContainText('추측');
  await recap.getByRole('button', { name: '단서 3개 보기' }).click();
  await expect(list).toContainText(description);
  await expect(list).toContainText('D100 55');
  await expect(list.getByRole('button', { name: `단서 편집 · ${hypothesis}` })).toHaveCount(0);
  await list.getByRole('button', { name: `단서 편집 · ${description}` }).click();
  await status.selectOption('hypothesis');
  await save.click();
  await expect(list.getByRole('listitem').filter({ hasText: description })).toContainText('추측');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
