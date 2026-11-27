import { expect, test, type Locator, type Page } from '@playwright/test';
import { choose } from './helpers/choice';

const button = (scope: Locator | Page, name: string) => scope.getByRole('button', { name, exact: true });
const input = (scope: Locator, name: string) => scope.getByRole('textbox', { name, exact: true });

async function stage(page: Page, name: string) {
  await button(page.getByRole('navigation', { name: '플레이 단계' }), name).click();
}

async function roll(scope: Locator, value: string) {
  const field = input(scope, '직접 굴린 값');
  await field.fill(value);
  await field.press('Enter');
}

async function necropede(page: Page) {
  await stage(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('Necropede');
  await button(combat, 'Necropede').click();
  return combat;
}

test('manual damage keeps its target and location through another attack and lets a paper receipt be corrected', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 880 });
  await page.goto('/play');
  const combat = await necropede(page);
  const card = combat.getByRole('region', { name: '전투 카드' });
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await button(card, '공격 판정').click();
  await input(attack, '공격자 수치').fill('55');
  await input(attack, '공격자 D100').fill('12');
  await input(attack, '방어자 D100').fill('90');
  await button(attack, '적 명중 부위 보기').click();
  const hit = card.getByRole('region', { name: '표 굴리기', exact: true });
  await roll(hit, '4');
  await button(card, '이 부위로 피해 계산').click();
  const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
  await input(damage, '선택 주사위').fill('6');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await button(damage, '피해 기록').click();
  await expect(button(damage, '피해 기록됨')).toBeDisabled();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await stage(page, '저널');
  const paper = journal.getByRole('group', { name: '종이 시트에 반영' });
  const first = paper.getByRole('checkbox', { name: /^Necropede · .+ · 피해 6 Piercing$/ });
  await expect(first).toBeVisible();
  await first.check();

  await stage(page, '조우·전투');
  await input(damage, '선택 주사위').fill('7');
  await button(damage, '피해 기록 수정').click();
  await stage(page, '저널');
  const correction = journal.getByRole('region', { name: '종이 시트 정정표' });
  await expect(correction).toContainText('피해 6 Piercing');
  await expect(correction).toContainText('피해 7 Piercing');
  await button(page, '직전 굴림 되돌리기').click();
  await expect(first).toBeChecked();
  await expect(correction).toHaveCount(0);

  await stage(page, '조우·전투');
  await button(card, '공격 판정').click();
  await button(attack, '적 명중 부위 보기').click();
  await expect(button(card, '이 부위로 피해 계산')).toBeVisible();
  await button(card, '공격 판정').click();
  await button(attack, '다음 공격').click();
  await button(card, '피해 계산').click();
  await button(card.getByRole('group', { name: '피해를 받는 쪽' }), 'PC').click();
  const incoming = card.getByRole('region', { name: 'PC 받는 피해 계산기' });
  await button(incoming, '확정 피해').click();
  await input(incoming, '확정 피해량').fill('5');
  await incoming.getByRole('combobox', { name: '피해 유형 (선택)' }).selectOption('Poison');
  await input(incoming, '현재 Toughness').fill('3');
  await button(incoming, '피해 기록').click();
  await stage(page, '저널');
  await expect(first).toBeChecked();
  await expect(paper.getByRole('checkbox', { name: 'Necropede → PC · 피해 5 Poison · Toughness −3 · Health −2' })).toBeVisible();
  await page.reload();
  await expect(journal).toContainText('Toughness −3 · Health −2');
  await expect(first).toBeChecked();
});

test('a completed fight shows exactly which rewards change before saving the correction', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/play');
  const combat = await necropede(page);
  await button(combat, '승리 후 전투 마치기').click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await button(wrap.getByRole('group', { name: '정리할 항목' }), '전리품').click();
  await roll(wrap.getByRole('group', { name: '자원 D10', exact: true }), '7');
  await stage(page, '저널');
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  const xp = journal.getByRole('checkbox', { name: 'XP +50 (승리)', exact: true });
  await xp.check();

  await stage(page, '조우·전투');
  await expect(button(combat, '전투만 마치기')).toHaveCount(0);
  await expect(button(combat, '조우 다시 선택')).toHaveCount(0);
  const edit = button(combat, '전투 결과 수정');
  const preview = combat.getByRole('region', { name: '전투 결과 수정 미리보기' });
  await edit.click();
  await expect(preview).toContainText('50 → 0');
  await expect(preview).toContainText('XP +50 (승리) · 이미 반영됨');
  await expect(preview).toContainText('Crafting Supplies +1');
  await button(preview, '취소').click();
  await expect(edit).toBeFocused();
  await stage(page, '저널');
  await expect(xp).toBeChecked();
  await expect(journal).toContainText('Crafting Supplies 1');

  await stage(page, '조우·전투');
  await edit.click();
  await button(preview, '결과 수정 확정').click();
  await stage(page, '저널');
  await expect(journal).toContainText('Necropede · 전투 종료');
  await expect(journal).not.toContainText('Crafting Supplies 1');
  await expect(journal.getByRole('region', { name: '종이 시트 정정표' })).toContainText('XP +50 (승리)');
  await expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await button(page, '직전 굴림 되돌리기').click();
  await expect(xp).toBeChecked();
  await expect(journal).toContainText('Crafting Supplies 1');
});
