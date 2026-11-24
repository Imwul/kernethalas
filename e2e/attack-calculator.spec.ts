import { expect, test, type Locator } from '@playwright/test';

const skill = (calculator: Locator, side: string) => calculator.getByRole('textbox', { name: `${side} 수치` });
const roll = (calculator: Locator, side: string) => calculator.getByRole('textbox', { name: `${side} D100` });

test('the attack procedure opens the right defense and fumble tables and retains the calculation', async ({ page }) => {
  await page.goto('/atlas/p-attack?view=list&node=roll');
  await page.getByText('공격 판정 해석기', { exact: true }).click();
  const calculator = page.getByRole('region', { name: '공격 판정 해석기' });
  await skill(calculator, '공격자').fill('50');
  await skill(calculator, '방어자').fill('60');
  await roll(calculator, '공격자').fill('77');
  await roll(calculator, '방어자').fill('32');
  await expect(calculator.getByRole('status')).toContainText('방어 성공');
  await expect(calculator.getByRole('link', { name: 'PC 공격자 펌블' })).toHaveAttribute('href', '/oracle/t-fumble-pc');
  await calculator.getByRole('link', { name: '적 방어 동작' }).click();
  const table = page.getByRole('dialog', { name: 'NPC · 몬스터 방어 동작' });
  await expect(table).toBeVisible();
  await table.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(roll(calculator, '공격자')).toHaveValue('77');
  await expect(calculator.getByRole('link', { name: '적 방어 동작' })).toBeFocused();
  await expect(page).toHaveURL('/atlas/p-attack?view=list&node=roll');

  await calculator.getByRole('button', { name: '적이 공격' }).click();
  await expect(calculator.getByRole('link', { name: 'PC 방어 동작' })).toHaveAttribute('href', '/oracle/t-defensive-move-pc');
  await expect(calculator.getByRole('link', { name: '적 공격자 펌블' })).toHaveAttribute('href', '/oracle/t-fumble-npc');
  await roll(calculator, '공격자').fill('41');
  await roll(calculator, '방어자').fill('92');
  await expect(calculator.getByRole('link', { name: 'PC 명중 부위 D20' })).toHaveAttribute('href', '/oracle/t-hit-humanoid');
});

test('a mobile creature card carries adjusted CS into an attack and opens its own hit table', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/bestiary?q=necro');
  await page.getByRole('link', { name: 'Necropede', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Necropede' }).getByRole('region', { name: '전투 카드' });
  const traits = card.getByRole('region', { name: '생물 특성 효과' });
  await expect(traits).toContainText('Endurance');
  await expect(traits).toContainText('Poisoned (1)');
  await card.getByLabel('PC 레벨').fill('11');
  const input = card.getByRole('textbox', { name: '직접 굴린 값' });
  const submit = card.getByRole('button', { name: '확인', exact: true });
  await input.fill('4');
  await submit.click();
  await expect(card.getByRole('button', { name: '적 공격 판정' })).toHaveCount(0);
  await input.fill('1');
  await submit.click();
  await card.getByRole('button', { name: '적 공격 판정' }).click();
  const calculator = card.getByRole('region', { name: '공격 판정 해석기' });
  await expect(skill(calculator, '공격자')).toHaveValue('80');
  await roll(calculator, '공격자').fill('41');
  await calculator.getByRole('button', { name: 'PC가 공격' }).click();
  await expect(roll(calculator, '공격자')).toHaveValue('');
  await expect(skill(calculator, '방어자')).toHaveValue('70');
  await skill(calculator, '공격자').fill('60');
  await roll(calculator, '공격자').fill('47');
  await roll(calculator, '방어자').fill('89');
  await expect(calculator.getByRole('status')).toContainText('공격자 명중');
  await calculator.getByRole('button', { name: '적 명중 부위 보기' }).click();
  await input.fill('20');
  await submit.click();
  await expect(card.getByRole('status')).toContainText('머리');
  await expect(card.getByRole('status').locator('dt').filter({ hasText: 'Armor' }).locator('+ dd')).toHaveText('2');
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  await expect(roll(calculator, '공격자')).toHaveValue('47');
});
