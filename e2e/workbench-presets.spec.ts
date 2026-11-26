import { expect, test } from '@playwright/test';

test('workbench presets add live tools to the 3440px dock and keep open panes', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/ref/prone');
  await page.getByRole('main').getByRole('button', { name: '작업대에 펼치기' }).click();
  const dock = page.getByRole('complementary', { name: '작업대 도크' });
  const presets = dock.getByRole('group', { name: '작업대 프리셋' });
  const combat = presets.getByRole('button', { name: '전투 프리셋 펼치기' });
  await combat.click();
  const attack = dock.getByRole('region', { name: '공격 판정 해결', exact: true });
  const skill = attack.locator('.checkcalc input').first();
  await skill.fill('75');
  await expect(dock.getByRole('region', { name: '상태 이상 개요', exact: true })).toBeVisible();

  await presets.getByRole('button', { name: '탐험 프리셋 펼치기' }).click();
  const shape = dock.getByRole('region', { name: '방 · 통로 모양', exact: true });
  await expect(shape).toBeVisible();
  await expect.poll(() => shape.locator('.pane-body').evaluate((body) => body.scrollHeight - body.clientHeight)).toBeGreaterThan(0);
  await expect(dock.getByRole('region', { name: '전투 조우 — 표 선택', exact: true })).toBeVisible();
  const tension = dock.getByRole('region', { name: 'Tension Die 처리', exact: true });
  await expect(tension.getByRole('button', { name: 'D6 굴리기' })).toBeVisible();
  await expect(dock.getByRole('region', { name: '넘어짐', exact: true })).toBeVisible();

  await combat.click();
  await expect(dock.locator('.dock-panes > .pane')).toHaveCount(6);
  await expect(skill).toHaveValue('75');
});

test('a preset that cannot fit leaves the mobile workbench intact', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const open = ['prone', 'blinded', 'bleeding', 'burning', 'poisoned', 'frightened', 'dazed'];
  await page.addInitScript((openIds) => {
    localStorage.setItem('kn-ossuary-nav-v1', JSON.stringify({ open: openIds, active: openIds[0] }));
  }, open);
  await page.goto('/workbench');
  const combat = page.getByRole('button', { name: '전투 프리셋 펼치기' });
  const panes = page.locator('.bench-cols > .pane');
  const originalNames = await panes.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')));
  expect(originalNames).toHaveLength(7);
  await combat.click();
  await expect(page.locator('.bench-preset-feedback')).toContainText('빈자리가 1개 더 필요합니다');
  expect(await panes.evaluateAll((elements) => elements.map((element) => element.getAttribute('aria-label')))).toEqual(originalNames);

  await panes.first().getByRole('button', { name: '넘어짐 닫기' }).click();
  await combat.click();
  await expect(panes).toHaveCount(8);
  await expect(page.getByRole('region', { name: '공격 판정 해결', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: '상태 이상 개요', exact: true })).toBeVisible();
});

test('a named workbench set restores the saved mobile tab and keeps live common panes mounted', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/workbench');
  await page.getByRole('button', { name: '탐험 프리셋 펼치기', exact: true }).click();
  await page.getByRole('button', { name: '탭', exact: true }).click();
  const tabs = page.getByRole('tablist', { name: '펼친 항목' });
  const shape = tabs.getByRole('tab', { name: '방 · 통로 모양', exact: true });
  await shape.click();
  const body = page.getByRole('tabpanel', { name: '방 · 통로 모양', exact: true });
  const input = body.getByRole('textbox', { name: '직접 굴린 값', exact: true });
  await input.fill('29');
  await input.press('Enter');
  await expect(body.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' })).toBeVisible();
  await shape.focus();
  await shape.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Tension Die 처리', exact: true })).toBeFocused();
  await expect(body).toBeHidden();
  await shape.click();
  await expect(body.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' })).toBeVisible();

  const sets = page.locator('.bench-saved');
  await sets.getByText('내 작업대 세트', { exact: true }).click();
  await sets.getByRole('textbox', { name: '작업대 세트 이름' }).fill('탐험 필수');
  await sets.getByRole('button', { name: '현재 배치 저장', exact: true }).click();

  await page.getByRole('button', { name: '나란히', exact: true }).click();
  await page.getByRole('button', { name: '전투 프리셋 펼치기', exact: true }).click();
  const restore = sets.getByRole('button', { name: '탐험 필수 세트 열기', exact: true });
  await restore.click();
  await expect(sets.getByText('현재 항목 2개를 닫고 이 세트를 엽니다.')).toBeVisible();
  await sets.getByRole('button', { name: '배치 바꾸기', exact: true }).click();
  await expect(shape).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab')).toHaveCount(3);
  await expect(body.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.reload();
  await sets.getByText('내 작업대 세트', { exact: true }).click();
  await restore.click();
  await expect(shape).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab')).toHaveCount(3);
});

test('a full workbench leaves existing panes in place from reference and search', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  const ids = ['prone', 'blinded', 'bleeding', 'burning', 'poisoned', 'frightened', 'dazed', 'stunned'];
  await page.addInitScript((open) => {
    localStorage.setItem('kn-ossuary-nav-v1', JSON.stringify({ open, active: open[0] }));
  }, ids);
  await page.goto('/ref/locks-traps');
  const dock = page.getByRole('complementary', { name: '작업대 도크' });
  const panes = dock.locator('.dock-panes > .pane');
  await expect(panes).toHaveCount(8);
  const firstEight = await panes.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')));
  const main = page.getByRole('main');
  await main.getByRole('button', { name: '작업대에 펼치기' }).click();
  await expect(main.getByRole('alert')).toContainText('작업대가 8칸 찼습니다.');

  await page.getByRole('button', { name: '검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '규칙 검색' });
  const query = search.getByRole('searchbox');
  await query.fill('Infernal Archon');
  await query.press('Shift+Enter');
  await expect(search.getByRole('alert')).toContainText('작업대가 8칸 찼습니다.');
  await query.press('Escape');
  expect(await panes.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))).toEqual(firstEight);
});

test('a workbench roll follows the page link and survives browser Back in its active tab', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/workbench');
  await page.getByRole('button', { name: '탐험 프리셋 펼치기' }).click();
  await page.getByRole('button', { name: '탭', exact: true }).click();
  const name = '방 · 통로 모양';
  const tab = page.getByRole('tab', { name, exact: true });
  await tab.click();
  const pane = page.getByRole('tabpanel', { name, exact: true });
  const input = pane.getByRole('textbox', { name: '직접 굴린 값' });
  await input.fill('29');
  await input.press('Enter');
  const rolledShape = { name: '29번 방 모양 예시 · 출입구 8개' };
  await expect(pane.locator('.oracle-result').getByRole('img', rolledShape)).toBeVisible();
  await pane.getByRole('link', { name, exact: true }).click();
  await expect(page).toHaveURL('/oracle/t-room-shape?r=29&view=one');
  await expect(page.locator('main .oracle-result').getByRole('img', rolledShape)).toBeVisible();

  await page.goBack();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(pane.locator('.oracle-result').getByRole('img', rolledShape)).toBeVisible();
  await page.getByRole('tablist').getByRole('button', { name: `${name} 닫기` }).press('Enter');
  await expect(page.getByRole('tab', { name: 'Tension Die 처리' })).toBeFocused();
});

test('a workbench ruling includes the comparison matrix, exceptions, and roll tables', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '규칙 검색' });
  await search.getByRole('searchbox').fill('둘 다 실패');
  const title = '공격자와 방어자가 모두 판정에 실패하면?';
  await search.getByRole('button', { name: new RegExp(title.slice(0, -1)) }).click();
  const preview = page.getByRole('dialog', { name: title });
  await preview.getByRole('button', { name: '작업대에 펼치기' }).click();
  await preview.getByRole('button', { name: '참고 패널 닫기' }).click();
  await page.locator('.tabbar a[href="/workbench"]').click();
  const pane = page.getByRole('region', { name: title });
  await expect(pane.getByRole('table')).toBeVisible();
  await expect(pane.getByText('예외', { exact: true })).toBeVisible();
  await expect(pane.locator('.preview-links a[href^="/oracle/"]')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
