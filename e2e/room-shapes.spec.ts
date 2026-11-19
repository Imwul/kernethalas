import { expect, test } from '@playwright/test';

test('room and corridor results have diagrams in the roller and the full table', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/oracle/t-room-shape?r=3&view=one');

  const roller = page.getByRole('region', { name: '표 굴리기' });
  const corridor = roller.getByRole('img', { name: '3번 통로 모양 예시 · 출입구 1개' });
  await expect(corridor.locator('line')).toHaveCount(1);
  await expect(roller.getByText('출입구 배치 예시', { exact: true })).toBeVisible();

  const manual = roller.getByRole('textbox', { name: '직접 굴린 값' });
  await manual.fill('29');
  await manual.press('Enter');
  const room = roller.getByRole('img', { name: '29번 방 모양 예시 · 출입구 8개' });
  await expect(room.locator('line')).toHaveCount(8);
  await expect(corridor).toHaveCount(0);

  await roller.getByRole('button', { name: '전체 표', exact: true }).click();
  const table = page.getByRole('table', { name: /Room & Corridor Shape/ });
  await expect(table.getByRole('img')).toHaveCount(100);
  await expect(table.locator('tr[aria-current="true"]').getByRole('img')).toHaveAccessibleName('29번 방 모양 예시 · 출입구 8개');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('play mode shows the same schematic for physical room shape rolls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/play');
  const shape = page.getByRole('region', { name: '방·통로 모양', exact: true });
  const manual = shape.getByRole('textbox', { name: '직접 굴린 값' });
  await manual.fill('00');
  await manual.press('Enter');
  await expect(shape.getByRole('img', { name: '100번 방 모양 예시 · 출입구 3개' })).toBeVisible();
});

test('corridor bends and branch hubs have continuous floor and walls on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const shape = page.getByRole('region', { name: '방·통로 모양', exact: true });
  const manual = shape.getByRole('textbox', { name: '직접 굴린 값' });

  for (const [roll, exits] of [[1, 2], [7, 6]]) {
    await manual.fill(String(roll));
    await manual.press('Enter');
    const diagram = shape.getByRole('img', { name: `${roll}번 통로 모양 예시 · 출입구 ${exits}개` });
    await expect(diagram.locator('.room-shape-exit')).toHaveCount(exits);

    const gaps = await diagram.evaluate((element: SVGSVGElement) => {
      const { x, y, width, height } = element.viewBox.baseVal;
      const cx = x + width / 2;
      const cy = y + height / 2;
      const gaps: string[] = [];
      for (const [layer, radius] of [['outline', 5.75], ['passage', 4.5]] as const) {
        const geometry = Array.from(element.querySelectorAll<SVGGeometryElement>(`[class^="room-shape-${layer}"]`))
          .map((part) => {
            const { fill, stroke } = getComputedStyle(part);
            return { part, fill, stroke };
          });
        // Sample just inside each painted layer, including the outside of the 01 elbow.
        for (let degrees = 0; degrees < 360; degrees += 15) {
          const angle = degrees * Math.PI / 180;
          const point = new DOMPoint(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
          const painted = geometry.some(({ part, fill, stroke }) =>
            (fill !== 'none' && part.isPointInFill(point)) || (stroke !== 'none' && part.isPointInStroke(point)));
          if (!painted) gaps.push(`${layer} at ${degrees}°`);
        }
      }
      return gaps;
    });
    expect(gaps, `${roll}번 통로 접합부`).toEqual([]);
  }
});
