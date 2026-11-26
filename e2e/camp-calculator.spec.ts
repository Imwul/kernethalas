import { expect, test } from '@playwright/test';
import { choose } from './helpers/choice';

test('camp uses a cooked Ration, computes reduced recovery and opens the encounter after failure', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const route = '/atlas/p-rest?view=list';
  await page.goto(route);
  const camp = page.getByRole('region', { name: '야영 계산기' });
  await choose(camp, 'Ration', 'missing');
  await camp.getByText('요리 · 제작 · 그 밖의 야영 활동', { exact: true }).click();
  const cooking = camp.getByLabel('요리할 Ration 수');
  await cooking.fill('2');
  await expect(camp.getByText('Cooking Ingredients 2')).toBeVisible();
  await expect(camp.getByText('요리한 Ration 1개 즉시 사용')).toBeVisible();

  const die = camp.getByLabel('직접 굴린 D20');
  const status = camp.getByRole('status');
  const benefits = camp.getByRole('region', { name: '야영 기본 혜택' });
  await die.fill('13');
  await expect(status).toContainText('야영 판정 성공');
  await expect(status).toContainText('D20 13 −1 = 12');
  await expect(benefits.getByRole('heading')).toHaveText('야영 기본 혜택');

  await die.fill('12');
  await expect(status).toContainText('야영 판정 실패');
  await benefits.getByText('회복량 직접 계산', { exact: true }).click();
  await benefits.getByLabel('잃은 Toughness').fill('7');
  await benefits.getByLabel('Sanity D4 결과').fill('3');
  await expect(benefits.getByText('+3', { exact: true })).toBeVisible();
  await expect(benefits.getByText('+1', { exact: true })).toBeVisible();
  await expect(benefits.getByText('−5', { exact: true })).toBeVisible();

  const encounter = camp.getByRole('link', { name: '전투 조우 표 열기' });
  await encounter.click();
  const panel = page.getByRole('dialog', { name: '전투 조우 — 표 선택' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(page).toHaveURL(route);
  await expect(die).toHaveValue('12');
  await expect(encounter).toBeFocused();

  await camp.getByRole('checkbox', { name: '취침 (Sleep)' }).check();
  await expect(cooking).toBeDisabled();
  await die.fill('8');
  await expect(status).toContainText('D20 8 +2 = 10');
  await expect(status).toContainText('두 절반 처리를 어떻게 합치는지는');
  await expect(benefits).toHaveCount(0);
});
