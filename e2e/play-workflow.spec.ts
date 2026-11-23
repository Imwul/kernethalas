import { expect, test, type Locator } from '@playwright/test';

async function inputRoll(scope: Locator, label: string, value: string) {
  const field = scope.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('mobile action bar focuses the next physical roll and the 00 shortcut persists', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const shape = page.getByRole('region', { name: '방·통로 모양', exact: true });
  const bar = page.getByRole('region', { name: '다음 행동 바로가기' });
  const preferred = page.getByRole('button', { name: '실물 입력 우선', exact: true });
  const input = shape.getByRole('textbox', { name: '직접 굴린 값', exact: true });

  await expect(shape.getByRole('button', { name: 'D100에 00 입력' })).toBeHidden();
  await preferred.click();
  await expect(shape.getByText('D100 · 1–100 · 00 허용', { exact: true })).toBeVisible();
  const roll = shape.getByRole('button', { name: '굴리기', exact: true });
  const [fieldBounds, rollBounds] = await Promise.all([input.boundingBox(), roll.boundingBox()]);
  expect(fieldBounds!.width).toBeGreaterThanOrEqual(100);
  expect(fieldBounds!.y).toBeLessThan(rollBounds!.y);

  const next = bar.getByRole('button', { name: '다음 행동', exact: true });
  await expect(next).toHaveAccessibleDescription(/모양.*D100/);
  await next.click();
  await expect(input).toBeFocused();
  await shape.getByRole('button', { name: 'D100에 00 입력' }).click();
  await expect(input).toHaveValue('00');
  await expect(shape.getByRole('img')).toHaveCount(0);
  await shape.getByRole('button', { name: '확인', exact: true }).click();
  await expect(shape.getByRole('img', { name: /100번 방 모양/ })).toBeVisible();
  await expect(bar.getByRole('button', { name: '직전 굴림 되돌리기' })).toBeEnabled();
  await page.reload();
  await expect(preferred).toHaveAttribute('aria-pressed', 'true');
  await expect(shape.getByRole('img', { name: /100번 방 모양/ })).toBeVisible();
  await bar.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(shape.getByRole('img')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('native keyboard focus scrolls a control clear of the fixed action bar', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  const tension = explore.getByRole('region', { name: '긴장 주사위', exact: true });
  const bar = page.getByRole('region', { name: '다음 행동 바로가기' });
  const selector = tension.getByRole('combobox', { name: '긴장 주사위 크기' });
  const [selectBounds, barBounds] = await Promise.all([selector.boundingBox(), bar.boundingBox()]);
  await page.evaluate(({ top, barTop }) => window.scrollBy(0, top - barTop - 8), {
    top: selectBounds!.y, barTop: barBounds!.y,
  });
  await tension.getByRole('button', { name: 'D4 굴리기', exact: true }).evaluate((button) => button.focus({ preventScroll: true }));
  await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(selector).toBeFocused();
  await expect.poll(async () => {
    const [field, overlay] = await Promise.all([selector.boundingBox(), bar.boundingBox()]);
    return overlay!.y - field!.y - field!.height;
  }).toBeGreaterThanOrEqual(5);
});

test('rewinding an earlier event previews dependent rolls and preserves an independent description', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  const roller = (name: string) => explore.getByRole('region', { name, exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await inputRoll(roller('긴장 주사위'), '긴장 주사위 굴린 값', '3');
  await inputRoll(roller('조우 판정'), '직접 굴린 값', '9');
  await inputRoll(roller('이벤트'), '직접 굴린 값', '59');
  await inputRoll(explore.getByRole('group', { name: 'Exhaustion 감소 D4', exact: true }), '직접 굴린 값', '2');
  await explore.getByText('방 환경 묘사', { exact: true }).click();
  await inputRoll(roller('방 환경 묘사 굴림'), '직접 굴린 값', '00');
  await page.getByRole('button', { name: '이번 장소 굴림 이력으로 이동' }).click();

  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  const select = history.getByRole('button', { name: '이벤트 D100 59 수정 미리보기', exact: true });
  await select.click();
  const preview = history.getByRole('group', { name: '굴림 수정 미리보기' });
  await expect(preview).toContainText('Exhaustion 감소 D4 2 다시 확인');
  await expect(preview).not.toContainText('방 묘사');
  await preview.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();

  await expect(roller('이벤트').getByRole('textbox', { name: '직접 굴린 값', exact: true })).toBeFocused();
  await expect(explore.getByRole('group', { name: 'Exhaustion 감소 D4', exact: true })).toHaveCount(0);
  await expect(roller('방 환경 묘사 굴림').getByRole('status')).toContainText('유령 같은 불꽃');
  await expect(roller('조우 판정').getByRole('status')).toContainText('9');
  await inputRoll(roller('이벤트'), '직접 굴린 값', '55');
  await page.getByRole('button', { name: '이번 장소 굴림 이력으로 이동' }).click();
  await expect(history.getByRole('button', { name: '이벤트 D100 55 수정 미리보기', exact: true })).toBeVisible();
  await expect(select).toHaveCount(0);
  await expect(history.getByRole('button', { name: '방 묘사 D100 00 수정 미리보기', exact: true })).toBeVisible();
});

test('a correction opens the camp pane even if another wrap-up tool was selected', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const panes = page.getByRole('group', { name: '정리할 항목' });
  await panes.getByRole('button', { name: '야영', exact: true }).click();
  const camp = page.getByRole('region', { name: '야영 계산기' });
  await inputRoll(camp, '직접 굴린 D20', '18');
  await expect(camp.getByRole('status')).toContainText('야영 판정 성공');
  await panes.getByRole('button', { name: '전리품', exact: true }).click();
  await page.getByRole('button', { name: '이번 장소 굴림 이력으로 이동' }).click();
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  await history.getByRole('button', { name: '야영 판정 D20 18 수정 미리보기' }).click();
  await history.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(camp.getByRole('textbox', { name: '직접 굴린 D20', exact: true })).toBeFocused();
});
