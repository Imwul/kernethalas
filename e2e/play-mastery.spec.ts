import { expect, test, type Locator } from '@playwright/test';
import { openPane } from './helpers/play-desk';

async function physicalRoll(container: Locator, name: string, value: string) {
  const input = container.getByRole('group', { name, exact: true }).getByRole('textbox', { name: '직접 굴린 값' });
  await input.fill(value);
  await input.press('Enter');
}

test('a physical Magic Resistance failure opens the damage roll and confirmed Mastery costs reach the journal at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await combat.getByRole('combobox', { name: '조우 방식' }).selectOption('search');
  await combat.getByRole('searchbox', { name: '생물 이름' }).fill('Fangvine');
  await combat.getByRole('button', { name: 'Fangvine', exact: true }).click();
  await openPane(combat, 'Mastery·마법');

  const mastery = combat.getByRole('region', { name: 'PC Mastery 능력' });
  await mastery.getByRole('combobox', { name: '종이 시트의 Mastery' }).selectOption('m-flamecaster');
  await mastery.getByRole('combobox', { name: '배운 마지막 Tier' }).selectOption('1');
  const abilities = mastery.getByRole('combobox', { name: '사용할 능력' });
  await expect(abilities.getByRole('option', { name: 'Fireball' })).toHaveCount(0);
  await abilities.selectOption({ label: 'Fire Bolt' });
  const target = mastery.getByRole('region', { name: 'Fangvine', exact: true });
  await expect(target.getByRole('textbox', { name: 'Magic Resistance 수치' })).toHaveValue('30');
  const resistance = target.getByRole('textbox', { name: '직접 굴린 D100' });
  await resistance.fill('17');
  await resistance.press('Enter');
  await expect(target).toContainText('저항 성공 · 효과 방어');
  await expect(target.getByRole('group', { name: 'Fire 피해 D6' })).toHaveCount(0);
  await resistance.fill('00');
  await resistance.press('Enter');
  await physicalRoll(target, 'Fire 피해 D6', '5');
  await expect(target).toContainText('Fire 피해 10');
  await mastery.getByRole('textbox', { name: '현재 Aether (선택)' }).fill('3');
  await expect(mastery.getByRole('alert')).toContainText('비용 4 이상');
  await expect(mastery.getByRole('button', { name: '능력 사용 기록' })).toHaveCount(0);
  await mastery.getByRole('textbox', { name: '현재 Aether (선택)' }).fill('4');
  await mastery.getByRole('button', { name: '능력 사용 기록' }).click();
  await expect(mastery.getByRole('list', { name: '이번 전투 능력 기록' })).toContainText('Aether −4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('Fire Bolt');
  await expect(journal).toContainText('Fangvine · 저항 실패 · Fire 피해 10');
});

test('XP threshold, sequential unlock and one physical advancement die publish a reload-safe record at 3440px', async ({ page }) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto('/play');
  await page.getByRole('button', { name: '휴식·정리', exact: true }).click();
  await page.getByRole('group', { name: '정리할 항목' }).getByRole('button', { name: 'XP·레벨업', exact: true }).click();
  const advancement = page.getByRole('region', { name: '레벨업과 능력 해금' });
  const level = advancement.getByRole('textbox', { name: '종이 시트 레벨' });
  const xp = advancement.getByRole('textbox', { name: '보유 XP' });
  await level.fill('2');
  await xp.fill('999');
  await expect(advancement).toContainText('1 XP 남았습니다');
  await expect(advancement.getByRole('combobox', { name: '레벨업 혜택 하나' })).toHaveCount(0);
  await xp.fill('1,050');
  await advancement.getByRole('combobox', { name: 'Ability Point 사용' }).selectOption('m-arcanist');
  await advancement.getByRole('combobox', { name: '시트에서 마지막으로 연 Tier' }).selectOption('5');
  await expect(advancement).toContainText('Tier 5까지 열었습니다');
  await advancement.getByRole('combobox', { name: '시트에서 마지막으로 연 Tier' }).selectOption('2');
  await advancement.getByRole('combobox', { name: '레벨업 혜택 하나' }).selectOption('Health');
  await physicalRoll(advancement, 'Health 증가량 D4', '3');
  await expect(advancement.getByRole('list', { name: '시트에 옮길 레벨업 결과' })).toContainText('Create Light 해금');
  const fields = [await level.boundingBox(), await xp.boundingBox()];
  expect(fields[0]?.y).toBe(fields[1]?.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(3440);
  await advancement.getByRole('button', { name: '레벨업 기록' }).click();
  await page.reload();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal).toContainText('레벨 2 → 3');
  await expect(journal).toContainText('XP 1,050 → 0');
  await expect(journal).toContainText('Health 최대치 +3');
  await expect(journal).toContainText('Create Light 해금');
});

test('compound spell dice and Sustained activation keep separate paper Aether changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await openPane(combat, 'Mastery·마법');
  const mastery = combat.getByRole('region', { name: 'PC Mastery 능력' });
  await mastery.getByRole('combobox', { name: '종이 시트의 Mastery' }).selectOption('m-abyssal-reaver');
  await mastery.getByRole('combobox', { name: '배운 마지막 Tier' }).selectOption('2');
  const abilities = mastery.getByRole('combobox', { name: '사용할 능력' });
  await abilities.selectOption({ label: 'Infernal Flame' });
  await mastery.getByRole('textbox', { name: '대상 이름' }).fill('경비병');
  const target = mastery.getByRole('region', { name: '경비병', exact: true });
  await target.getByRole('textbox', { name: 'Magic Resistance 수치' }).fill('35');
  const resistance = target.getByRole('textbox', { name: '직접 굴린 D100' });
  await resistance.fill('78');
  await resistance.press('Enter');
  await physicalRoll(target, 'Infernal 피해 D6+D4', '5 3');
  // Damage Pool: one die counts, the highest by default, and the player may pick another.
  await expect(target).toContainText('Infernal 피해 5');
  await target.getByRole('radio', { name: /^3/ }).check();
  await expect(target).toContainText('Infernal 피해 3');
  await mastery.getByRole('button', { name: '능력 사용 기록' }).click();

  await abilities.selectOption({ label: 'Hellish Weapon' });
  const blocked = mastery.getByRole('checkbox', { name: '현재 Blinded 또는 Prone' });
  await blocked.check();
  await expect(mastery.getByRole('button', { name: '능력 사용 기록' })).toHaveCount(0);
  await blocked.uncheck();
  await mastery.getByRole('button', { name: '능력 사용 기록' }).click();
  await expect(mastery.getByRole('list', { name: '이번 전투 능력 기록' })).toContainText('최대 Aether −5 (Sustained)');
  await expect(mastery.getByRole('button', { name: '능력 사용 기록' })).toHaveCount(0);
  await mastery.getByRole('button', { name: '전투 밖에서 유지 해제 기록' }).click();
  await expect(mastery.getByRole('list', { name: '이번 전투 능력 기록' })).toContainText('최대 Aether 제한 5 해제');

  await mastery.getByRole('combobox', { name: '종이 시트의 Mastery' }).selectOption('m-ritualist');
  await mastery.getByRole('combobox', { name: '배운 마지막 Tier' }).selectOption('4');
  await abilities.selectOption({ label: 'Sigil of Power' });
  await mastery.getByRole('button', { name: '능력 사용 기록' }).click();
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('button', { name: '장비 장부에서 변경 확인' }).click();
  await expect(page.getByRole('button', { name: '장부에 반영 Ritual Component −5 (Sigil of Power)', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
