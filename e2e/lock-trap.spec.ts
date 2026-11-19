import { expect, test } from '@playwright/test';

test('door and container thresholds differ and a missed trap triggers on contact', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  const investigation = tool.getByRole('region', { name: '대상 조사' });
  await investigation.getByLabel('Perception 탐지 결과').selectOption('success');
  await investigation.getByLabel('함정 여부 D10', { exact: true }).fill('6');
  await investigation.getByLabel('잠김 여부 D20', { exact: true }).fill('11');
  await expect(investigation.getByRole('status')).toContainText('문 잠기지 않음');

  await tool.getByRole('button', { name: '용기', exact: true }).click();
  await investigation.getByLabel('잠김 여부 D20', { exact: true }).fill('11');
  await expect(investigation.getByRole('status')).toContainText('용기 잠김');
  await investigation.getByLabel('Perception 탐지 결과').selectOption('failure');
  await expect(investigation.getByLabel('함정 여부 D10', { exact: true })).toHaveCount(0);
  await tool.getByRole('button', { name: '대상 건드리기' }).click();
  await investigation.getByLabel('함정 여부 D10', { exact: true }).fill('7');
  await expect(investigation.getByRole('status')).toContainText('함정 발동');
  await expect(tool.getByRole('region', { name: '잠긴 대상 열기' })).toHaveCount(0);
  const response = tool.getByRole('region', { name: '함정 처리' });
  await response.getByLabel('함정 종류 D10', { exact: true }).fill('5');
  await expect(response.getByText('함정 발동 · Acrobatics 탐지 보정 없이 회피 판정')).toBeVisible();
  await response.getByRole('button', { name: '회피 성공' }).click();
  await expect(tool.getByRole('region', { name: '잠긴 대상 열기' })).toBeVisible();

  await tool.getByRole('button', { name: '환경 함정', exact: true }).click();
  await investigation.getByLabel('Perception 탐지 결과').selectOption('failure');
  await expect(investigation.getByRole('status')).toContainText('함정 발동');
  await expect(investigation.getByLabel('함정 여부 D10', { exact: true })).toHaveCount(0);
  await expect(investigation.getByLabel('잠김 여부 D20', { exact: true })).toHaveCount(0);
});

test('every force attempt shows Tension, including success, and a failed attempt adds +20', async ({ page }) => {
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  await tool.getByLabel('Perception 탐지 결과').selectOption('success');
  await tool.getByLabel('함정 여부 D10', { exact: true }).fill('3');
  await tool.getByLabel('잠김 여부 D20', { exact: true }).fill('12');
  const opening = tool.getByRole('region', { name: '잠긴 대상 열기' });
  await opening.getByLabel('개방 방법').selectOption('force');
  await opening.getByRole('checkbox', { name: /Crowbar 사용/ }).check();
  await expect(opening.getByRole('status')).toHaveText('1번째 시도 · Athletics +10');
  await opening.getByRole('button', { name: '강제 개방 실패' }).click();
  const tension = opening.getByRole('region', { name: '강제 개방 시도의 긴장 주사위' });
  await expect(tension.getByRole('heading')).toHaveText('1번째 시도의 긴장 주사위');
  await tension.getByRole('button', { name: 'D8 굴리기' }).click();
  await expect(tension.getByRole('status')).toContainText('다음 긴장 주사위');
  await tension.getByRole('button', { name: '다음 시도' }).click();
  await expect(opening.getByRole('status')).toHaveText('2번째 시도 · Athletics +30');
  await opening.getByRole('button', { name: '강제 개방 성공' }).click();
  await expect(opening.getByText('개방 성공 · XP +10')).toBeVisible();
  await expect(tension.getByRole('heading')).toHaveText('2번째 시도의 긴장 주사위');
  await expect(tension.getByRole('status')).toBeEmpty();
});

test('physical detection, disarm and lockpick apply the random and retry modifiers', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1000 });
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  await tool.getByText('탐지 D100 직접 판정', { exact: true }).click();
  const detection = tool.getByRole('group', { name: '탐지 판정', exact: true });
  await detection.getByLabel('Perception 수치').fill('50');
  await detection.getByLabel('난이도 D8').fill('2');
  await detection.getByLabel('직접 굴린 D100').fill('61');
  await detection.getByRole('button', { name: '판정', exact: true }).click();
  await expect(detection.getByRole('status')).toContainText('보정 후 Perception 70');
  await expect(tool.getByLabel('Perception 탐지 결과')).toHaveValue('success');
  await tool.getByLabel('함정 여부 D10', { exact: true }).fill('8');
  await tool.getByLabel('잠김 여부 D20', { exact: true }).fill('12');

  const trap = tool.getByRole('region', { name: '함정 처리' });
  await trap.getByLabel('함정 종류 D10', { exact: true }).fill('1');
  await trap.getByLabel('함정 처리 방법').selectOption('disarm');
  await trap.getByText('해제 D100 직접 판정', { exact: true }).click();
  const disarm = trap.getByRole('group', { name: '해제 판정', exact: true });
  await disarm.getByLabel('Thievery 수치').fill('60');
  await disarm.getByLabel('난이도 D8').fill('8');
  await disarm.getByLabel('직접 굴린 D100').fill('29');
  await disarm.getByRole('button', { name: '판정', exact: true }).click();
  await expect(disarm.getByRole('status')).toContainText('보정 후 Thievery 30');
  await expect(trap.getByText('함정 해제 · XP +10')).toBeVisible();

  const opening = tool.getByRole('region', { name: '잠긴 대상 열기' });
  await opening.getByText('자물쇠 따기 D100 직접 판정', { exact: true }).click();
  const pick = opening.getByRole('group', { name: '자물쇠 따기 판정', exact: true });
  await pick.getByLabel('Thievery 수치').fill('45');
  await pick.getByLabel('직접 굴린 D100').fill('52');
  await pick.getByRole('button', { name: '판정', exact: true }).click();
  await expect(opening.getByText('Lockpick 파손 1개', { exact: false })).toBeVisible();
  await expect(pick.getByRole('status')).toContainText('보정 후 Thievery 45');
  await pick.getByLabel('직접 굴린 D100').fill('52');
  await pick.getByRole('button', { name: '판정', exact: true }).click();
  await expect(opening.getByText('개방 성공 · XP +10')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});
