import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDrawer, openPane } from './helpers/play-desk';

const WIDTH = Number(process.env.KN_TIMELINE_WIDTH ?? 320);

async function enter(scope: Locator, label: string, value: string) {
  const input = scope.getByRole('textbox', { name: label, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

function stages(page: Page) {
  return page.getByRole('navigation', { name: '플레이 단계' });
}

async function nextLocation(page: Page) {
  await stages(page).getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('region', { name: '이번 장소 기록' }).getByRole('button', { name: '다음 장소', exact: true }).click();
}

test('domain timeline archives the journal and copies only unchecked portions', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { async writeText(text: string) { document.documentElement.dataset.copiedNote = text; } },
    });
  });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  const step = (name: string) => explore.getByRole('region', { name, exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await enter(step('긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await enter(step('조우 판정'), '직접 굴린 값', '1');
  await enter(step('이벤트'), '직접 굴린 값', '59');
  await enter(explore.getByRole('group', { name: 'Exhaustion 감소 D4', exact: true }), '직접 굴린 값', '2');
  await stages(page).getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await journal.getByRole('textbox', { name: '장소 이름 (선택)' }).fill('닫힌 납골당');
  await journal.getByRole('textbox', { name: '덧붙일 메모 (선택)' }).fill('돌아갈 때 철문 확인');
  const excerpt = journal.locator('.play-journal-output');
  await expect(excerpt).toContainText('닫힌 납골당');
  await expect(excerpt).toContainText('돌아갈 때 철문 확인');
  await journal.getByRole('checkbox', { name: '광원 −1', exact: true }).check();
  await journal.getByRole('button', { name: '다음 장소', exact: true }).click();
  await page.reload();

  await openDrawer(page, '도메인');
  await page.getByText('탐험 연대기', { exact: true }).click();
  const timeline = page.getByRole('region', { name: '도메인 탐험 연대기' });
  await timeline.getByText('닫힌 납골당', { exact: true }).click();
  await expect(timeline.getByText('돌아갈 때 철문 확인', { exact: true })).toBeVisible();
  await expect(timeline.getByRole('checkbox', { name: '광원 −1', exact: true })).toBeChecked();
  const journalCheck = timeline.getByRole('checkbox', { name: '저널에 옮김', exact: true });
  const exhaustion = timeline.getByRole('checkbox', { name: 'Exhaustion −2', exact: true });
  await expect(journalCheck).not.toBeChecked();
  await expect(exhaustion).not.toBeChecked();
  await journalCheck.check();
  await timeline.getByRole('button', { name: '미반영만 복사', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-copied-note', '장소 1 · 닫힌 납골당\n시트 · Exhaustion −2');
  await expect(exhaustion).not.toBeChecked();
  await exhaustion.check();
  await timeline.getByRole('button', { name: '미반영만', exact: true }).click();
  await expect(timeline).toContainText('종이에 옮기지 않은 항목이 없습니다.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH);

  const domain = page.getByRole('region', { name: '도메인 효과' });
  await domain.getByRole('button', { name: '새 도메인', exact: true }).click();
  await domain.getByRole('button', { name: 'D8로 새 도메인 시작', exact: true }).click();
  await openDrawer(page, '도메인');
  await page.getByText('탐험 연대기', { exact: true }).click();
  await expect(timeline).toContainText('다음 장소로 이동하면 여기에 기록이 남습니다.');
  await domain.getByRole('combobox', { name: '도메인 전환' }).selectOption('1');
  await domain.getByRole('button', { name: '선택한 도메인으로 이동', exact: true }).click();
  await openDrawer(page, '도메인');
  await page.getByText('탐험 연대기', { exact: true }).click();
  await timeline.getByText('닫힌 납골당', { exact: true }).click();
  await expect(journalCheck).toBeChecked();
  await expect(exhaustion).toBeChecked();
});

test('return places show tags and saved exit marks before a safe direct revisit', async ({ page }) => {
  await page.setViewportSize({ width: WIDTH, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험' });
  const map = explore.getByRole('region', { name: '종이 지도 장소 색인' });
  const save = async (id: string, tag: string, note: string) => {
    await openPane(explore, '종이 지도 메모');
    await map.getByRole('textbox', { name: '종이 지도 번호', exact: true }).fill(id);
    await map.getByRole('textbox', { name: '장소 메모', exact: true }).fill(note);
    await map.getByRole('checkbox', { name: tag, exact: true }).check();
    await map.getByRole('button', { name: '장소 메모 저장', exact: true }).click();
  };

  await enter(explore.getByRole('region', { name: '방·통로 모양', exact: true }), '직접 굴린 값', '01');
  await explore.getByText('종이 지도에 모양 옮기기', { exact: true }).click();
  const tile = explore.getByRole('region', { name: '방·통로 모양 편집' });
  await tile.getByRole('combobox', { name: '들어온 출입구', exact: true }).selectOption({ label: '1번' });
  await tile.getByRole('combobox', { name: '표시할 출입구', exact: true }).selectOption({ label: '2번' });
  await tile.getByRole('combobox', { name: '출입구 상태', exact: true }).selectOption({ label: '잠김' });
  await save('B-07', '잠긴 문', '철문 옆 메모');
  await nextLocation(page);

  await explore.getByRole('button', { name: '방', exact: true }).click();
  await save('C-02', '미개봉 용기', '남겨 둔 항아리');
  await nextLocation(page);
  await page.reload();
  await openPane(explore, '돌아갈 곳');
  const returns = explore.getByRole('region', { name: '돌아갈 곳 목록' });
  const first = returns.getByRole('button', { name: 'B-07 재방문', exact: true });
  const second = returns.getByRole('button', { name: 'C-02 재방문', exact: true });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await expect(returns).toContainText('입구 1번 · 2번 잠김');
  await returns.getByRole('button', { name: '미탐색 출입구', exact: true }).click();
  await expect(returns).toContainText('이 표시에 해당하는 장소가 없습니다.');
  await returns.getByRole('button', { name: '잠긴 문', exact: true }).click();
  await expect(first).toBeEnabled();
  await expect(second).toHaveCount(0);
  await first.click();

  await expect(returns.getByRole('status')).toContainText('B-07 재방문을 선택했습니다.');
  await expect(explore.getByRole('button', { name: '통로', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(explore.getByRole('button', { name: '재방문', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openPane(explore, '종이 지도 메모');
  await expect(map.getByRole('textbox', { name: '장소 메모', exact: true })).toHaveValue('철문 옆 메모');
  await map.getByRole('button', { name: '장소 메모 저장', exact: true }).click();
  await openPane(explore, '돌아갈 곳');
  await expect(returns).toContainText('입구 1번 · 2번 잠김');
  await enter(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await expect(first).toBeDisabled();
  await expect(explore.getByRole('region', { name: '조우 판정' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(WIDTH);
});
