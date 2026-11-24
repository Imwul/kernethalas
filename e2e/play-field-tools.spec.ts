import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openPane } from './helpers/play-desk';

test('a physical tie roll assigns the extra opponent, and a Dodge roll records and restores a retreat', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const stages = page.getByRole('navigation', { name: '플레이 단계' });
  const go = (name: string) => stages.getByRole('button', { name, exact: true }).click();
  await go('저널');
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await journal.getByRole('textbox', { name: '장소 이름 (선택)' }).fill('동쪽 묘실');
  await go('조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('t-encounter-b');
  const creatureRoll = combat.getByRole('textbox', { name: 'D20 결과' });
  await creatureRoll.fill('2');
  await creatureRoll.press('Enter');
  for (let index = 0; index < 4; index += 1) await combat.getByRole('button', { name: '같은 생물 추가' }).click();

  await openPane(combat, '적 배분');
  const allocation = combat.getByRole('region', { name: '전투 대상 배분' });
  await allocation.getByRole('textbox', { name: '동료·Minion 수' }).fill('2');
  const tie = allocation.getByRole('textbox', { name: '후보 선택 D4' });
  await tie.fill('4');
  await tie.press('Enter');
  await expect(allocation.getByRole('alert')).toContainText('다시 굴립니다');
  await tie.fill('2');
  await tie.press('Enter');
  await expect(allocation.getByRole('definition')).toHaveText(['2마리', '1마리', '2마리']);
  await allocation.getByRole('combobox', { name: 'Necropede 1 상대' }).selectOption('ally-1');
  const second = allocation.getByRole('combobox', { name: 'Necropede 2 상대' });
  await expect(second.getByRole('option', { name: '동료·Minion 1' })).toBeDisabled();

  await openPane(combat, '도주');
  const flee = combat.getByRole('region', { name: '전투 도주' });
  const dodge = flee.getByRole('textbox', { name: '직접 굴린 D100' });
  await flee.getByRole('textbox', { name: 'Dodge 수치' }).fill('50');
  await dodge.fill('91');
  await dodge.press('Enter');
  await expect(flee).toContainText('이탈할 수 없습니다');
  await dodge.fill('39');
  await dodge.press('Enter');
  await flee.getByRole('button', { name: '후퇴하고 적 편성 기록' }).click();
  await expect(journal).toContainText('후퇴 · 적 편성 기록');
  await expect(journal).not.toContainText('승리');
  await journal.getByRole('button', { name: '다음 장소', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '동쪽 묘실 재진입' }).click();
  await expect(combat.getByRole('group', { name: '전투 대상' }).getByRole('button')).toHaveCount(5);
  await expect(combat.getByText('재진입 · 적 Health 전부 회복').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await combat.getByRole('button', { name: '승리 후 전투 마치기', exact: true }).click();
  await go('탐험');
  await expect(page.getByRole('region', { name: '후퇴했던 장소', exact: true })).toHaveCount(0);
});

test('custom encounter sets migrate the old table, validate imports and round-trip JSON', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.addInitScript(() => localStorage.setItem('kn-play-custom-encounters-v1', JSON.stringify([
    { min: 1, max: 4, creatureId: 'cr-necropede' },
  ])));
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('custom');
  const table = combat.getByRole('combobox', { name: '이 도메인에서 사용할 조우표' });
  await combat.getByText('사용자 지정 조우표 편집', { exact: true }).click();
  await expect(combat.getByRole('list', { name: '저장한 조우 범위' })).toContainText('Necropede');
  await combat.getByText('조우표 관리 및 파일 공유', { exact: true }).click();
  await combat.getByRole('button', { name: '새 조우표' }).click();
  await combat.getByRole('textbox', { name: '조우표 이름' }).fill('동쪽 묘실 조우');
  await combat.getByRole('button', { name: '이름 저장' }).click();
  await expect(table.getByRole('option', { name: '동쪽 묘실 조우' })).toBeAttached();

  const downloaded = page.waitForEvent('download');
  await combat.getByRole('button', { name: '모두 내보내기' }).click();
  const file = await downloaded;
  const json = await readFile(await file.path());
  expect(JSON.parse(json.toString()).sets).toHaveLength(2);
  const input = combat.locator('input[type=file]');
  await input.setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(combat.getByRole('alert')).toContainText('JSON');
  await expect(table.getByRole('option')).toHaveCount(2);
  await input.setInputFiles({ name: file.suggestedFilename(), mimeType: 'application/json', buffer: json });
  await expect(table.getByRole('option')).toHaveCount(4);
  await page.reload();
  await expect(table.getByRole('option')).toHaveCount(4);
  const roll = combat.getByRole('textbox', { name: 'D20 결과' });
  await roll.fill('2');
  await roll.press('Enter');
  await expect(combat.getByRole('heading', { name: 'Necropede', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});
