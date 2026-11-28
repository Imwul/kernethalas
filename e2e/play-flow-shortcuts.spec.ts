import { expect, test, type Page } from '@playwright/test';
import { choose } from './helpers/choice';

async function seed(page: Page, presets: Record<string, number>) {
  await page.addInitScript((skills) => {
    if (!localStorage.getItem('kn-play-room-v1')) localStorage.setItem('kn-play-room-v1', JSON.stringify({ slots: {
      pcCharacter: { name: 'Dusk', level: 2, weapon: 'Bladed Weapons', defense: 'Dodge' },
      skillPresets: skills,
    } }));
    if (!localStorage.getItem('kn-play-gear-v1')) localStorage.setItem('kn-play-gear-v1', JSON.stringify({ entries: [], items: [
      { id: 'w1', name: 'Great Sword', count: 1, location: 'pack', weight: 'heavy' },
      { id: 'w2', name: 'Mace', count: 1, location: 'belt', weight: 'normal' },
      { id: 'w3', name: 'Dagger', count: 1, location: 'belt', weight: 'light' },
    ] }));
  }, presets);
}

async function necropede(page: Page) {
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투', exact: true }).click();
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill('Necropede');
  await combat.getByRole('button', { name: 'Necropede', exact: true }).click();
  return combat;
}

test('the PC attack takes damage, Speed and traits from the carried weapon', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, { 'Bladed Weapons': 55, 'Bludgeoning Weapons': 40, Dodge: 50, Perception: 45 });
  await page.goto('/play');
  const combat = await necropede(page);
  // A Quick weapon in the ledger turns on Initiative +10.
  await expect(combat.getByRole('checkbox', { name: 'Quick 무기 +10' })).toBeChecked();
  const card = combat.getByRole('region', { name: '전투 카드' });
  await card.getByRole('button', { name: 'PC 공격', exact: true }).click();
  const line = card.locator('#' + await card.getByRole('button', { name: 'PC 공격', exact: true }).getAttribute('aria-controls'))
    .locator('.creature-attack-line');
  await expect(line).toHaveText('공격 Great Sword · D6+2 Slashing · Two-Handed +2');
  const attack = card.getByRole('region', { name: '공격 판정 해석기' });
  await expect(attack.getByRole('textbox', { name: '공격자 수치' })).toHaveValue('55');
  await expect(attack.getByRole('textbox', { name: '방어자 수치' })).toHaveValue('50');

  await choose(card, '무기', 'Mace');
  await expect(line).toHaveText('공격 Mace · D6 Bludgeoning · Speed 5');
  await expect(attack.getByRole('textbox', { name: '공격자 수치' })).toHaveValue('40');
  await expect(attack.getByRole('textbox', { name: '방어자 수치' })).toHaveValue('45');
  await expect(attack).toContainText('CS 50 − Mace Speed 5');
  await expect(attack.getByLabel('공격자 계산 수치')).toHaveText('공격자 기본 40 · 공격 기본 +10 · Mace Simple +10 = 60');
  await choose(attack, '방어 방식', 'automatic');
  const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
  await expect(damage.getByRole('combobox', { name: '피해 유형' })).toHaveValue('Bludgeoning');
  await damage.getByRole('group', { name: /Mace 피해/ }).getByRole('textbox', { name: '직접 굴린 값' }).fill('5');
  await damage.getByRole('group', { name: /Mace 피해/ }).getByRole('button', { name: '확인', exact: true }).click();
  await expect(damage.getByRole('textbox', { name: '선택 주사위' })).toHaveValue('5');
});

test('an Initiative roll waits for the Perception score and the tray says which', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await seed(page, { 'Bladed Weapons': 55 });
  await page.goto('/play');
  const combat = await necropede(page);
  const dock = page.getByRole('region', { name: '다음 행동 바로가기' });
  await expect(dock.locator('#play-jump-roll-target')).toContainText('PC Initiative');
  await expect(dock.getByRole('textbox', { name: '다음 굴림 결과 입력' })).toHaveAttribute('placeholder', '1–100');
  await dock.getByRole('textbox', { name: '다음 굴림 결과 입력' }).fill('44');
  await dock.getByRole('textbox', { name: '다음 굴림 결과 입력' }).press('Enter');
  await expect(dock.getByRole('status')).toHaveText('먼저 입력할 값 · PC 최고 Perception');
  await expect(combat.getByRole('textbox', { name: 'PC 최고 Perception' })).toBeFocused();
});

test('the journal marks every paper-sheet line with one tap', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/play');
  const combat = await necropede(page);
  await combat.getByRole('button', { name: '승리 후 전투 마치기', exact: true }).click();
  const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
  const recovery = wrap.getByRole('group', { name: '전투 후 Toughness 회복 D4', exact: true });
  await recovery.getByRole('textbox', { name: '직접 굴린 값', exact: true }).fill('3');
  await recovery.getByRole('button', { name: '확인', exact: true }).click();
  await wrap.getByRole('button', { name: '전리품', exact: true }).click();
  const loot = wrap.getByRole('group', { name: '자원 D10', exact: true });
  await loot.getByRole('textbox', { name: '직접 굴린 값', exact: true }).fill('7');
  await loot.getByRole('button', { name: '확인', exact: true }).click();
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '저널', exact: true }).click();
  const sheet = page.getByRole('group', { name: '종이 시트에 반영' });
  const boxes = sheet.getByRole('checkbox');
  expect(await boxes.count()).toBeGreaterThan(1);
  await sheet.getByRole('button', { name: '모두 반영함' }).click();
  for (const box of await boxes.all()) await expect(box).toBeChecked();
  await expect(sheet.getByRole('button', { name: '모두 반영함' })).toHaveCount(0);
});

test('phones keep the play header to one row and end the session from the menu', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto('/play');
  const header = page.locator('.play-header');
  expect((await header.boundingBox())!.height).toBeLessThan(60);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('플레이 모드');
  await page.getByRole('button', { name: '그 밖의 동작', exact: true }).click();
  await page.getByRole('button', { name: '오늘 여기까지', exact: true }).click();
  await expect(page.getByRole('region', { name: '오늘 여기까지', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
