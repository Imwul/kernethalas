import { expect, test } from '@playwright/test';
import { choiceGroup, choose } from './helpers/choice';

test('failed surprise leads to Initiative with Perception −20 and the Quick modifier', async ({ page }) => {
  await page.goto('/atlas/p-initiative?view=list');
  const start = page.getByRole('region', { name: '조우 시작 계산기' });
  await start.getByRole('textbox', { name: '적 최고 Mind' }).fill('60');
  await choose(start, '조우 시작 방식', 'surprise');
  await start.getByRole('textbox', { name: 'PC 최저 Stealth' }).fill('55');
  await start.getByRole('textbox', { name: '솔로 동료 수' }).fill('1');
  await start.getByRole('textbox', { name: 'PC 기습 D100' }).fill('49');
  await start.getByRole('textbox', { name: '적 기습 D100' }).fill('37');
  const surprise = start.getByRole('status', { name: '기습 결과' });
  await expect(surprise).toContainText('기습 실패');
  await expect(surprise).toContainText('Perception −20');

  await start.getByRole('checkbox', { name: 'Quick 무기 +10' }).check();
  await start.getByRole('textbox', { name: 'PC 최고 Perception' }).fill('60');
  await expect(start.getByText('보정된 Perception 50.')).toBeVisible();
  await start.getByRole('textbox', { name: 'PC Initiative D100' }).fill('22');
  await start.getByRole('textbox', { name: '적 Initiative D100' }).fill('72');
  const initiative = start.getByRole('status', { name: 'Initiative 결과' });
  await expect(initiative).toContainText('PC 측 선공');
  await expect(initiative).toContainText('다음 공격 Advantage');
  await start.getByRole('textbox', { name: 'PC Initiative D100' }).fill('77');
  await expect(initiative).toContainText('적 측 선공');
  await expect(initiative).toContainText('첫 턴을 잃음');

  await start.getByRole('textbox', { name: 'PC 기습 D100' }).fill('32');
  await start.getByRole('textbox', { name: '적 기습 D100' }).fill('39');
  await expect(surprise).toContainText('기습 실패');
  await start.getByRole('textbox', { name: '적 기습 D100' }).fill('73');
  await expect(surprise).toContainText('첫 공격 +20');
  await expect(start.getByRole('textbox', { name: 'PC Initiative D100' })).toHaveCount(0);

  await choose(start, '조우 시작 방식', 'ambushed');
  await expect(surprise).toContainText('적 측 선공');
  await expect(start.getByRole('textbox', { name: 'PC 기습 D100' })).toHaveCount(0);
});

test('monster card imports Mind and Alert plus the greatest fear loss of the encounter', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/bestiary?q=dwerax');
  await page.getByRole('link', { name: '드웨랙스', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '드웨랙스' });
  await dialog.getByText('조우 시작', { exact: true }).click();
  const start = dialog.getByRole('region', { name: '조우 시작 계산기' });
  await expect(start.getByRole('textbox', { name: '적 최고 Mind' })).toHaveValue('60');
  const alert = start.getByRole('checkbox', { name: /Alert 적 있음/ });
  await expect(alert).toBeChecked();
  await expect(alert).toBeDisabled();
  await expect(choiceGroup(start, '조우 시작 방식').locator('button[data-value=surprise]')).toBeDisabled();
  await start.getByRole('textbox', { name: 'PC Resolve' }).fill('50');
  const roll = start.getByRole('textbox', { name: 'Resolve D100' });
  await roll.fill('63');
  const resolve = start.getByRole('status', { name: 'Resolve 결과' });
  await expect(resolve).toContainText('Sanity 2 손실');
  await choose(start, '조우의 공포 특성', '4');
  await expect(resolve).toContainText('Sanity 4 손실');
  await roll.fill('00');
  await expect(resolve).toContainText('Sanity 4 + D4 손실');
});
