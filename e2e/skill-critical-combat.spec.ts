import { expect, test } from '@playwright/test';
import { choose } from './helpers/choice';

test('confirmed PC encounter and attack doubles reach camp with the correct skills', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('Necropede');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();

  const start = combat.getByRole('region', { name: '조우 시작 계산기' });
  await choose(start, '조우의 공포 특성', '4');
  await start.getByRole('textbox', { name: 'PC Resolve' }).fill('40');
  await start.getByRole('textbox', { name: 'Resolve D100' }).fill('88');
  await expect(start.getByRole('status', { name: 'Resolve 결과' })).toContainText('Sanity 4 + D4 손실');
  await start.getByRole('button', { name: 'Resolve 더블 저널에 기록', exact: true }).click();
  await expect(start.getByRole('button', { name: 'Resolve 더블 저널에 기록됨', exact: true })).toBeDisabled();

  await choose(start, '조우 시작 방식', 'surprise');
  await start.getByRole('textbox', { name: '적 최고 Mind' }).fill('50');
  await start.getByRole('textbox', { name: 'PC 최저 Stealth' }).fill('50');
  await start.getByRole('textbox', { name: 'PC 기습 D100' }).fill('77');
  await start.getByRole('textbox', { name: '적 기습 D100' }).fill('31');
  await expect(start.getByRole('status', { name: '기습 결과' })).toContainText('다음 라운드에 하는 모든 행동에 Disadvantage');
  await start.getByRole('button', { name: 'Stealth 야영 성장 표시', exact: true }).click();

  await start.getByRole('textbox', { name: 'PC 최고 Perception' }).fill('70');
  await start.getByRole('textbox', { name: 'PC Initiative D100' }).fill('22');
  await start.getByRole('textbox', { name: '적 Initiative D100' }).fill('31');
  await expect(start.getByRole('status', { name: 'Initiative 결과' })).toContainText('다음 공격 Advantage');
  await start.getByRole('button', { name: 'Perception 야영 성장 표시', exact: true }).click();
  await expect(start.getByRole('button', { name: 'Perception 야영 성장 표시됨', exact: true })).toBeDisabled();

  const card = combat.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await attack.getByRole('button', { name: 'PC가 공격', exact: true }).click();
  await attack.getByRole('textbox', { name: '공격자 수치' }).fill('40');
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('77');
  await attack.getByRole('textbox', { name: '방어자 D100' }).fill('31');
  await expect(attack.getByRole('link', { name: 'PC 공격자 펌블' })).toBeVisible();
  await expect(attack.getByRole('button', { name: '야영 성장 표시', exact: true })).toBeDisabled();
  await attack.getByRole('combobox', { name: 'PC 공격에 사용한 기술' }).selectOption('Bladed Weapons');
  await attack.getByRole('button', { name: '야영 성장 표시', exact: true }).click();

  await attack.getByRole('button', { name: '적이 공격', exact: true }).click();
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('11');
  await attack.getByRole('textbox', { name: '방어자 수치' }).fill('50');
  await attack.getByRole('textbox', { name: '방어자 D100' }).fill('25');
  await expect(attack.getByRole('combobox', { name: 'PC 방어에 사용한 기술' })).toHaveCount(0);
  await attack.getByRole('textbox', { name: '방어자 D100' }).fill('44');
  await attack.getByRole('combobox', { name: 'PC 방어에 사용한 기술' }).selectOption('Dodge');
  await attack.getByRole('button', { name: '야영 성장 표시', exact: true }).click();
  await expect(attack.getByRole('button', { name: '야영 성장 표시됨', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('Resolve · D100 88 · 대실패 · Sanity 4 + D4 손실');
  await expect(journal).toContainText('Initiative (Perception) · D100 22 · 대성공');
  await expect(journal).toContainText('Bladed Weapons · D100 77 · 대실패');
  await expect(journal).toContainText('Dodge · D100 44 · 대성공');
  await expect(journal).not.toContainText('Elusive Maneuver');

  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  await wrap.getByRole('button', { name: '야영', exact: true }).click();
  const pending = wrap.getByRole('group', { name: '야영 성장 대기' });
  await expect(pending).toContainText('Stealth · Perception · Bladed Weapons · Dodge');
  await expect(pending).not.toContainText('Resolve');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
