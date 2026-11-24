import { expect, test, type Locator } from '@playwright/test';

async function playRoll(card: Locator, value: string) {
  await card.getByRole('region', { name: '표 굴리기' }).getByLabel('직접 굴린 값').fill(value);
  await card.getByRole('region', { name: '표 굴리기' }).getByRole('button', { name: '확인', exact: true }).click();
}

async function tryCheck(check: Locator, skill: string, die: string) {
  await check.getByLabel(/ 수치$/).fill(skill);
  await check.getByLabel('직접 굴린 D100').fill(die);
  await check.getByRole('button', { name: '판정', exact: true }).click();
}

test('a successful Spellward roll halves Astral Tempest and a new action clears the previous roll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ref/cr-astral-beast');
  const card = page.getByRole('region', { name: '전투 카드' });
  await playRoll(card, '5');
  await expect(card.getByRole('status')).toContainText('Astral Tempest');
  const followUp = card.locator('.creature-action-resolution');
  // The follow-up opens by itself once an action with a check is rolled.
  await expect(followUp).toContainText('범위 안 대상마다');
  const check = followUp.getByRole('group', { name: 'Spellward 판정', exact: true });
  await tryCheck(check, '50', '42');
  await expect(check.getByRole('status')).toContainText('성공');
  const damage = followUp.getByRole('group', { name: 'Arcane 피해 D8', exact: true });
  await damage.getByLabel('직접 굴린 값').fill('7');
  await damage.getByRole('button', { name: '확인', exact: true }).click();
  await expect(damage.getByRole('status')).toContainText('Arcane 피해 4 (절반 · 올림)');
  expect(await followUp.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

  await playRoll(card, '5');
  await expect(check.getByRole('status')).toHaveCount(0);
  await expect(damage).toHaveCount(0);
});

test('an action-specific Endurance check opens its damage on failure', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await playRoll(card, '6');
  await expect(card.getByRole('status')).toContainText('Abyssal Wither');
  const followUp = card.locator('.creature-action-resolution');
  await expect(followUp).toContainText('룰북에서 불명확');
  const check = followUp.getByRole('group', { name: 'Endurance 판정', exact: true });
  await tryCheck(check, '50', '79');
  const damage = followUp.getByRole('group', { name: 'Necrotic 피해 D10', exact: true });
  await damage.getByLabel('직접 굴린 값').fill('9');
  await damage.getByRole('button', { name: '확인', exact: true }).click();
  await expect(damage.getByRole('status')).toContainText('Necrotic 피해 9');
  const inputs = await check.locator('input, select').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().bottom));
  expect(new Set(inputs).size).toBe(1);
  await tryCheck(check, '50', '19');
  await expect(damage).toHaveCount(0);
});

test('damage explanations keep damage responses distinct from condition immunity before the attack', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ref/cr-pyreborn');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByText('피해 유형과 대상 반응', { exact: true }).click();
  const select = card.getByRole('combobox', { name: '공격 전 피해 유형' });
  await select.selectOption('Fire');
  await expect(card.getByRole('region', { name: 'Fire 피해 설명' })).toContainText('적용량만큼 회복');
  await select.selectOption('Cold');
  await expect(card.getByRole('region', { name: 'Cold 피해 설명' })).toContainText('피해 ×2');
  await select.selectOption('Poison');
  const guide = card.getByRole('region', { name: 'Poison 피해 설명' });
  await expect(guide).toContainText('모든 Armor 무시');
  await expect(guide).toContainText('보통 피해');
  await expect(guide).toContainText('중독 · 대상이 이 상태에 면역');
  expect(await guide.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
});
