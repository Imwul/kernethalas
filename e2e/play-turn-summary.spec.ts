import { expect, test } from '@playwright/test';
import { closeDrawer } from './helpers/play-desk';
import { choose } from './helpers/choice';

test('a fight keeps round actions and opens target-specific tactics from one place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const key = 'kn-play-room-v1';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ slots: { pcCharacter: {
      name: 'Dusk', level: 1, masteries: [{ id: 'm-flamecaster', tier: 1 }, { id: 'm-arcanist', tier: 2 }],
      goals: [{ name: 'Botanical Exterminator', progress: 6 }],
    } } }));
    const gear = 'kn-play-gear-v1';
    if (!localStorage.getItem(gear)) localStorage.setItem(gear, JSON.stringify({ entries: [], items: [{
      id: 'test-bandage', name: 'Bandage', count: 2, location: 'belt', weight: 'light',
    }] }));
  });
  await page.goto('/play');
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Fangvine');
  await combat.getByRole('button', { name: 'Fangvine', exact: true }).click();
  const summary = combat.getByRole('region', { name: '현재 전투 턴', exact: true });
  const status = summary.getByRole('status');
  await expect(status).toContainText('1라운드');
  await expect(summary.getByRole('link', { name: '다음 반응 0' })).toBeVisible();
  await expect(summary).toContainText('Botanical Exterminator 6/50 · 처치 시 +1');
  const fire = summary.getByRole('button', { name: /^Fire Bolt/ });
  await expect(fire).toContainText('Fangvine 취약 · 피해 ×2');
  await expect(summary.getByRole('button', { name: /^Flame Spray/ })).toHaveCount(0);
  await fire.click();
  await expect(combat.getByRole('region', { name: 'PC Mastery 능력' }).getByRole('button', { name: 'Fire Bolt', exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
  await combat.getByRole('button', { name: '같은 생물 추가' }).click();
  const spellTarget = combat.getByRole('combobox', { name: '능력 대상', exact: true });
  await spellTarget.selectOption({ label: 'Fangvine 1' });
  await fire.click();
  await expect(spellTarget.locator('option:checked')).toHaveText('Fangvine 2');

  await summary.getByRole('button', { name: 'PC 공격 입력' }).click();
  await expect(combat.getByRole('textbox', { name: '공격자 D100', exact: true })).toBeFocused();
  await expect(combat.getByRole('button', { name: 'PC가 공격', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await summary.getByRole('button', { name: '벨트 확인 (1)', exact: true }).click();
  await expect(page.locator('#play-drawer')).toContainText('Bandage');
  await closeDrawer(page);

  await summary.getByRole('button', { name: 'PC 턴 시작', exact: true }).click();
  await summary.getByRole('checkbox', { name: '표준 행동 사용' }).check();
  await summary.getByRole('checkbox', { name: '자유 행동 사용' }).check();
  await summary.getByRole('button', { name: '반응 +1', exact: true }).click();
  await summary.getByRole('button', { name: 'PC 턴 종료', exact: true }).click();
  await page.reload();
  await expect(status).toContainText('PC 턴 종료');
  await expect(summary.getByRole('checkbox', { name: '표준 행동 사용' })).toBeChecked();
  await expect(summary.getByRole('link', { name: '다음 반응 −20' })).toBeVisible();
  await summary.getByRole('button', { name: '턴·라운드 열기' }).click();
  const rounds = combat.getByRole('region', { name: '전투 턴·라운드 체크판' });
  await rounds.getByRole('combobox', { name: '턴을 확인할 대상' }).selectOption({ label: 'Fangvine 2' });
  await rounds.getByRole('button', { name: '턴 시작', exact: true }).click();
  await expect(status).toContainText('Fangvine 2 턴 진행 중');
  await expect(summary.getByRole('button', { name: /^Magic Shell/ })).toBeVisible();
  await expect(fire).toHaveCount(0);
  await rounds.getByRole('button', { name: '다음 라운드', exact: true }).click();
  await expect(status).toContainText('2라운드');
  await expect(summary.getByRole('link', { name: '다음 반응 0' })).toBeVisible();
  await expect(summary.getByRole('checkbox', { name: '표준 행동 사용' })).not.toBeChecked();
  await expect(summary.getByRole('checkbox', { name: '자유 행동 사용' })).not.toBeChecked();
  await summary.getByRole('button', { name: '전투 도주 열기' }).click();
  await expect(combat.getByRole('region', { name: '전투 도주' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
