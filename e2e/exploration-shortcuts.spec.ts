import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 800 } });

test('an exploration shortcut opens related rolls without leaving the selected step', async ({ page }) => {
  const route = '/atlas/p-explore-room?view=list&node=shape';
  await page.goto(route);
  const tray = page.getByRole('region', { name: '탐험 바로가기' });
  const encounter = tray.getByRole('link', { name: /^조우 판정/ });
  await expect(tray.getByRole('link', { name: /이벤트.*조우가 없는 새 방/ })).toBeVisible();

  await encounter.click();
  const check = page.getByRole('dialog', { name: '조우 판정' });
  const input = check.getByRole('textbox', { name: '직접 굴린 값' });
  const submit = check.getByRole('button', { name: '확인', exact: true });

  await input.fill('9');
  await submit.click();
  await expect(check.getByRole('link', { name: /이벤트/ })).toBeVisible();

  await input.fill('12');
  await submit.click();
  await expect(check.getByRole('link', { name: /이벤트/ })).toHaveCount(0);
  await check.getByRole('link', { name: /전투 조우.*표 선택/ }).click();
  const table = page.getByRole('dialog', { name: '전투 조우 — 표 선택' });
  await expect(table).toBeVisible();
  await table.getByRole('button', { name: /조우 판정/ }).click();
  await expect(check.getByRole('status')).toContainText('12');
  await check.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(page).toHaveURL(route);
  await expect(encounter).toBeFocused();
});

test('Tension dice roll only the chosen die and keep their result in the current screen', async ({ page }) => {
  await page.goto('/atlas/p-explore-room');
  const tray = page.getByRole('region', { name: '탐험 바로가기' });
  const tension = tray.getByRole('button', { name: /^긴장 주사위/ });
  await tension.click();
  const rolls = tray.getByRole('group', { name: '긴장 주사위 굴리기' });
  await rolls.getByRole('button', { name: 'D4 굴리기' }).click();
  await expect(tray.getByRole('status')).toHaveText(/D4 결과\s*[1-4]/);
  await expect(tray.getByRole('link', { name: '짙어지는 어둠' })).toBeVisible();

  await page.reload();
  await tension.click();
  await expect(tray.getByRole('status')).toBeEmpty();
});
