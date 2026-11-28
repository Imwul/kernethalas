import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDrawer, openDrawer } from './helpers/play-desk';
import { choose } from './helpers/choice';

const button = (scope: Locator | Page, name: string | RegExp) => scope.getByRole('button', { name, exact: true });
const textbox = (scope: Locator, name: string) => scope.getByRole('textbox', { name, exact: true });

async function physical(scope: Locator, value: string) {
  const input = textbox(scope, '직접 굴린 값');
  await input.fill(value);
  await input.press('Enter');
}

async function selectCreature(page: Page, name: string) {
  await button(page.getByRole('navigation', { name: '플레이 단계' }), '조우·전투').click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill(name);
  await button(combat, name).click();
  return { combat, card: combat.getByRole('region', { name: '전투 카드' }) };
}

test('a PC base attack gets one +10 and a pre-update manually adjusted score stays adjusted', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto('/play');
  const sheet = await openDrawer(page, '캐릭터');
  await button(sheet.getByRole('group', { name: '공격 무기' }), 'Bladed').click();
  await textbox(sheet, 'Bladed Weapons 수치').fill('55');
  await closeDrawer(page);
  const { card } = await selectCreature(page, 'Astral Beast');
  await button(card, 'PC 공격').click();
  const check = card.getByRole('region', { name: '공격 판정 해석기' });
  const skill = textbox(check, '공격자 수치');
  const adjusted = check.getByRole('checkbox', { name: '공격 기본 +10이 이미 포함된 수치' });
  const result = check.getByRole('status', { name: '공격 판정 결과' });
  await expect(skill).toHaveValue('55');
  await expect(check.getByLabel('공격자 계산 수치')).toHaveText('공격자 기본 55 · 공격 기본 +10 = 65');
  await textbox(check, '공격자 D100').fill('61');
  await textbox(check, '방어자 D100').fill('91');
  await expect(result).toContainText('공격자 명중');
  await adjusted.check();
  await expect(result).toContainText('양쪽 실패');
  await skill.fill('54');
  await skill.fill('55');
  await page.evaluate(() => {
    const key = 'kn-play-room-v1';
    const save = JSON.parse(localStorage.getItem(key) ?? '{}');
    for (const [name, sides] of Object.entries(save.slots) as [string, { 'pc-attack'?: { attackSkillKind?: string } }][]) {
      if (name.endsWith('/attack-inputs') && sides['pc-attack']) delete sides['pc-attack'].attackSkillKind;
    }
    localStorage.setItem(key, JSON.stringify(save));
  });
  await page.reload();
  await expect(adjusted).toBeChecked();
  await expect(result).toContainText('양쪽 실패');
  await adjusted.uncheck();
  await expect(result).toContainText('공격자 명중');
});

test('a defense and a fumble each get one D10 right under the attack, with undo', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const { card } = await selectCreature(page, 'Necropede');
  await physical(card, '1');
  const check = card.getByRole('region', { name: '적 공격' }).getByRole('region', { name: '공격 판정 해석기' });
  await expect(check).toContainText('CS 50 + 공격 기본 10');
  await textbox(check, '공격자 D100').fill('77');
  await textbox(check, '방어자 수치').fill('42');
  await textbox(check, '방어자 D100').fill('12');
  const defense = check.getByRole('group', { name: 'PC 방어 동작 D10', exact: true });
  const fumble = check.getByRole('group', { name: '적 공격자 펌블 D10', exact: true });
  await physical(defense, '1');
  await expect(defense.getByRole('status')).toContainText('다음 공격 판정에 +10');
  await expect(textbox(defense, '직접 굴린 값')).toHaveCount(0);

  await button(page, '직전 굴림 되돌리기').click();
  await expect(textbox(defense, '직접 굴린 값')).toBeVisible();
  await physical(defense, '1');
  await button(fumble, 'D10 굴리기').click();
  await expect(fumble.getByRole('status')).toBeVisible();
  await expect(textbox(fumble, '직접 굴린 값')).toHaveCount(0);
  // Nothing waits in a ledger: the D10 result is applied at the table.
  await expect(card.getByRole('region', { name: '처리 대기 중인 전투 효과' })).toHaveCount(0);
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('area checks use the player sheet only for the designated PC and keep each role on reload', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 850 });
  await page.goto('/play');
  const drawer = await openDrawer(page, '캐릭터');
  await textbox(drawer, 'Spellward 수치').fill('55');
  await button(drawer.getByRole('group', { name: '캐릭터 항목' }), /^상태/).click();
  await textbox(drawer, '현재 Exhaustion').fill('17');
  await closeDrawer(page);

  const { card } = await selectCreature(page, 'Astral Beast');
  await physical(card.getByRole('region', { name: '표 굴리기', exact: true }), '5');
  await button(card, '여러 대상 판정').click();
  await textbox(card, '대상 이름 (한 줄에 하나씩)').fill('PC\nMinion');
  await button(card, '대상 목록 적용').click();
  const pc = card.getByRole('region', { name: 'PC 판정과 효과' });
  const minion = card.getByRole('region', { name: 'Minion 판정과 효과' });
  await expect(textbox(pc, 'Spellward 수치')).toHaveValue('55');
  await expect(button(pc, '불리 (Disadvantage)')).toHaveAttribute('aria-pressed', 'true');
  await expect(textbox(minion, 'Spellward 수치')).toHaveValue('');
  await expect(button(minion, '불리 (Disadvantage)')).toHaveAttribute('aria-pressed', 'false');
  const role = minion.getByRole('combobox', { name: 'Minion 역할' });
  await role.selectOption('minion');
  await textbox(minion, 'Spellward 수치').fill('40');
  await textbox(minion, '직접 굴린 D100').fill('22');
  await textbox(minion, '직접 굴린 D100').press('Enter');
  await expect(minion).toContainText('피해 절반');
  await page.reload();
  await expect(role).toHaveValue('minion');
  await expect(minion).toContainText('피해 절반');
  await expect(textbox(pc, 'Spellward 수치')).toHaveValue('55');
});
