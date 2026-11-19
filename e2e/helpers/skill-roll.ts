import type { Locator } from '@playwright/test';

export async function skillRoll(scope: Locator, check: string, skill: string, score: number, value: number, difficulty?: number) {
  const form = scope.getByRole('group', { name: check, exact: true });
  await form.getByLabel(`${skill} 수치`, { exact: true }).fill(String(score));
  if (difficulty !== undefined) await form.getByLabel('난이도 D8', { exact: true }).fill(String(difficulty));
  const input = form.getByLabel('직접 굴린 D100', { exact: true });
  await input.fill(String(value));
  await input.press('Enter');
  return form;
}

export function detectTrap(scope: Locator, value = 32) {
  return skillRoll(scope, '탐지 판정', 'Perception', 50, value, 4);
}
