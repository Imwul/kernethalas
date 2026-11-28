import { expect, test, type Locator } from '@playwright/test';
import { choose } from './helpers/choice';

async function enterRoll(scope: Locator, roll: string) {
  await scope.getByRole('textbox', { name: '직접 굴린 값' }).fill(roll);
  await scope.getByRole('button', { name: '확인', exact: true }).click();
}

const field = (scope: Locator, name: string) => scope.getByRole('textbox', { name, exact: true });
const enemyAttack = (card: Locator) => card.getByRole('region', { name: '적 공격' });

test('the rolled action opens the enemy attack, its hit location and damage in one view', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await enterRoll(card, '1');
  const attack = enemyAttack(card);
  await expect(attack.locator('.creature-attack-line')).toHaveText('공격 Chain Lash · D6 Piercing');
  await field(attack, '방어자 수치').fill('50');
  await field(attack, '공격자 D100').fill('31');
  await field(attack, '방어자 D100').fill('79');
  await enterRoll(card.getByRole('region', { name: 'PC 명중 부위' }), '10');

  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await expect(damage.locator('.damage-attack-source > p')).toHaveText('공격 Chain Lash · D6 Piercing');
  await expect(damage.getByRole('combobox', { name: '피해 유형' })).toHaveValue('Piercing');
  await enterRoll(damage.getByRole('group', { name: /Chain Lash 피해/ }), '5');
  await expect(field(damage, '선택 주사위')).toHaveValue('5');
  await field(damage, '대상 부위 Armor').fill('1');
  await expect(damage.getByRole('status').filter({ hasText: '최종 피해' })).toHaveText('최종 피해 4 Piercing');

  // New attack dice start a new exchange below.
  await field(attack, '공격자 D100').fill('33');
  await expect(card.getByRole('region', { name: 'PC 명중 부위' }).getByRole('textbox', { name: '직접 굴린 값' })).toHaveValue('');
  await expect(field(card.getByRole('region', { name: 'PC 받는 피해 계산기' }), '선택 주사위')).toHaveValue('');
});

test('Level Adaptation dice join the attack pool and the highest die counts', async ({ page }) => {
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByLabel('PC 레벨').fill('11');
  await enterRoll(card, '2');
  const attack = enemyAttack(card);
  await expect(attack.locator('.creature-attack-line')).toContainText('D6+D6+D8 Piercing · 레벨 적응 +D6 +D8 포함 · 가장 높은 눈');
  await attack.getByRole('group', { name: '방어 방식' }).getByRole('button', { name: '자동 명중 · 굴림 없음' }).click();
  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await enterRoll(damage.getByRole('group', { name: /Chain Lash 피해/ }), '4 6 2');
  await expect(field(damage, '선택 주사위')).toHaveValue('6');
});

test('an action with two attacks lets the player pick one', async ({ page }) => {
  await page.goto('/ref/cr-cavebound-leech');
  const card = page.getByRole('region', { name: '전투 카드' });
  await enterRoll(card, '5');
  await choose(card, '공격 방식', '1');
  await expect(enemyAttack(card).locator('.creature-attack-line')).toContainText('Engulfing Devour · D6 Piercing');
});

test('both sides failing gives the defender 1 damage, and untyped damage still calculates', async ({ page }) => {
  await page.goto('/ref/cr-abyssal-vexator');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: 'PC 공격', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await field(attack, '공격자 수치').fill('30');
  await field(attack, '공격자 D100').fill('85');
  await field(attack, '방어자 D100').fill('95');
  await expect(attack.getByRole('status').first()).toContainText('양쪽 실패');
  const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
  await expect(field(damage, '확정 피해량')).toHaveValue('1');
  await expect(damage).toContainText('Armor·저항으로 줄지 않습니다');

  await damage.getByRole('button', { name: '공격 피해' }).click();
  await field(damage, '선택 주사위').fill('4');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption({ label: '유형 없음' });
  await field(damage, '대상 부위 Armor').fill('1');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 3 유형 없음');

  await card.getByRole('button', { name: '적 행동 D6', exact: true }).click();
  await enterRoll(card, '1');
  const enemy = enemyAttack(card);
  await field(enemy, '방어자 수치').fill('30');
  await field(enemy, '공격자 D100').fill('85');
  await field(enemy, '방어자 D100').fill('95');
  const incoming = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await expect(field(incoming, '확정 피해량')).toHaveValue('1');
  await field(incoming, '현재 Toughness').fill('3');
  await expect(incoming.getByRole('region', { name: 'PC 피해 적용' }).locator('dd')).toHaveText(['−1', '0']);
});

test('in play, the enemy shortcut starts from its action roll and the attack carries its damage type', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Fangvine');
  await combat.getByRole('button', { name: 'Fangvine', exact: true }).click();
  const shortcuts = combat.getByRole('region', { name: '전투 바로가기', exact: true });
  await shortcuts.getByRole('button', { name: 'PC 공격', exact: true }).click();
  await shortcuts.getByRole('button', { name: '적 행동 D6', exact: true }).click();
  const card = combat.getByRole('region', { name: '전투 카드' });
  const actionRoll = card.getByRole('textbox', { name: '직접 굴린 값' });
  await expect(actionRoll).toBeFocused();
  await actionRoll.fill('3');
  await card.getByRole('button', { name: '확인', exact: true }).click();
  const attack = enemyAttack(card);
  await expect(attack.locator('.creature-attack-line')).toContainText('Thorned Assault · D6 Piercing');
  await field(attack, '방어자 수치').fill('50');
  await field(attack, '공격자 D100').fill('31');
  await field(attack, '방어자 D100').fill('79');
  await enterRoll(card.getByRole('region', { name: 'PC 명중 부위' }), '10');
  const damage = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await enterRoll(damage.getByRole('group', { name: /Thorned Assault 피해/ }), '4');
  await field(damage, '대상 부위 Armor').fill('0');
  await field(damage, '현재 Toughness').fill('2');
  await expect(damage.getByRole('region', { name: 'PC 피해 적용' }).locator('dd')).toHaveText(['−2', '−2']);
  // Nothing to confirm or record: the result is the whole step.
  await expect(card.getByRole('button', { name: /공격 교환 확정|피해 기록|다음 공격/ })).toHaveCount(0);
});

test('a Magical bolt reads as a Spellward check and rolls its Level Adaptation dice after a failure', async ({ page }) => {
  await page.goto('/ref/cr-vaelorian-magus');
  const card = page.getByRole('region', { name: '전투 카드' });
  await card.getByLabel('PC 레벨').fill('7');
  await enterRoll(card, '1');
  await expect(card.getByRole('status').first()).toContainText('대상이 Spellward에 실패하면 D6 Necrotic 피해를 받는다');
  await expect(card.getByRole('status').first()).not.toContainText('명중');
  await expect(enemyAttack(card)).toHaveCount(0);
  const followUp = card.locator('.creature-action-resolution');
  await expect(followUp).toContainText('피해에 레벨 적응 +D6 포함');
  const check = followUp.getByRole('group', { name: 'Spellward 판정', exact: true });
  await check.getByLabel('Spellward 수치', { exact: true }).fill('40');
  const roll = check.getByLabel('직접 굴린 D100', { exact: true });
  await roll.fill('83');
  await roll.press('Enter');
  const damage = followUp.getByRole('group', { name: 'Necrotic 피해 D6+D6', exact: true });
  await damage.getByLabel('직접 굴린 값').fill('2 5');
  await damage.getByRole('button', { name: '확인', exact: true }).click();
  await expect(damage.getByRole('status')).toContainText('Necrotic 피해 5');

  // A Spellward critical failure doubles the spell's damage.
  await roll.fill('88');
  await roll.press('Enter');
  await expect(followUp).toContainText('대실패 · 피해 2배');
  const doubled = followUp.getByRole('group', { name: 'Necrotic 피해 D6+D6', exact: true });
  await doubled.getByLabel('직접 굴린 값').fill('2 5');
  await doubled.getByRole('button', { name: '확인', exact: true }).click();
  await expect(doubled.getByRole('status')).toContainText('Necrotic 피해 10 (대실패 2배)');
});

test('Razorjaw follows a Prone pounce with its bite attack', async ({ page }) => {
  await page.goto('/ref/cr-razorjaw');
  const card = page.getByRole('region', { name: '전투 카드' });
  await enterRoll(card, '5');
  await expect(enemyAttack(card).locator('.creature-attack-line')).toContainText('Savage Pounce · Prone이 된 대상에게 자유 행동 물기 · D4 Piercing');
});
