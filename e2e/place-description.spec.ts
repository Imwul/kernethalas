import { expect, test } from '@playwright/test';

test('room and corridor descriptions use separate rolls and persist in the journal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  const journal = page.getByRole('region', { name: '이번 장소 기록' });

  const openDescription = async (place: '방' | '통로') => {
    await exploration.getByRole('button', { name: place, exact: true }).click();
    const summary = exploration.getByText(`${place} 환경 묘사`, { exact: true });
    if ((await summary.locator('..').getAttribute('open')) === null) await summary.click();
    return exploration.getByRole('region', { name: `${place} 환경 묘사 굴림`, exact: true });
  };

  const rollDescription = async (place: '방' | '통로', result: string, cue: string) => {
    const roller = await openDescription(place);
    const input = roller.getByRole('textbox', { name: '직접 굴린 값' });
    await input.fill(result);
    await input.press('Enter');
    await expect(roller.getByRole('status')).toContainText(cue);
  };

  await rollDescription('방', '00', '유령 같은 불꽃이 연료도 없이');
  await stages.getByRole('button', { name: '저널', exact: true }).click();
  await expect(journal).toContainText('환경 묘사 방 · 유령 같은 불꽃');

  await stages.getByRole('button', { name: '탐험', exact: true }).click();
  await rollDescription('통로', '3', '헤집어진 매장 벽감');
  await stages.getByRole('button', { name: '저널', exact: true }).click();
  await expect(journal).toContainText('환경 묘사 통로 · 한 사람이 겨우 지날 만한 길');
  await expect(journal).not.toContainText('유령 같은 불꽃');
  await page.reload();
  await expect(journal).toContainText('헤집어진 매장 벽감');

  await stages.getByRole('button', { name: '탐험', exact: true }).click();
  const room = await openDescription('방');
  await expect(room.getByRole('status')).toContainText('유령 같은 불꽃');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
