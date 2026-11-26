import { expect, test, type Locator, type Page } from '@playwright/test';
import { openDrawer } from './helpers/play-desk';
import { choiceGroup, choose, chosen } from './helpers/choice';

async function go(page: Page, stage: string) {
  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: stage, exact: true }).click();
}

async function selectCreature(page: Page, name: string) {
  await page.goto('/play');
  await go(page, '조우·전투');
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await choose(combat, '조우 방식', 'search');
  await combat.getByRole('searchbox', { name: '생물 이름', exact: true }).fill(name);
  await combat.getByRole('button', { name, exact: true }).click();
  return combat;
}

async function roll(scope: Locator, label: string, value: string) {
  const field = scope.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('only real D100 rolls appear for undefended and automatic physical hits', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const combat = await selectCreature(page, 'Necropede');
  await combat.getByRole('button', { name: '공격 판정', exact: true }).click();
  const attack = combat.getByRole('region', { name: '공격 판정 해석기' });
  const verdict = attack.getByRole('status', { name: '공격 판정 결과' });
  await choose(attack, '방어 방식', 'unopposed');
  await expect(attack.getByRole('link', { name: '기절' })).toBeVisible();
  await attack.getByRole('textbox', { name: '공격자 수치' }).fill('60');
  await attack.getByText('공격자 기본값·보정', { exact: true }).click();
  await attack.getByRole('combobox', { name: '저장할 기술' }).selectOption('Bladed Weapons');
  await attack.getByRole('button', { name: '현재 수치를 기본값으로 저장' }).click();
  await attack.getByRole('textbox', { name: '공격자 수치' }).fill('41');
  await attack.getByRole('button', { name: 'Bladed Weapons 60 불러오기' }).click();
  await attack.getByRole('button', { name: '보정 추가' }).click();
  await attack.getByRole('textbox', { name: '보정값 1' }).fill('-5');
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('90');
  await expect(verdict).toContainText('빗나감');
  await expect(attack.getByRole('textbox', { name: '방어자 D100' })).toHaveCount(0);
  await expect(attack.getByRole('link', { name: /방어 동작/ })).toHaveCount(0);
  await attack.getByRole('textbox', { name: '공격자 D100' }).fill('33');
  await expect(verdict).toContainText('Critical Strike');
  await attack.getByRole('button', { name: '공격 교환 확정' }).click();
  await attack.getByRole('button', { name: '다음 공격', exact: true }).click();
  await expect(chosen(attack, '방어 방식')).toHaveAttribute('data-value', 'opposed');
  await expect(attack.getByRole('textbox', { name: '공격자 수치' })).toHaveValue('60');
  await expect(attack.getByRole('textbox', { name: '보정값 1' })).toHaveCount(0);

  await choose(attack, '방어 방식', 'automatic');
  await expect(attack.getByRole('link', { name: '의식 없음·수면·마비' })).toBeVisible();
  await expect(attack.getByRole('textbox', { name: /D100/ })).toHaveCount(0);
  await expect(verdict).toContainText('굴림 없이 명중');
  await attack.getByRole('button', { name: '적 명중 부위 보기' }).click();
  await openDrawer(page, '이력');
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  await expect(history.getByRole('button', { name: /D100 공격 33 · 능동 방어 불가.*수정 미리보기$/ })).toBeVisible();
  await expect(history).toContainText('기본 60 · 공격 기본 +10 · 상태·어둠 −5 = 65');
  await history.getByRole('button', { name: /판정 없음 자동 명중 수정 미리보기$/ }).click();
  await history.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(chosen(attack, '방어 방식')).toBeFocused();
  await expect(chosen(attack, '방어 방식')).toHaveAttribute('data-value', 'automatic');
});

test('area saves stay separate and apply full or rounded half damage to named targets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const combat = await selectCreature(page, 'Astral Beast');
  const card = combat.getByRole('region', { name: '전투 카드' });
  await roll(card.getByRole('region', { name: '표 굴리기', exact: true }), '직접 굴린 값', '5');
  await card.getByRole('button', { name: '여러 대상 판정' }).click();
  await card.getByRole('textbox', { name: '대상 이름 (한 줄에 하나씩)' }).fill('PC\n동료');
  await card.getByRole('button', { name: '대상 목록 적용' }).click();
  const pc = card.getByRole('region', { name: 'PC 판정과 효과', exact: true });
  const ally = card.getByRole('region', { name: '동료 판정과 효과', exact: true });
  for (const [target, value] of [[pc, '19'], [ally, '79']] as const) {
    await target.getByRole('textbox', { name: 'Spellward 수치' }).fill('50');
    await roll(target, '직접 굴린 D100', value);
  }
  await expect(pc).toContainText('피해 절반 · 올림');
  await expect(ally).toContainText('행동표의 실패 효과');
  await choose(card, '피해 주사위', 'shared');
  await roll(card.getByRole('region', { name: '공유 피해 굴림' }), '직접 굴린 값', '7');
  await expect(pc).toContainText('Arcane 피해 4 (절반 · 올림)');
  await expect(ally).toContainText('Arcane 피해 7');
  await page.reload();
  await expect(pc).toContainText('Arcane 피해 4 (절반 · 올림)');
  await expect(ally).toContainText('Arcane 피해 7');

  await choose(card, '피해 주사위', 'individual');
  await roll(pc, '직접 굴린 값', '5');
  await roll(ally, '직접 굴린 값', '6');
  await card.getByRole('button', { name: '공격 판정', exact: true }).click();
  await openDrawer(page, '이력');
  const history = page.getByRole('region', { name: '이번 장소 굴림 이력' });
  await history.getByRole('button', { name: /Spellward 판정 · PC D100 19 수정 미리보기/ }).click();
  const preview = history.getByRole('group', { name: '굴림 수정 미리보기' });
  await expect(preview).toContainText('Arcane 피해 · PC D8 5 다시 확인');
  await expect(preview).not.toContainText('Arcane 피해 · 동료');
  await preview.getByRole('button', { name: '이 굴림부터 다시 입력' }).click();
  await expect(pc.getByRole('textbox', { name: '직접 굴린 D100' })).toBeFocused();
  await expect(ally).toContainText('Arcane 피해 6');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('a bestiary handoff confirms a count and appends to the original encounter once', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const combat = await selectCreature(page, 'Necropede');
  await page.goto('/bestiary?g=overseer&q=Infernal%20Archon');
  await page.getByRole('link', { name: 'Infernal Archon 조우에 추가', exact: true }).click();
  const request = combat.getByRole('region', { name: '도감 생물을 조우에 추가' });
  await expect(request).toBeVisible();
  await expect(request).toContainText('Infernal Archon');
  await expect(combat.getByRole('heading', { name: 'Necropede', exact: true })).toBeVisible();
  const count = request.getByRole('textbox', { name: '추가할 개체 수' });
  const confirm = request.getByRole('button', { name: '조우에 추가 확정' });
  await count.fill('21');
  await expect(confirm).toBeDisabled();
  await count.fill('2');
  await confirm.click();
  const lineup = combat.getByRole('group', { name: '전투 대상', exact: true });
  await expect(lineup.getByRole('button')).toHaveText(['Necropede', 'Infernal Archon 1', 'Infernal Archon 2']);
  await expect(page).not.toHaveURL(/encounter-creature=/);
  await page.reload();
  await expect(lineup.getByRole('button')).toHaveCount(3);

  await page.goto('/ref/cr-dreadlord');
  await page.getByRole('link', { name: 'Dreadlord 조우에 추가', exact: true }).click();
  await expect(request).toContainText('Dreadlord');
  await request.getByRole('button', { name: '추가 취소' }).click();
  await expect(lineup.getByRole('button')).toHaveCount(3);
  await expect(page).not.toHaveURL(/encounter-creature=/);
});

test('a creature reference opened during play returns to the same named campaign', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.getByRole('button', { name: '플레이 캠페인 선택', exact: true }).click();
  await page.getByRole('button', { name: '새 캠페인', exact: true }).click();
  await page.getByRole('textbox', { name: '캠페인 이름' }).fill('묘지 캠페인');
  await page.getByRole('button', { name: '만들고 열기', exact: true }).click();
  await expect(page).toHaveURL(/campaign=/);
  const campaign = new URL(page.url()).searchParams.get('campaign');
  await page.getByRole('button', { name: '나중에 설정', exact: true }).click();

  await page.getByRole('button', { name: '검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '규칙 검색' });
  await search.getByRole('searchbox', { name: '검색어' }).fill('Dreadlord');
  await search.getByRole('searchbox', { name: '검색어' }).press('Enter');
  const detail = page.getByRole('dialog', { name: 'Dreadlord', exact: true });
  await detail.getByRole('link', { name: 'Dreadlord 조우에 추가', exact: true }).click();
  await expect(detail).toHaveCount(0);
  const combat = page.getByRole('region', { name: '조우와 전투 도구' });
  await expect(choiceGroup(combat, '조우 방식')).toBeVisible();
  expect(new URL(page.url()).searchParams.get('campaign')).toBe(campaign);
  await combat.getByRole('button', { name: '조우에 추가 확정' }).click();
  await expect(combat.getByRole('heading', { name: 'Dreadlord', exact: true })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('campaign')).toBe(campaign);
  await page.reload();
  await expect(combat.getByRole('heading', { name: 'Dreadlord', exact: true })).toBeVisible();
});
