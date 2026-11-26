import { expect, test } from '@playwright/test';
import { detectTrap, skillRoll } from './helpers/skill-roll';
import { choose } from './helpers/choice';

test('door and container thresholds differ and a missed trap triggers on contact', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 820 });
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  const investigation = tool.getByRole('region', { name: '대상 조사' });
  const detection = await detectTrap(investigation, 22);
  await expect(detection.getByRole('status')).toContainText('Heightened Awareness');
  await investigation.getByLabel('함정 여부 D10', { exact: true }).fill('6');
  await investigation.getByLabel('잠김 여부 D20', { exact: true }).fill('11');
  await expect(investigation.getByRole('status').filter({ hasText: '문 잠기지 않음' })).toBeVisible();

  await tool.getByRole('button', { name: '용기', exact: true }).click();
  await investigation.getByLabel('잠김 여부 D20', { exact: true }).fill('11');
  await expect(investigation.getByRole('status')).toContainText('용기 잠김');
  await detectTrap(investigation, 68);
  await expect(investigation.getByLabel('함정 여부 D10', { exact: true })).toHaveCount(0);
  await tool.getByRole('button', { name: '대상 건드리기' }).click();
  await investigation.getByLabel('함정 여부 D10', { exact: true }).fill('7');
  await expect(investigation.getByRole('status').filter({ hasText: '함정 발동' })).toBeVisible();
  await expect(tool.getByRole('region', { name: '잠긴 대상 열기' })).toHaveCount(0);
  const response = tool.getByRole('region', { name: '함정 처리' });
  await response.getByLabel('함정 종류 D10', { exact: true }).fill('5');
  await expect(response.getByText('함정 발동 · Acrobatics 탐지 보정 없이 회피 판정')).toBeVisible();
  await skillRoll(response, '회피 판정', 'Acrobatics', 45, 24);
  await expect(tool.getByRole('region', { name: '잠긴 대상 열기' })).toBeVisible();

  await tool.getByRole('button', { name: '환경 함정', exact: true }).click();
  const environmentCheck = await detectTrap(investigation, 66);
  await expect(environmentCheck.getByRole('status')).toContainText('Blind Spot');
  await expect(investigation.getByRole('status').filter({ hasText: '함정 발동' })).toBeVisible();
  await expect(investigation.getByLabel('함정 여부 D10', { exact: true })).toHaveCount(0);
  await expect(investigation.getByLabel('잠김 여부 D20', { exact: true })).toHaveCount(0);
});

test('every force attempt shows Tension, including success, and a failed attempt adds +20', async ({ page }) => {
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  await detectTrap(tool);
  await tool.getByLabel('함정 여부 D10', { exact: true }).fill('3');
  await tool.getByLabel('잠김 여부 D20', { exact: true }).fill('12');
  const opening = tool.getByRole('region', { name: '잠긴 대상 열기' });
  await choose(opening, '개방 방법', 'force');
  await opening.getByRole('checkbox', { name: /Crowbar 사용/ }).check();
  await expect(opening.getByRole('status')).toHaveText('1번째 시도 · Athletics +10');
  await skillRoll(opening, '강제 개방 판정', 'Athletics', 45, 62);
  const tension = opening.getByRole('region', { name: '강제 개방 시도의 긴장 주사위' });
  await expect(tension.getByRole('heading')).toHaveText('1번째 시도의 긴장 주사위');
  await expect(tension.getByRole('button', { name: '다음 시도' })).toHaveCount(0);
  await tension.getByLabel('긴장 주사위 굴린 값').fill('2');
  await tension.getByLabel('긴장 주사위 굴린 값').press('Enter');
  await expect(tension.getByRole('status')).toContainText('다음 긴장 주사위 D6');
  await tension.getByRole('button', { name: '다음 시도' }).click();
  await expect(opening.getByRole('status')).toHaveText('2번째 시도 · Athletics +30');
  await skillRoll(opening, '강제 개방 판정', 'Athletics', 45, 62);
  await expect(opening.getByText('개방 성공 · XP +10')).toHaveCount(0);
  await expect(tension.getByRole('heading')).toHaveText('2번째 시도의 긴장 주사위');
  await expect(tension.getByRole('status')).toBeEmpty();
  await expect(tension.getByLabel('긴장 주사위 크기')).toHaveValue('6');
  await tension.getByLabel('긴장 주사위 굴린 값').fill('3');
  await tension.getByLabel('긴장 주사위 굴린 값').press('Enter');
  await expect(opening.getByText('개방 성공 · XP +10')).toBeVisible();
});

test('physical detection, disarm and lockpick apply the random and retry modifiers', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1000 });
  await page.goto('/atlas/p-locks-traps?view=list');
  const tool = page.getByRole('region', { name: '문·용기·함정 판정' });
  const detection = await skillRoll(tool, '탐지 판정', 'Perception', 50, 61, 2);
  await expect(detection.getByRole('status')).toContainText('보정 후 Perception 70');
  await expect(detection.getByRole('status')).toContainText('성공');
  await tool.getByLabel('함정 여부 D10', { exact: true }).fill('8');
  await tool.getByLabel('잠김 여부 D20', { exact: true }).fill('12');

  const trap = tool.getByRole('region', { name: '함정 처리' });
  await trap.getByLabel('함정 종류 D10', { exact: true }).fill('1');
  await choose(trap, '함정 처리 방법', 'disarm');
  const disarm = await skillRoll(trap, '해제 판정', 'Thievery', 60, 29, 8);
  await expect(disarm.getByRole('status')).toContainText('보정 후 Thievery 35');
  await expect(trap.getByText('함정 해제 · XP +10')).toBeVisible();

  const opening = tool.getByRole('region', { name: '잠긴 대상 열기' });
  const pick = await skillRoll(opening, '자물쇠 따기 판정', 'Thievery', 45, 52);
  await expect(opening.getByText('Lockpick 파손 1개', { exact: false })).toBeVisible();
  await expect(pick.getByRole('status')).toContainText('보정 후 Thievery 45');
  await skillRoll(opening, '자물쇠 따기 판정', 'Thievery', 45, 52);
  await expect(opening.getByText('개방 성공 · XP +10')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
});
