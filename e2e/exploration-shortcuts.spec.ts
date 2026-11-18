import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 800 } });

test('an exploration shortcut opens related rolls without leaving the selected step', async ({ page }) => {
  const route = '/atlas/p-explore-room?view=list&node=shape';
  await page.goto(route);
  const tray = page.getByRole('region', { name: '탐험 바로가기' });
  const encounter = tray.getByRole('link', { name: /^조우 판정/ });
  await expect(tray.getByRole('link', { name: /이벤트.*조우가 없는 새 방/ })).toBeVisible();

  await encounter.click();
  const check = page.getByRole('dialog', { name: '조우 판정' });
  const input = check.getByRole('textbox', { name: '직접 굴린 값' });
  const submit = check.getByRole('button', { name: '확인', exact: true });

  await input.fill('9');
  await submit.click();
  await expect(check.getByRole('link', { name: /이벤트/ })).toBeVisible();

  await input.fill('12');
  await submit.click();
  await expect(check.getByRole('link', { name: /이벤트/ })).toHaveCount(0);
  await check.getByRole('link', { name: /전투 조우.*표 선택/ }).click();
  const table = page.getByRole('dialog', { name: '전투 조우 — 표 선택' });
  await expect(table).toBeVisible();
  await table.getByRole('button', { name: /조우 판정/ }).click();
  await expect(check.getByRole('status')).toContainText('12');
  await check.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(page).toHaveURL(route);
  await expect(encounter).toBeFocused();
});

test('Tension dice show the next die and only open Growing Darkness on demand', async ({ page }) => {
  await page.addInitScript(() => {
    // D8 → 2, D6 → 2, D4 → 3, D4 → 2.
    const draws = [0x2000_0000, 0x3000_0000, 0x8000_0000, 0x4000_0000];
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (array) => {
      if (array instanceof Uint32Array && array.length === 1 && draws.length > 0) {
        array[0] = draws.shift()!;
        return array;
      }
      return getRandomValues(array);
    };
  });
  await page.goto('/atlas/p-explore-room');
  const tray = page.getByRole('region', { name: '탐험 바로가기' });
  const tension = tray.getByRole('button', { name: /^긴장 주사위/ });
  await tension.click();
  const rolls = tray.getByRole('group', { name: '긴장 주사위 굴리기' });
  const result = tray.getByRole('status');
  const darkness = tray.getByRole('link', { name: '짙어지는 어둠 표 열기' });
  await expect(result).toBeEmpty();
  await expect(tray.getByRole('link', { name: '짙어지는 어둠 규칙' })).toBeVisible();
  for (const [die, value, next] of [[8, 2, 6], [6, 2, 4], [4, 3, 4]]) {
    await rolls.getByRole('button', { name: `D${die} 굴리기` }).click();
    await expect(result).toContainText(new RegExp(`D${die} 결과\\s*${value}\\s*다음 긴장 주사위 D${next}`));
    await expect(darkness).toHaveCount(0);
  }

  await rolls.getByRole('button', { name: 'D4 굴리기' }).click();
  await expect(result).toContainText(/D4 결과\s*2/);
  await expect(result).toContainText('표를 굴린 뒤 다음 긴장 주사위 D8');
  const table = page.getByRole('dialog', { name: '짙어지는 어둠' });
  await expect(table).toHaveCount(0);
  await darkness.click();
  await expect(table.getByRole('status')).toContainText('굴리기 버튼을 누르거나 직접 굴린 값을 입력하세요');
  await table.getByRole('button', { name: '참고 패널 닫기' }).click();
  await expect(result).toContainText('다음 긴장 주사위 D8');
  await expect(darkness).toBeFocused();

  await page.reload();
  await tension.click();
  await expect(result).toBeEmpty();
});
