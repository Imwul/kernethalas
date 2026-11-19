import { expect, test, type Page } from '@playwright/test';
import { procedures } from '../src/content/procedures';
import type { Procedure } from '../src/content/schema';

async function expectClearDrawing(page: Page, procedure: Procedure) {
  const drawing = page.locator('.plan-svg');
  const labelCount = procedure.edges.filter(({ label }) => label).length;
  await expect(drawing.locator('.edge-label[data-edge]')).toHaveCount(labelCount);
  await expect(drawing.locator('.edge-label-backplate')).toHaveCount(labelCount);
  await page.evaluate(async () => { await document.fonts.ready; });

  await expect.poll(() => drawing.evaluate((element) => {
    const svg = element as SVGSVGElement;
    const bounds = svg.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left
      && a.top < b.bottom && a.bottom > b.top;
    const contains = (outer: DOMRect, inner: DOMRect) => outer.left <= inner.left && outer.right >= inner.right
      && outer.top <= inner.top && outer.bottom >= inner.bottom;
    const cards = [...svg.querySelectorAll('.node .box')].map((card) => ({
      name: card.parentElement!.getAttribute('aria-label'),
      box: card.getBoundingClientRect(),
    }));
    const labels = [...svg.querySelectorAll<SVGTextElement>('.edge-label[data-edge]')].map((label) => ({
      name: `${label.dataset.edge} (${label.textContent})`,
      text: label.getBoundingClientRect(),
      plate: label.parentElement!.querySelector('.edge-label-backplate')?.getBoundingClientRect(),
      visible: getComputedStyle(label).visibility === 'visible',
    }));
    const paths = [...svg.querySelectorAll<SVGPathElement>('.edge')].map((path) => {
      const matrix = path.getScreenCTM()!;
      const length = path.getTotalLength();
      const halfStroke = parseFloat(getComputedStyle(path).strokeWidth) * Math.hypot(matrix.a, matrix.b) / 2;
      const start = path.getPointAtLength(0).matrixTransform(matrix);
      const segments = [];
      let previous = start;
      for (let distance = 1; distance < length + 1; distance += 1) {
        const point = path.getPointAtLength(Math.min(distance, length)).matrixTransform(matrix);
        segments.push(new DOMRect(
          Math.min(previous.x, point.x) - halfStroke,
          Math.min(previous.y, point.y) - halfStroke,
          Math.abs(previous.x - point.x) + halfStroke * 2,
          Math.abs(previous.y - point.y) + halfStroke * 2,
        ));
        previous = point;
      }
      return { segments, name: path.getAttribute('d') };
    });

    const problems: string[] = [];
    labels.forEach(({ name, text, plate, visible }, index) => {
      if (!visible || !plate || text.width <= 0 || text.height <= 0) {
        problems.push(`${name}: missing visible text or backing plate`);
        return;
      }
      if (!contains(plate, text)) problems.push(`${name}: text extends past backing plate`);
      if (!contains(bounds, plate)) problems.push(`${name}: backing plate extends past drawing`);
      for (const card of cards) {
        if (overlaps(plate, card.box)) problems.push(`${name}: overlaps ${card.name}`);
      }
      for (const other of labels.slice(index + 1)) {
        if (other.plate && overlaps(plate, other.plate)) problems.push(`${name}: overlaps ${other.name}`);
      }
      for (const path of paths) {
        if (path.segments.some((segment) => overlaps(plate, segment))) problems.push(`${name}: overlaps edge ${path.name}`);
      }
    });
    return problems;
  })).toEqual([]);

  const pageWidth = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(pageWidth.content).toBeLessThanOrEqual(pageWidth.viewport);
}

for (const procedure of procedures) {
  test(`${procedure.ko} keeps diagram labels clear at laptop width`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`/atlas/${procedure.id}?view=plan`);
    await expectClearDrawing(page, procedure);
  });
}

for (const viewport of [{ width: 320, height: 800 }, { width: 3440, height: 1440 }]) {
  test(`selected combat edges keep labels clear at ${viewport.width}px`, async ({ page }) => {
    const combat = procedures.find(({ id }) => id === 'p-combat-round')!;
    await page.setViewportSize(viewport);
    await page.goto(`/atlas/${combat.id}?view=plan&node=init`);
    await expect(page.getByRole('button', { name: '판정: Initiative', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.plan-svg .edge.atlas-edge-selected').first()).toBeAttached();
    await expectClearDrawing(page, combat);
  });
}
