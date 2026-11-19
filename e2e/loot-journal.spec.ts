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

test('using a prior Reason critical for attunement does not record it again', async ({ page }) => {
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  const tension = explore.getByRole('region', { name: '긴장 주사위', exact: true }).getByLabel('긴장 주사위 굴린 값');
  await tension.fill('3');
  await tension.press('Enter');
  for (const [label, value] of [['조우 판정', '9'], ['이벤트', '39']]) {
    const input = explore.getByRole('region', { name: label, exact: true }).getByLabel('직접 굴린 값');
    await input.fill(value);
    await input.press('Enter');
  }
  await skillRoll(explore, 'Reason 판정', 'Reason', 45, 33);

  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '야영', exact: true }).click();
  await wrap.getByRole('button', { name: '대기 중인 기술 성장으로', exact: true }).click();
  const growth = wrap.getByRole('region', { name: '야영 기술 성장' });
  await growth.getByRole('button', { name: 'Reason', exact: true }).click();
  await growth.getByRole('button', { name: '종이 시트에서 성장 표시를 지웠어요', exact: true }).click();

  await wrap.getByRole('button', { name: '전리품', exact: true }).click();
  await enterRoll(wrap, '전리품 D6', '6');
  await wrap.getByRole('button', { name: '보물 이어서' }).click();
  await enterRoll(wrap, '보물 D20', '1');
  await wrap.getByRole('button', { name: '마법 아이템 생성 이어서' }).click();
  const item = wrap.getByRole('region', { name: '마법 아이템 기록' });
  await enterRoll(item, '마법 아이템 종류 D8', '5');
  await item.getByRole('combobox', { name: '아이템 조율' }).selectOption('reason-roll');
  const reason = await skillRoll(item, '감정에 사용할 Reason 판정', 'Reason', 45, 33);
  await expect(reason.getByRole('status')).toContainText('Brilliant Deduction');
  await expect(reason.getByRole('status')).not.toContainText('기술 성장 표시');
  await expect(item.getByRole('group', { name: '아이템 희귀도 D10' })).toBeVisible();

  await wrap.getByRole('button', { name: '야영', exact: true }).click();
  await expect(wrap.getByRole('group', { name: '야영 성장 대기' })).toHaveCount(0);
  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  const critical = 'Reason · D100 33 · 대성공';
  await expect(journal).toContainText(critical);
  expect((await journal.innerText()).split(critical)).toHaveLength(2);
});
