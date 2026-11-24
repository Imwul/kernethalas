import { expect, test } from '@playwright/test';

test('a mobile monster hit carries the critical, weak spot, armor and damage reactions into the breakdown', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/bestiary?q=necro');
  await page.getByRole('link', { name: 'Necropede', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Necropede' }).getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '피해 계산', exact: true }).click();
  const damage = card.getByRole('region', { name: '피해 계산기' });
  await damage.getByRole('textbox', { name: '선택 주사위' }).fill('4');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await expect(damage.getByText('Armor를 입력하면 피해를 계산합니다.')).toBeVisible();
  await expect(damage.getByRole('status')).toHaveCount(0);

  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await attack.getByRole('textbox', { name: '공격자 수치' }).fill('60');
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('22');
  await attack.getByRole('textbox', { name: '방어자 D100' }).fill('79');
  await expect(attack.getByRole('status')).toContainText('Critical Strike');
  await attack.getByRole('button', { name: '적 명중 부위 보기' }).click();
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill('20');
  await card.getByRole('button', { name: '확인', exact: true }).click();
  await card.getByRole('button', { name: '이 부위로 피해 계산' }).click();

  await expect(damage.getByRole('checkbox', { name: /머리 명중 적용.*약점/ })).toBeChecked();
  await expect(damage.getByRole('textbox', { name: '대상 부위 Armor' })).toHaveValue('2');
  await expect(damage.getByRole('combobox', { name: '공격 판정' })).toHaveValue('2');
  await damage.getByRole('textbox', { name: '선택 주사위' }).fill('4');
  await damage.getByRole('textbox', { name: '고정 피해 보정' }).fill('1');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 10 Piercing');
  await expect(damage.getByText('치명타·약점 ×2')).toBeVisible();
  await expect(damage.getByText('Piercing 치명타 +2')).toBeVisible();

  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Holy');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 20 Holy');
  await expect(damage.getByText('Armor 무시', { exact: true })).toBeVisible();
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Necrotic');
  await expect(damage.getByRole('status')).toHaveText('Health 회복 10 Necrotic');
});

test('physical resistance rounds up and can be adjusted for a magical attack', async ({ page }) => {
  await page.goto('/ref/cr-umbra-fiend');
  await page.getByRole('button', { name: '피해 계산', exact: true }).click();
  const damage = page.getByRole('region', { name: '피해 계산기' });
  await damage.getByRole('textbox', { name: '선택 주사위' }).fill('5');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 3 Piercing');
  await damage.getByRole('checkbox', { name: '마법 피해' }).check();
  await expect(damage.getByRole('status')).toHaveText('최종 피해 5 Piercing');
});

test('an enemy critical carries the PC hit into Toughness and Health without spending either', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/bestiary?q=necro');
  await page.getByRole('link', { name: 'Necropede', exact: true }).click();
  const card = page.getByRole('dialog', { name: 'Necropede' }).getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await attack.getByRole('button', { name: '적이 공격' }).click();
  await attack.getByRole('textbox', { name: '방어자 수치' }).fill('50');
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('22');
  await attack.getByRole('textbox', { name: '방어자 D100' }).fill('79');
  await attack.getByRole('button', { name: 'PC 명중 부위 D20' }).click();
  await expect(card.getByRole('group', { name: '피해를 받는 쪽' }).getByRole('button', { name: 'PC', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill('20');
  await card.getByRole('button', { name: '확인', exact: true }).click();
  await card.getByRole('button', { name: '이 부위로 피해 계산' }).click();

  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await expect(damage.getByRole('checkbox', { name: /머리 명중 적용.*약점/ })).toBeChecked();
  await expect(damage.getByRole('combobox', { name: '공격 판정' })).toHaveValue('2');
  await damage.getByRole('textbox', { name: '선택 주사위' }).fill('4');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await damage.getByRole('textbox', { name: '대상 부위 Armor' }).fill('2');
  await damage.getByRole('textbox', { name: '현재 Toughness' }).fill('3');
  const losses = damage.getByRole('region', { name: 'PC 피해 적용' }).locator('dd');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 8 Piercing');
  await expect(losses).toHaveText(['−3', '−5']);

  await damage.getByRole('button', { name: '확정 피해' }).click();
  await damage.getByRole('textbox', { name: '확정 피해량' }).fill('4');
  await damage.getByRole('checkbox', { name: 'Health 직접 적용' }).check();
  await expect(losses).toHaveText(['0', '−4']);
  await damage.getByRole('checkbox', { name: 'Health 직접 적용' }).uncheck();
  await expect(damage.getByRole('textbox', { name: '현재 Toughness' })).toHaveValue('3');
  await expect(losses).toHaveText(['−3', '−1']);
});
