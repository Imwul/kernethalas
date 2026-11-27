import { expect, test, type Locator } from '@playwright/test';
import { choose } from './helpers/choice';

async function enterRoll(scope: Locator, roll: string) {
  await scope.getByRole('textbox', { name: '직접 굴린 값' }).fill(roll);
  await scope.getByRole('button', { name: '확인', exact: true }).click();
}

const field = (scope: Locator, name: string) => scope.getByRole('textbox', { name, exact: true });

test('the rolled action decides the enemy attack and its damage reaches the PC calculator', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  await card.getByRole('region', { name: '공격 판정 해석기' }).getByRole('button', { name: '적이 공격' }).click();
  // Before an attack action is rolled, the attack check says where the damage comes from.
  await expect(card.getByLabel('이번 적 공격')).toContainText('공격 행동이 나오면');
  await card.getByLabel('이번 적 공격').getByRole('button', { name: '행동 D6 보기' }).click();

  await enterRoll(card, '1');
  await card.getByRole('button', { name: '적 공격 판정' }).click();
  await expect(card.getByLabel('이번 적 공격')).toContainText('Chain Lash · D6 Piercing');
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await field(attack, '방어자 수치').fill('50');
  await field(attack, '공격자 D100').fill('31');
  await field(attack, '방어자 D100').fill('79');
  await attack.getByRole('button', { name: 'PC 명중 부위 D20' }).click();
  await enterRoll(card, '10');
  await card.getByRole('button', { name: '이 부위로 피해 계산' }).click();

  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await expect(damage.locator('.damage-attack-source > p')).toHaveText('공격 Chain Lash · D6 Piercing');
  await expect(damage.getByRole('combobox', { name: '피해 유형' })).toHaveValue('Piercing');
  await enterRoll(damage.getByRole('group', { name: /Chain Lash 피해/ }), '5');
  await expect(field(damage, '선택 주사위')).toHaveValue('5');
  await field(damage, '대상 부위 Armor').fill('1');
  await expect(damage.getByRole('status').filter({ hasText: '최종 피해' })).toHaveText('최종 피해 4 Piercing');
});

test('Level Adaptation dice join the attack pool and the highest die counts', async ({ page }) => {
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByLabel('PC 레벨').fill('11');
  await enterRoll(card, '2');
  await card.getByRole('button', { name: '적 공격 판정' }).click();
  await expect(card.getByLabel('이번 적 공격')).toContainText('D6+D6+D8 Piercing · 레벨 적응 +D6 +D8 포함 · 가장 높은 눈');
  await card.getByRole('button', { name: '피해 계산', exact: true }).click();
  await card.getByRole('group', { name: '피해를 받는 쪽' }).getByRole('button', { name: 'PC', exact: true }).click();
  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await enterRoll(damage.getByRole('group', { name: /Chain Lash 피해/ }), '4 6 2');
  await expect(field(damage, '선택 주사위')).toHaveValue('6');
});

test('an action with two attacks lets the player pick one', async ({ page }) => {
  await page.goto('/ref/cr-cavebound-leech');
  const card = page.getByRole('region', { name: '전투 카드' });
  await enterRoll(card, '5');
  await choose(card, '공격 방식', '1');
  await card.getByRole('button', { name: '적 공격 판정' }).click();
  await expect(card.getByLabel('이번 적 공격')).toContainText('Engulfing Devour · D6 Piercing');
});

test('both sides failing sends the defender 1 damage, and untyped damage still calculates', async ({ page }) => {
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await field(attack, '공격자 수치').fill('30');
  await field(attack, '공격자 D100').fill('85');
  await field(attack, '방어자 D100').fill('95');
  await expect(attack.getByRole('status')).toContainText('양쪽 실패');
  await attack.getByRole('button', { name: '적 1 피해 적용' }).click();
  const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
  await expect(field(damage, '확정 피해량')).toHaveValue('1');
  await expect(damage).toContainText('Armor·저항으로 줄지 않습니다');

  await damage.getByRole('button', { name: '공격 피해' }).click();
  await field(damage, '선택 주사위').fill('4');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption({ label: '유형 없음' });
  await field(damage, '대상 부위 Armor').fill('1');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 3 유형 없음');

  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  await attack.getByRole('button', { name: '적이 공격' }).click();
  await field(attack, '방어자 수치').fill('30');
  await field(attack, '공격자 D100').fill('85');
  await field(attack, '방어자 D100').fill('95');
  await attack.getByRole('button', { name: 'PC 1 피해 적용' }).click();
  const incoming = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await expect(field(incoming, '확정 피해량')).toHaveValue('1');
  await field(incoming, '현재 Toughness').fill('3');
  await expect(incoming.getByRole('region', { name: 'PC 피해 적용' }).locator('dd')).toHaveText(['−1', '0']);
});

test('in play, the enemy turn starts from its action roll and the attack is recorded with its damage type', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Fangvine');
  await combat.getByRole('button', { name: 'Fangvine', exact: true }).click();
  const summary = combat.getByRole('region', { name: '현재 전투 턴', exact: true });
  await summary.getByRole('button', { name: '적 행동 D6', exact: true }).click();
  const card = combat.getByRole('region', { name: '전투 카드' });
  const actionRoll = card.getByRole('textbox', { name: '직접 굴린 값' });
  await expect(actionRoll).toBeFocused();
  await actionRoll.fill('3');
  await card.getByRole('button', { name: '확인', exact: true }).click();
  await card.getByRole('button', { name: '적 공격 판정' }).click();
  await expect(card.getByLabel('이번 적 공격')).toContainText('Thorned Assault · D6 Piercing');
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await field(attack, '방어자 수치').fill('50');
  await field(attack, '공격자 D100').fill('31');
  await field(attack, '방어자 D100').fill('79');
  await attack.getByRole('button', { name: 'PC 명중 부위 D20' }).click();
  await enterRoll(card, '10');
  await card.getByRole('button', { name: '이 부위로 피해 계산' }).click();
  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await enterRoll(damage.getByRole('group', { name: /Thorned Assault 피해/ }), '4');
  await field(damage, '대상 부위 Armor').fill('0');
  await field(damage, '현재 Toughness').fill('2');
  await damage.getByRole('button', { name: '피해 기록', exact: true }).click();
  await expect(damage).toContainText('저널 · Fangvine → PC · 가슴 · 피해 4 Piercing · Toughness −2 · Health −2');
});
