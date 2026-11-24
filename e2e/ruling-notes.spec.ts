import { expect, test, type Locator } from '@playwright/test';

async function openNote(panel: Locator) {
  // The note sits on one line under the header; there is nothing to unfold.
  return panel.locator('.ruling-note:not(.ruling-notes-index)');
}

async function addNote(note: Locator, text: string) {
  await note.getByRole('button', { name: '메모 쓰기', exact: true }).click();
  const input = note.getByRole('textbox', { name: '내 판정', exact: true });
  await expect(input).toBeFocused();
  await input.fill(text);
  await note.getByRole('button', { name: '메모 저장', exact: true }).click();
  await expect(note.locator('.ruling-note-text')).toHaveText(text);
}

test('notes follow a reference into play, stay attached to the correct entry, and are searchable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/ref/bleeding');
  const main = page.getByRole('main');
  const bleedText = '여백에 남은 횟수를 표시하고 차례를 넘긴다.';
  await addNote(await openNote(main), bleedText);

  await page.goto('/oracle/t-traps');
  const trapText = `덫의 방 번호 옆에 표시. ${'tripwire'.repeat(55)}`;
  await addNote(await openNote(main), trapText);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.goto('/ref/cr-necropede');
  const beastText = '<b>북쪽 발자국 확인</b>';
  await addNote(await openNote(main), beastText);
  await expect(main.locator('.ruling-note-text b')).toHaveCount(0);
  await page.getByRole('link', { name: '플레이 모드', exact: true }).click();
  await page.getByRole('button', { name: '검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '규칙 검색' });
  await search.getByRole('searchbox', { name: '검색어' }).fill('Necropede');
  await search.getByRole('searchbox', { name: '검색어' }).press('Enter');
  const preview = page.locator('.reference-panel');
  await expect(preview).toBeVisible();
  const previewNote = await openNote(preview);
  await expect(previewNote.locator('.ruling-note-text')).toHaveText(beastText);
  await preview.getByRole('button', { name: '참고 패널 닫기' }).click();

  await page.goto('/ref');
  const index = main.locator('.ruling-notes-index');
  await index.locator('summary').click();
  const query = index.getByRole('searchbox', { name: '메모 검색' });
  const results = index.getByRole('list', { name: '내 판정 메모 검색 결과' });
  await expect(results.getByRole('listitem')).toHaveCount(3);
  await query.fill('traps tripwire');
  await expect(results.getByRole('listitem')).toHaveCount(1);
  await expect(results).toContainText(trapText);
  await query.fill('횟수');
  await expect(results.getByRole('listitem')).toHaveCount(1);
  await results.getByRole('link', { name: '출혈', exact: true }).click();
  const note = await openNote(main);
  await expect(note.locator('.ruling-note-text')).toHaveText(bleedText);
  await note.getByRole('button', { name: '메모 편집', exact: true }).click();
  await note.getByRole('button', { name: '메모 삭제', exact: true }).click();
  await expect(note.locator('.ruling-note-text')).toHaveCount(0);
});
