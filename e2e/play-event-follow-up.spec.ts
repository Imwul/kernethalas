import { expect, test, type Locator } from '@playwright/test';
import { openDrawer, openPane } from './helpers/play-desk';
import { detectTrap, skillRoll } from './helpers/skill-roll';

async function physical(locator: Locator, name: string, value: string) {
  const input = locator.getByRole('textbox', { name, exact: true });
  await input.fill(value);
  await input.press('Enter');
}

test('exploration converts physical event and darkness follow-up rolls into paper deltas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await explore.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('4');
  await physical(explore, '긴장 주사위 굴린 값', '2');
  await physical(explore.getByRole('region', { name: '짙어지는 어둠', exact: true }), '직접 굴린 값', '53');

  const darkness = explore.getByRole('region', { name: '짙어지는 어둠 후속 판정' });
  await darkness.getByRole('textbox', { name: 'Endurance 수치' }).fill('45');
  await physical(darkness, '직접 굴린 D100', '80');
  const damage = darkness.getByRole('group', { name: '받는 피해 3D4' });
  await physical(damage, '직접 굴린 값', '4 2 1');
  await expect(damage.getByRole('status')).toContainText('Poison 피해 7');

  await physical(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  await physical(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '59');
  const spring = explore.getByRole('group', { name: 'Exhaustion 감소 D4' });
  await physical(spring, '직접 굴린 값', '3');
  await expect(spring.getByRole('status')).toContainText('Exhaustion −3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal.getByRole('checkbox', { name: 'Poison 피해 7' })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: 'Exhaustion −3' })).toBeVisible();
  await page.reload();
  await expect(journal.getByRole('checkbox', { name: 'Exhaustion −3' })).toBeVisible();
  await page.getByRole('button', { name: '직전 굴림 되돌리기' }).click();
  await expect(journal.getByRole('checkbox', { name: 'Exhaustion −3' })).toHaveCount(0);
  await expect(journal.getByRole('checkbox', { name: 'Poison 피해 7' })).toBeVisible();
});

test('force and deep-search darkness follow-ups stay independent after archiving a door and reloading', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  const entry = explore.getByRole('region', { name: '긴장 주사위', exact: true });
  await entry.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('6');
  await physical(entry, '긴장 주사위 굴린 값', '2');
  const actions = explore.getByRole('region', { name: '선택 탐험 행동' });
  await openPane(actions, '문·함정 조사');
  await actions.getByRole('combobox', { name: '조사할 대상' }).selectOption('present');
  const door = actions.getByRole('region', { name: '문 조사' });
  await detectTrap(door);
  await physical(door, '함정 여부 D10', '6');
  await physical(door, '잠김 여부 D20', '15');
  await door.getByLabel('개방 방법').selectOption('force');
  await skillRoll(door, '강제 개방 판정', 'Athletics', 50, 38);
  const force = door.getByRole('region', { name: '강제 개방 긴장 굴림' });
  const warning = page.getByRole('region', { name: '이동 전에 마칠 판정', exact: true });
  await page.getByRole('button', { name: '저널', exact: true }).click();
  await page.getByRole('button', { name: '다음 장소', exact: true }).click();
  await expect(warning).toBeFocused();
  await expect(page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '저널', exact: true }))
    .toHaveAttribute('aria-current', 'step');
  await warning.getByRole('button', { name: '문 강제 개방 · 긴장 주사위', exact: true }).click();
  await expect(force.getByRole('textbox', { name: '긴장 주사위 굴린 값', exact: true })).toBeFocused();
  await physical(force, '긴장 주사위 굴린 값', '2');
  const forceDarkness = force.getByRole('region', { name: '행동 후 짙어지는 어둠' });
  const domain = await openDrawer(page, '도메인');
  await domain.getByRole('button', { name: '새 도메인', exact: true }).click();
  await domain.getByRole('button', { name: 'D8로 새 도메인 시작', exact: true }).click();
  await expect(warning).toBeFocused();
  await warning.getByRole('button', { name: '문 강제 개방 · 짙어지는 어둠 D100', exact: true }).click();
  await expect(forceDarkness.getByRole('textbox', { name: '직접 굴린 값', exact: true })).toBeFocused();
  await physical(forceDarkness, '직접 굴린 값', '67');
  await force.getByRole('button', { name: '어둠 후속 판정으로' }).click();
  await expect(actions.getByRole('heading', { name: '강제 개방 · D100 67' })).toBeFocused();
  const light = actions.getByRole('group', { name: '광원 감소 D4' });
  await physical(light, '직접 굴린 값', '3');
  await expect(light.getByRole('status')).toContainText('광원 −3');
  await physical(forceDarkness, '직접 굴린 값', '67');
  await expect(light.getByRole('status')).toHaveCount(0);
  await physical(light, '직접 굴린 값', '3');
  await actions.getByRole('button', { name: '다른 문 조사', exact: true }).click();

  await openPane(actions, '깊은 수색');
  await actions.getByRole('button', { name: '깊은 수색 시작' }).click();
  const deep = actions.getByRole('region', { name: '깊은 수색 긴장 굴림' });
  await expect(deep.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('8');
  await deep.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('4');
  await physical(deep, '긴장 주사위 굴린 값', '2');
  await physical(deep.getByRole('region', { name: '행동 후 짙어지는 어둠' }), '직접 굴린 값', '9');
  await physical(actions.getByRole('group', { name: '최대 Aether 감소 D4' }), '직접 굴린 값', '2');
  await page.getByRole('button', { name: '저널', exact: true }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록' });
  await expect(journal.getByRole('checkbox', { name: '광원 −3', exact: true })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: '최대 Aether −2', exact: true })).toBeVisible();
  await page.reload();
  await expect(journal.getByRole('checkbox', { name: '광원 −3', exact: true })).toBeVisible();
  await expect(journal.getByRole('checkbox', { name: '최대 Aether −2', exact: true })).toBeVisible();
});

test('only a started deep search blocks leaving, and each required input returns to its own field', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    if (localStorage.getItem('kn-play-room-v1')) return;
    localStorage.setItem('kn-play-room-v1', JSON.stringify({ slots: { domains: [{
      id: 1, name: '', overseerRoll: null, defeated: false, influence: { roll: null, damageRoll: null }, extra: {}, darkness: [],
      retreats: [{ id: 'legacy', place: '이전 묘실', kind: 'encounter', creatureIds: ['cr-necropede'] }],
    }] }, undo: [], history: [] }));
  });
  await page.goto('/play');
  const stage = (name: string) => page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name, exact: true });
  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  const warning = page.getByRole('region', { name: '이동 전에 마칠 판정', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await physical(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  const actions = explore.getByRole('region', { name: '선택 탐험 행동', exact: true });
  await openPane(actions, '깊은 수색');
  await stage('저널').click();
  await expect(warning).toHaveCount(0);
  await stage('탐험').click();
  await actions.getByRole('button', { name: '깊은 수색 시작', exact: true }).click();
  await page.getByRole('button', { name: '이전 묘실 재진입', exact: true }).click();
  const pending = warning.getByRole('button', { name: '깊은 수색 · 긴장 주사위', exact: true });
  await pending.click();
  const deep = actions.getByRole('region', { name: '깊은 수색 긴장 굴림', exact: true });
  await expect(deep.getByRole('textbox', { name: '긴장 주사위 굴린 값', exact: true })).toBeFocused();
  await deep.getByRole('combobox', { name: '긴장 주사위 크기', exact: true }).selectOption('4');
  await physical(deep, '긴장 주사위 굴린 값', '2');

  await stage('저널').click();
  await page.reload();
  const next = page.getByRole('button', { name: '다음 장소', exact: true });
  await next.click();
  await warning.getByRole('button', { name: '깊은 수색 · 짙어지는 어둠 D100', exact: true }).click();
  const dark = deep.getByRole('region', { name: '행동 후 짙어지는 어둠', exact: true });
  await expect(dark.getByRole('textbox', { name: '직접 굴린 값', exact: true })).toBeFocused();
  await physical(dark, '직접 굴린 값', '9');

  await stage('저널').click();
  await next.click();
  await warning.getByRole('button', { name: '깊은 수색 · 최대 Aether 감소 D4', exact: true }).click();
  const aether = actions.getByRole('group', { name: '최대 Aether 감소 D4', exact: true });
  await expect(aether.getByRole('textbox', { name: '직접 굴린 값', exact: true })).toBeFocused();
  await physical(aether, '직접 굴린 값', '2');
  await stage('저널').click();
  await expect(warning).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: '최대 Aether −2', exact: true })).toBeVisible();
  await next.click();
  await expect(stage('탐험')).toHaveAttribute('aria-current', 'step');
  await expect(actions.getByRole('region', { name: '깊은 수색 긴장 굴림', exact: true })).toHaveCount(0);
});
