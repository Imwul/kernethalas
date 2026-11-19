import { expect, test, type Locator } from '@playwright/test';
import { skillRoll } from './helpers/skill-roll';

async function enterRoll(journal: Locator, step: string, value: string) {
  const group = journal.getByRole('group', { name: step, exact: true });
  await group.getByRole('textbox', { name: '직접 굴린 값' }).fill(value);
  await group.getByRole('button', { name: '확인', exact: true }).click();
}

test('a potion only reveals its kind after identification and records aging in one line', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/atlas/p-potion');
  const journal = page.getByRole('region', { name: '물약 기록' });
  const method = journal.getByRole('combobox', { name: '물약 감정' });
  await method.selectOption('medicine-check');
  const medicine = await skillRoll(journal, '물약 감정 Medicine 판정', 'Medicine', 40, 88);
  await expect(medicine.getByRole('status')).toContainText('Harmful Treatment');
  await expect(medicine.getByRole('textbox', { name: '직접 굴린 D100' })).toHaveCount(0);
  await expect(journal.getByText('마셔 본 뒤 물약 종류를 정할 수 있습니다.')).toBeVisible();
  await expect(journal.getByRole('group', { name: '물약 종류 D20' })).toHaveCount(0);
  await method.selectOption('drank');
  await expect(method.getByRole('option', { name: 'Medicine 판정' })).toBeDisabled();
  await enterRoll(journal, '물약 종류 D20', '7');
  await enterRoll(journal, '물약 노화 D20', '2');
  const line = journal.getByRole('region', { name: '저널용 한 줄' });
  await expect(line).toContainText('Heal 물약 (마심)');
  await expect(line).toContainText('Poisoned (1)');
  await expect(line).not.toContainText('Wounds 즉시 회복');
  await journal.getByRole('button', { name: '새 물약' }).click();
  await expect(line).toHaveCount(0);
  await expect(method.getByRole('option', { name: 'Medicine 판정' })).toBeEnabled();
});

test('a magic weapon needs attunement before rarity and fills table follow-ups for each property', async ({ page }) => {
  await page.goto('/atlas/p-magic-item');
  const journal = page.getByRole('region', { name: '마법 아이템 기록' });
  const rarity = journal.getByRole('group', { name: '아이템 희귀도 D10' });
  await enterRoll(journal, '마법 아이템 종류 D8', '1');
  await enterRoll(journal, '무작위 무기 D100', '59');
  await expect(rarity).toHaveCount(0);
  await journal.getByRole('combobox', { name: '아이템 조율' }).selectOption('camp');
  await enterRoll(journal, '아이템 희귀도 D10', '6');
  await enterRoll(journal, '속성 1 D20', '8');
  await enterRoll(journal, '적 유형 D8', '6');
  await enterRoll(journal, '속성 2 D20', '9');
  const line = journal.getByRole('region', { name: '저널용 한 줄' });
  await expect(line).toContainText('Weapon Longsword · Rare');
  await expect(line).toContainText('추가 피해 +2 (Undead)');
  await expect(line).toContainText('+2D6');
  await expect(journal.getByRole('group', { name: '속성 3 D20' })).toHaveCount(0);

  await enterRoll(journal, '마법 아이템 종류 D8', '6');
  await enterRoll(journal, '무작위 Mastery D20', '1');
  await expect(line).toContainText('Amulet · Mastery Abyssal Reaver');
  await expect(rarity).toHaveCount(0);

  await enterRoll(journal, '마법 아이템 종류 D8', '5');
  await journal.getByRole('combobox', { name: '아이템 조율' }).selectOption('reason-roll');
  await skillRoll(journal, '감정에 사용할 Reason 판정', 'Reason', 40, 32);
  await expect(rarity).toHaveCount(0);
  const reason = await skillRoll(journal, '감정에 사용할 Reason 판정', 'Reason', 40, 33);
  await expect(reason.getByRole('status')).toContainText('Brilliant Deduction');
  await enterRoll(journal, '아이템 희귀도 D10', '1');
  await enterRoll(journal, '속성 1 D20', '20');
  await expect(line).toContainText('속성 확인 중');
  await enterRoll(journal, '속성 수치 D10', '7');
  await expect(line).toContainText('Gloves · Uncommon · 최대 Toughness +7');
});
