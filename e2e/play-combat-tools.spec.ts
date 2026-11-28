import { expect, test, type Locator } from '@playwright/test';
import { openPane } from './helpers/play-desk';
import { choose } from './helpers/choice';

async function selectCreature(combat: Locator, name: string) {
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill(name);
  await combat.getByRole('button', { name, exact: true }).click();
}

test('compares one damage type across the current lineup and remembers the selection', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await selectCreature(combat, 'Umbra Fiend');
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await combat.getByRole('button', { name: '다른 생물 추가' }).click();
  await combat.getByRole('searchbox', { name: '추가할 생물 이름' }).fill('Infernal Tormentor');
  await combat.getByRole('button', { name: 'Infernal Tormentor', exact: true }).click();
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  await openPane(combat, '피해 비교');

  const panel = combat.getByRole('region', { name: '조우 피해 유형 비교' });
  const type = panel.getByRole('combobox', { name: '비교할 피해 유형' });
  const first = panel.getByRole('row', { name: /Umbra Fiend 1/ });
  const duplicate = panel.getByRole('row', { name: /Umbra Fiend 2/ });
  const tormentor = panel.getByRole('row', { name: /Infernal Tormentor 1/ });
  const secondTormentor = panel.getByRole('row', { name: /Infernal Tormentor 2/ });
  await expect(first).toContainText('저항');
  await expect(duplicate).toContainText('저항');
  await panel.getByRole('checkbox', { name: '마법 피해' }).check();
  await expect(first).toContainText('보통 피해');

  await type.selectOption('Holy');
  await expect(tormentor).toContainText('취약 · 피해 ×2');
  await type.selectOption('Infernal');
  await expect(tormentor).toContainText('적용량만큼 회복');
  await type.selectOption('Fire');
  await tormentor.getByText('임시 효과', { exact: true }).click();
  await tormentor.getByRole('checkbox', { name: /Infernal Shapechange/ }).check();
  await expect(tormentor).toContainText('면역 · 피해 0');
  await expect(secondTormentor).toContainText('보통 피해');
  await type.selectOption('Poison');
  await expect(first).toContainText('보통 피해');
  await expect(first).toContainText('중독 상태 면역');

  await page.reload();
  await expect(type).toHaveValue('Poison');
  await expect(duplicate).toContainText('중독 상태 면역');
  await type.selectOption('Fire');
  await expect(tormentor).toContainText('면역 · 피해 0');
  for (const width of [320, 3440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(panel.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
