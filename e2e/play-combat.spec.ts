import { expect, test } from '@playwright/test';
import { choose, chosen } from './helpers/choice';

test('play combat accepts a physical Overseer roll and supports Korean creature search', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: /조우·전투/ }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 't-overseer');
  const overseer = combat.getByRole('textbox', { name: 'D10 결과' });
  await overseer.fill('11');
  await overseer.press('Enter');
  await expect(combat.getByRole('alert')).toContainText('1에서 10 사이');
  await expect(combat.getByRole('region', { name: '전투 카드' })).toHaveCount(0);

  await overseer.fill('5');
  await choose(combat, '조우 방식', 't-encounter-b');
  await expect(combat.getByRole('textbox', { name: 'D20 결과' })).toHaveValue('');
  await choose(combat, '조우 방식', 't-overseer');
  await expect(overseer).toHaveValue('5');
  await page.reload();
  await expect(overseer).toHaveValue('5');
  await expect(combat.getByRole('region', { name: '전투 카드' })).toHaveCount(0);
  await overseer.press('Enter');
  const heading = combat.getByRole('heading', { name: 'Infernal Archon' });
  await expect(heading).toBeFocused();
  await expect(combat.getByText('Overseer D10 5')).toBeVisible();
  await expect(combat.getByRole('region', { name: '전투 카드' })).toBeVisible();
  await expect(combat.getByRole('button', { name: '승리 후 전투 마치기' })).toBeVisible();
  await expect(combat.getByRole('button', { name: '전투만 마치기' })).toBeVisible();

  await combat.getByRole('button', { name: '조우 다시 선택' }).click();
  await expect(chosen(combat, '조우 방식')).toBeFocused();
  await expect(overseer).toHaveValue('');
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('네크로피드');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  await expect(combat.getByRole('heading', { name: 'Necropede' })).toBeVisible();
  await expect(page).toHaveURL(/\/play$/);
});

test('duplicate combat targets keep separate action and damage rolls through switching and reload', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('네크로피드');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();

  const card = combat.getByRole('region', { name: '전투 카드' });
  const actionResult = card.locator('.oracle-result').first();
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill('1');
  await card.getByRole('textbox', { name: '직접 굴린 값' }).press('Enter');
  await expect(actionResult).toContainText('Bone Slam');
  await card.getByRole('button', { name: 'PC 공격', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await attack.getByRole('group', { name: '방어 방식' }).getByRole('button', { name: '자동 명중 · 굴림 없음' }).click();
  const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
  await damage.getByRole('textbox', { name: '대상 부위 Armor' }).fill('0');
  await damage.getByRole('textbox', { name: '선택 주사위' }).fill('6');
  await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 6 Piercing');

  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  const lineup = combat.getByRole('group', { name: '전투 대상', exact: true });
  const first = lineup.getByRole('button', { name: 'Necropede 1', exact: true });
  const second = lineup.getByRole('button', { name: 'Necropede 2', exact: true });
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  await expect(card.getByText('Bone Slam')).toHaveCount(0);
  await card.getByRole('textbox', { name: '직접 굴린 값' }).fill('3');
  await card.getByRole('textbox', { name: '직접 굴린 값' }).press('Enter');
  await expect(actionResult).toContainText('Soul Drain');
  await first.click();
  await expect(damage.getByRole('status')).toHaveText('최종 피해 6 Piercing');

  await page.reload();
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(damage.getByRole('status')).toHaveText('최종 피해 6 Piercing');
  await second.click();
  await expect(actionResult).toContainText('Soul Drain');

  await combat.getByRole('button', { name: '다른 생물 추가' }).click();
  await combat.getByRole('searchbox', { name: '추가할 생물 이름' }).fill('Infernal Archon');
  await combat.getByRole('button', { name: 'Infernal Archon', exact: true }).last().click();
  await expect(combat.getByRole('textbox', { name: '적 최고 Mind' })).toHaveValue('50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('the custom D20 table validates overlaps, allows gaps, and restores saved ranges', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (array instanceof Uint32Array && array.length === 1) {
        array[0] = 0x3000_0000; // D20 → 4.
        return array;
      }
      return getRandomValues(array);
    };
  });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'custom');
  const rangeStart = combat.getByRole('textbox', { name: '시작 D20', exact: true });
  const rangeEnd = combat.getByRole('textbox', { name: '끝 D20 (선택)', exact: true });
  const creatureSearch = combat.getByRole('searchbox', { name: '범위에 연결할 생물', exact: true });
  const rows = combat.getByRole('list', { name: '저장한 조우 범위' });

  await rangeStart.fill('2');
  await rangeEnd.fill('5');
  await creatureSearch.fill('네크로피드');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  await combat.getByRole('button', { name: '범위 추가', exact: true }).click();
  await expect(rows).toContainText('2–5');
  await expect(rows).toContainText('Necropede');

  await rangeStart.fill('5');
  await rangeEnd.fill('7');
  await creatureSearch.fill('Infernal Archon');
  await combat.getByRole('button', { name: 'Infernal Archon', exact: true }).click();
  await combat.getByRole('button', { name: '범위 추가', exact: true }).click();
  await expect(combat.getByRole('alert')).toHaveText('이미 저장한 주사위 범위와 겹칩니다.');
  await expect(rows.getByRole('listitem')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.reload();
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  await expect(chosen(combat, '조우 방식')).toHaveAttribute('data-value', 'custom');
  const roll = combat.getByRole('textbox', { name: 'D20 결과', exact: true });
  await roll.fill('9');
  await roll.press('Enter');
  await expect(combat.getByRole('status')).toContainText('이 범위에 지정한 생물이 없습니다.');
  await expect(combat.getByRole('heading', { name: 'Necropede', exact: true })).toHaveCount(0);
  await roll.fill('3');
  await roll.press('Enter');
  await expect(combat.getByRole('heading', { name: 'Necropede', exact: true })).toBeFocused();
  await expect(combat.getByText('사용자 지정 조우표 D20 3')).toBeVisible();
  await combat.getByRole('button', { name: '조우 다시 선택' }).click();
  await combat.getByRole('button', { name: 'D20 굴리기' }).click();
  await expect(combat.getByText('사용자 지정 조우표 D20 4')).toBeVisible();
});
