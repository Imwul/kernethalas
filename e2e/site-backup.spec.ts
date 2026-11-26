import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { closeDrawer, openDrawer } from './helpers/play-desk';

test('a full backup restores every campaign and can be undone once', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 1366 });
  await page.goto('/play');
  const save = page.locator('.play-checkpoints');
  const saveButton = page.getByRole('group', { name: '플레이 서랍' }).getByRole('button', { name: /^저장/ });
  await expect(saveButton).not.toHaveAccessibleName(/백업 필요/);

  // record something to protect, then back it up
  const shape = page.getByRole('region', { name: '방·통로 모양', exact: true });
  const value = shape.getByRole('textbox', { name: '직접 굴린 값', exact: true });
  await value.fill('31');
  await value.press('Enter');
  await expect(saveButton).toHaveAccessibleName(/백업 필요/);
  await openDrawer(page, '저장');
  const backup = save.getByRole('region', { name: '전체 백업' });
  const [download] = await Promise.all([page.waitForEvent('download'), backup.getByRole('button', { name: '전체 백업 내려받기' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^kernethalas-backup-\d{8}\.json$/);
  await expect(backup).toContainText('오늘 전체 백업');
  await expect(saveButton).not.toHaveAccessibleName(/백업 필요/);
  const file = await download.path();
  const saved = JSON.parse(await readFile(file, 'utf8'));
  expect(saved.format).toBe('kernethalas-ossuary-backup');
  expect(Object.keys(saved.data)).toContain('kn-play-room-v1');

  // wipe the room, then restore from the file (at this width the drawer covers the header)
  await closeDrawer(page);
  await page.getByRole('button', { name: '그 밖의 동작', exact: true }).click();
  await page.getByRole('button', { name: '이번 장소 지우기…', exact: true }).click();
  await page.getByRole('button', { name: '지우고 새로 시작' }).click();
  await expect(shape.getByRole('textbox', { name: '직접 굴린 값', exact: true })).toHaveValue('');
  await openDrawer(page, '저장');
  await backup.getByLabel('전체 백업 JSON 파일').setInputFiles(file!);
  const review = backup.getByRole('region', { name: '전체 백업 검토' });
  await expect(review).toContainText('캠페인 1개');
  await review.getByRole('button', { name: '백업으로 바꾸기' }).click();

  await expect(page.getByRole('region', { name: '방·통로 모양', exact: true })).toContainText('31');
  const undo = page.locator('.play-site-backup-undo');
  await expect(undo).toContainText('백업을 복원했습니다.');
  await undo.getByRole('button', { name: '복원 전으로 되돌리기' }).click();
  await expect(page.locator('.play-site-backup-undo')).toHaveCount(0);
});

test('a checkpoint file is not accepted as a full backup', async ({ page }) => {
  await page.goto('/play');
  await openDrawer(page, '저장');
  const backup = page.getByRole('region', { name: '전체 백업' });
  await backup.getByLabel('전체 백업 JSON 파일').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"other"}') });
  await expect(backup.getByRole('alert')).toContainText('전체 백업 파일을 선택하세요');
});
