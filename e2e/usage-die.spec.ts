import { expect, test, type Locator } from '@playwright/test';

async function enterUsageRoll(tool: Locator, roll: string) {
  await tool.getByRole('textbox', { name: '직접 굴린 값' }).fill(roll);
  await tool.getByRole('button', { name: '확인', exact: true }).click();
}

test('armor integrity looks up physical rolls on the selected die', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/ref/armor-integrity');
  const tool = page.getByRole('region', { name: '방어구 내구도 굴림' });
  const die = tool.getByRole('combobox', { name: '현재 주사위' });
  await expect(tool.getByRole('button', { name: '굴리기' })).toBeDisabled();
  await expect(die.locator('option')).toHaveText(['선택', 'D12', 'D10', 'D8', 'D6', 'D4']);
  await die.selectOption('D4');
  await enterUsageRoll(tool, '5');
  await expect(tool.getByRole('alert')).toContainText('1에서 4 사이');
  await enterUsageRoll(tool, '2');
  await expect(tool.getByRole('status')).toContainText('방어구 파괴');
  await expect(die).toHaveValue('D4');

  await die.selectOption('D12');
  await expect(tool.getByRole('status')).toBeEmpty();
  await enterUsageRoll(tool, '2');
  await expect(tool.getByRole('status')).toContainText('다음 주사위 D10');
  await expect(die).toHaveValue('D12');
  await tool.getByRole('button', { name: 'D12 굴리기' }).click();
  const rolled = Number(await tool.locator('.readout').textContent());
  expect(rolled).toBeGreaterThanOrEqual(1);
  expect(rolled).toBeLessThanOrEqual(12);
});

test('lair and exit checks show their own terminal effects', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/ref/lair-check');
  const lair = page.getByRole('region', { name: '은신처 소모 주사위' });
  await expect(lair.getByRole('combobox')).toHaveValue('D10');
  await lair.getByRole('combobox').selectOption('D4');
  await enterUsageRoll(lair, '1');
  await expect(lair.getByRole('status')).toContainText('이 방의 조우 판정은 건너뜁니다');
  const openExit = lair.getByRole('link', { name: '도메인 출구 판정 열기' });
  await openExit.click();
  const panel = page.getByRole('dialog', { name: '도메인 출구 판정' });
  const exit = panel.getByRole('region', { name: '출구 소모 주사위' });
  await expect(exit.getByRole('combobox')).toHaveValue('D8');
  await exit.getByRole('combobox').selectOption('D4');
  await enterUsageRoll(exit, '2');
  await expect(exit.getByRole('status')).toContainText('긴장 주사위와 조우 등 일반 판정');
  await panel.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(openExit).toBeFocused();
  await expect(lair.getByRole('status')).toContainText('Overseer 은신처 발견');
});
