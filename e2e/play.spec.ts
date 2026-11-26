import { expect, test, type Locator } from '@playwright/test';

async function manualRoll(scope: Locator, value: string) {
  await scope.getByRole('textbox', { name: '직접 굴린 값', exact: true }).fill(value);
  await scope.getByRole('button', { name: '확인', exact: true }).click();
}

for (const { width, height } of [{ width: 320, height: 800 }, { width: 3440, height: 1440 }]) {
  test(`plays a room with physical dice and writes the journal at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.getByRole('link', { name: '플레이 시작', exact: true }).click();
    const stages = page.getByRole('navigation', { name: '플레이 단계' });
    const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
    await exploration.getByRole('group', { name: '장소 종류' }).getByRole('button', { name: '방', exact: true }).click();

    const tension = exploration.getByRole('region', { name: '긴장 주사위', exact: true });
    await tension.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('6');
    await tension.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('2');
    await tension.getByRole('button', { name: '긴장 주사위 확인' }).click();
    // the finished tension roll folds to its one-line result
    await expect(tension.getByRole('button', { name: /^D6 2 · 다음 D4 다시 보기$/ })).toBeVisible();
    await manualRoll(exploration.getByRole('region', { name: '조우 판정', exact: true }), '12');
    await expect(stages.getByRole('button', { name: '탐험', exact: true })).toHaveAttribute('aria-current', 'step');
    await exploration.getByRole('button', { name: '조우 표로', exact: true }).click();
    const combat = page.getByRole('region', { name: '조우와 전투 도구' });
    await combat.getByRole('textbox', { name: 'D6 결과', exact: true }).fill('4');
    await combat.getByRole('button', { name: 'D6 확인', exact: true }).click();
    await combat.getByRole('textbox', { name: 'D20 결과', exact: true }).fill('2');
    await combat.getByRole('button', { name: '생물 선택', exact: true }).click();
    await expect(combat.getByRole('heading', { name: 'Necropede' })).toBeVisible();

    const card = combat.getByRole('region', { name: '전투 카드' });
    await card.getByRole('button', { name: '공격 판정', exact: true }).click();
    const attack = card.getByRole('region', { name: '공격 판정 해석기' });
    await attack.getByRole('textbox', { name: '공격자 수치' }).fill('55');
    await attack.getByRole('textbox', { name: '공격자 D100' }).fill('31');
    await attack.getByRole('textbox', { name: '방어자 D100' }).fill('79');
    await attack.getByRole('button', { name: '적 명중 부위 보기' }).click();
    await manualRoll(card, '20');
    await card.getByRole('button', { name: '이 부위로 피해 계산' }).click();
    const damage = card.getByRole('region', { name: '피해 계산기', exact: true });
    await damage.getByRole('textbox', { name: '선택 주사위' }).fill('4');
    await damage.getByRole('combobox', { name: '피해 유형' }).selectOption('Piercing');
    await expect(damage.getByRole('status')).toHaveText('최종 피해 6 Piercing');
    const damageRef = damage.getByRole('link', { name: '피해 유형', exact: true });
    const placed = await damage.boundingBox();
    await damageRef.click();
    const dialog = page.getByRole('dialog', { name: '피해 유형', exact: true });
    await expect(dialog).toBeVisible();
    if (width === 3440 && placed) {
      const rect = (await damage.boundingBox())!;
      expect(rect.x).toBeCloseTo(placed.x);
      expect(rect.x + rect.width).toBeLessThan((await dialog.boundingBox())!.x);
    }
    await dialog.getByRole('button', { name: '참고 패널 닫기' }).click();
    await expect(damageRef).toBeFocused();

    await stages.getByRole('button', { name: '탐험', exact: true }).click();
    // the finished tension roll folds to its one-line result
    await expect(tension.getByRole('button', { name: /^D6 2 · 다음 D4 다시 보기$/ })).toBeVisible();
    await stages.getByRole('button', { name: '조우·전투', exact: true }).click();
    await expect(damage.getByRole('status')).toHaveText('최종 피해 6 Piercing');
    await combat.getByRole('button', { name: '승리 후 전투 마치기', exact: true }).click();
    const wrap = page.getByRole('region', { name: '휴식과 전리품 정리' });
    // A finished fight opens on its after-fight steps first, then loot.
    await expect(wrap.getByRole('button', { name: '전투 종료', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await manualRoll(wrap.getByRole('group', { name: '전투 후 Toughness 회복 D4', exact: true }), '3');
    await wrap.getByRole('button', { name: '전리품', exact: true }).click();
    await manualRoll(wrap.getByRole('group', { name: '자원 D10', exact: true }), '7');
    await page.getByRole('button', { name: '저널 기록 보기', exact: true }).click();

    const journal = page.getByRole('region', { name: '이번 장소 기록', exact: true });
    await journal.getByRole('textbox', { name: '장소 이름 (선택)' }).fill('지하 묘실');
    await expect(journal).toContainText('지하 묘실 · 방');
    await expect(journal).toContainText('Necropede · 승리');
    await expect(journal).toContainText('전투 후 Toughness +3');
    await expect(journal).toContainText('Crafting Supplies 1');
    await expect(journal).toContainText('다음 긴장 주사위 D4');
    await expect(page).toHaveURL('/play');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    if (width === 320) {
      await stages.getByRole('button', { name: '조우·전투', exact: true }).click();
      await expect(combat.getByRole('button', { name: '조우 다시 선택', exact: true })).toHaveCount(0);
      await combat.getByRole('button', { name: '새 조우 시작', exact: true }).click();
      await combat.getByRole('combobox', { name: '조우 방식', exact: true }).selectOption('t-encounter-b');
      await combat.getByRole('textbox', { name: 'D20 결과', exact: true }).fill('2');
      await combat.getByRole('button', { name: '생물 선택', exact: true }).click();
      await combat.getByRole('button', { name: '전투만 마치기', exact: true }).click();
      await wrap.getByRole('button', { name: '전리품', exact: true }).click();
      await expect(wrap.getByRole('combobox', { name: '전리품 표' })).toBeVisible();
      await expect(wrap.getByRole('combobox', { name: '전리품 표' }).getByRole('option', { name: 'Necropede 처치 보상' })).toHaveCount(0);
      await stages.getByRole('button', { name: '조우·전투', exact: true }).click();
      await combat.getByRole('button', { name: '전투 결과 수정', exact: true }).click();
      await combat.getByRole('button', { name: '결과 수정 확정', exact: true }).click();
      await page.getByRole('button', { name: '저널 기록 보기', exact: true }).click();
      await expect(journal).toContainText('전투 후 Toughness +3');
      await expect(journal).toContainText('Crafting Supplies 1');
    }

    await page.getByRole('button', { name: '이번 장소 지우기', exact: true }).click();
    await page.getByRole('button', { name: '지우고 새로 시작', exact: true }).click();
    await expect(exploration.getByRole('region', { name: '방·통로 모양' })).toBeVisible();
    await stages.getByRole('button', { name: '저널', exact: true }).click();
    await expect(journal.getByRole('button', { name: '장소 기록 복사' })).toHaveCount(0);
  });
}
