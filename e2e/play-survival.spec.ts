import { expect, test, type Locator } from '@playwright/test';

async function physicalRoll(tool: Locator, label: string, value: string) {
  const field = tool.getByRole('group', { name: label, exact: true }).getByRole('textbox', { name: '직접 굴린 값' });
  await field.fill(value);
  await field.press('Enter');
}

test('a bandage resolves lingering damage and future room damage remains a preview at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('button', { name: '치료·성장', exact: true }).click();
  const treatment = page.getByRole('region', { name: '지속 피해와 붕대 처치' });
  const bleeding = treatment.getByRole('checkbox', { name: '출혈' });
  await bleeding.check();
  await treatment.getByRole('checkbox', { name: '화상' }).check();
  await treatment.getByRole('checkbox', { name: '중독' }).check();
  await expect(treatment.getByRole('status', { name: '다음 방 지속 피해' })).toContainText('Health −3');
  await treatment.getByLabel('붕대 처치 목적').selectOption('bleeding');
  await treatment.getByLabel('보정 Medicine').fill('45');
  await physicalRoll(treatment, 'Medicine D100', '24');
  await treatment.getByRole('button', { name: '붕대 처치 기록' }).click();
  await expect(bleeding).not.toBeChecked();
  await expect(treatment.getByRole('status', { name: '다음 방 지속 피해' })).toContainText('Health −2');
  await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(bleeding).toBeChecked();
  await treatment.getByRole('button', { name: '붕대 처치 기록' }).click();
  await treatment.getByRole('button', { name: '화상 끄기 · Exhaustion +2' }).click();
  await treatment.getByLabel('붕대 처치 목적').selectOption('heal');
  await physicalRoll(treatment, 'Medicine D100', '13');
  await physicalRoll(treatment, '붕대 회복 D4', '4');
  await treatment.getByRole('button', { name: '붕대 처치 기록' }).click();
  await expect(treatment.getByRole('status', { name: '다음 방 지속 피해' })).toContainText('Health −1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  await page.reload();
  const sheet = page.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet.getByRole('checkbox', { name: 'Bandage −1 (붕대 처치)', exact: true })).toHaveCount(2);
  await expect(sheet).toContainText('출혈 해제 (붕대 처치)');
  await expect(sheet).toContainText('Exhaustion +2 (화상 끄기)');
  await expect(sheet).toContainText('Toughness +4 (붕대 처치)');
  await expect(sheet).not.toContainText('Health −1');
});

test('manual Rot and camp skill checks record their adjustments with aligned fields at 3440px', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('button', { name: '야영', exact: true }).click();
  await page.getByRole('button', { name: '부패병 판정', exact: true }).click();
  const rot = page.getByRole('region', { name: '부패병 판정' });
  await rot.getByLabel('보정 Endurance').fill('30');
  await physicalRoll(rot, 'Endurance D100', '48');
  await expect(rot.getByRole('status', { name: '부패병 결과' })).toContainText('1단계로 진행');
  await rot.getByRole('button', { name: '부패병 판정 기록' }).click();

  await rot.getByLabel('판정 시점').selectOption('camp');
  await rot.getByLabel('현재 부패병 단계').selectOption('5');
  await physicalRoll(rot, 'Endurance D100', '24');
  await physicalRoll(rot, '부패병 야영 Health D4', '3');
  await rot.getByRole('button', { name: '부패병 판정 기록' }).click();

  const survival = page.getByRole('region', { name: '치료·성장 도구' });
  await survival.getByRole('button', { name: '기술 성장', exact: true }).click();
  const growth = survival.getByRole('region', { name: '야영 기술 성장' });
  const name = growth.getByLabel('기술 이름');
  const score = growth.getByLabel('현재 Skill');
  await name.fill('Medicine');
  await score.fill('78');
  const nameBox = await name.boundingBox();
  const scoreBox = await score.boundingBox();
  expect(nameBox?.y).toEqual(scoreBox?.y);
  expect(nameBox?.height).toEqual(scoreBox?.height);
  await physicalRoll(growth, '기술 성장 D100', '00');
  await physicalRoll(growth, '성장량 D4', '4');
  await expect(growth.getByRole('status').filter({ hasText: 'Medicine' })).toHaveText('Medicine 78 → 80 (+2)');
  await growth.getByRole('button', { name: '기술 성장 기록' }).click();
  await name.fill('medicine');
  await score.fill('78');
  await physicalRoll(growth, '기술 성장 D100', '23');
  await expect(growth.getByRole('button', { name: '기술 성장 기록' })).toBeDisabled();
  await name.fill('Dodge');
  await expect(score).toHaveValue('');
  await score.fill('35');
  await expect(growth.getByRole('group', { name: '기술 성장 D100' }).getByRole('status')).toHaveCount(0);
  await expect(growth.getByRole('button', { name: '기술 성장 기록' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);

  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  const sheet = page.getByRole('group', { name: '종이 시트에 반영' });
  await expect(sheet).toContainText('부패병 1단계 · Necrotic 면역, Holy 취약.');
  await expect(sheet).toContainText('Health +3 (부패병 야영 효과)');
  await expect(sheet).toContainText('Medicine 78 → 80 (+2) (성장 표시 지우기)');
});

test('PC skill doubles stay marked until camp, and undo restores the mark', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('button', { name: '치료·성장', exact: true }).click();
  const treatment = page.getByRole('region', { name: '지속 피해와 붕대 처치' });
  const undo = page.getByRole('button', { name: '직전 굴림 되돌리기' });
  const skillRoll = treatment.getByRole('group', { name: 'Medicine D100' });
  await treatment.getByLabel('보정 Medicine').fill('45');
  await physicalRoll(treatment, 'Medicine D100', '22');
  await expect(skillRoll.getByRole('status')).toContainText('대성공 · 야영 성장 표시');
  await undo.click();
  await page.getByRole('button', { name: '야영', exact: true }).click();
  const reminder = page.getByRole('group', { name: '야영 성장 대기', exact: true });
  await expect(reminder).toHaveCount(0);

  await page.getByRole('button', { name: '치료·성장', exact: true }).click();
  await physicalRoll(treatment, 'Medicine D100', '66');
  await expect(skillRoll.getByRole('status')).toContainText('대실패 · 야영 성장 표시');
  await physicalRoll(treatment, 'Medicine D100', '44');
  const survival = page.getByRole('region', { name: '치료·성장 도구' });
  await survival.getByRole('button', { name: '부패병', exact: true }).click();
  const rot = page.getByRole('region', { name: '부패병 판정' });
  await rot.getByLabel('보정 Endurance').fill('30');
  await physicalRoll(rot, 'Endurance D100', '00');
  await expect(rot.getByRole('group', { name: 'Endurance D100' }).getByRole('status')).toContainText('대실패');
  await page.getByRole('button', { name: '야영', exact: true }).click();
  await expect(reminder).toContainText('Medicine');
  await expect(reminder).not.toContainText('Endurance');

  await page.getByRole('button', { name: '저널 기록 보기' }).click();
  await page.getByRole('button', { name: '다음 장소', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('button', { name: '야영', exact: true }).click();
  await reminder.getByRole('button', { name: '대기 중인 기술 성장으로' }).click();
  const growth = page.getByRole('region', { name: '야영 기술 성장' });
  const pending = growth.getByRole('group', { name: '성장 대기 기술' });
  await expect(pending.getByRole('button')).toHaveCount(1);
  await pending.getByRole('button', { name: 'Medicine', exact: true }).click();
  await expect(growth.getByLabel('기술 이름')).toHaveValue('Medicine');
  await expect(growth.getByLabel('현재 Skill')).toBeFocused();
  await growth.getByLabel('현재 Skill').fill('45');
  await physicalRoll(growth, '기술 성장 D100', '46');
  await physicalRoll(growth, '성장량 D4', '3');
  await growth.getByRole('button', { name: '기술 성장 기록' }).click();
  await expect(pending).toHaveCount(0);
  await undo.click();
  await expect(pending.getByRole('button', { name: 'Medicine', exact: true })).toBeVisible();
  await growth.getByRole('button', { name: '기술 성장 기록' }).click();
  await expect(pending).toHaveCount(0);

  await survival.getByRole('button', { name: '붕대·지속 피해', exact: true }).click();
  await treatment.getByLabel('보정 Medicine').fill('48');
  await physicalRoll(treatment, 'Medicine D100', '33');
  await survival.getByRole('button', { name: '기술 성장', exact: true }).click();
  await pending.getByRole('button', { name: 'Medicine', exact: true }).click();
  await growth.getByLabel('현재 Skill').fill('48');
  await physicalRoll(growth, '기술 성장 D100', '48');
  await growth.getByRole('button', { name: '기술 성장 기록' }).click();
  await expect(pending).toHaveCount(0);
  const records = survival.getByRole('list', { name: '이번 장소 치료·성장 결과' });
  await expect(records).toContainText('Medicine 45 → 48 (+3)');
  await expect(records).toContainText('Medicine 48 → 49 (+1)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
