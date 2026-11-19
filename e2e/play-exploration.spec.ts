import { expect, test, type Locator } from '@playwright/test';
import { detectTrap, skillRoll } from './helpers/skill-roll';

async function enterRoll(section: Locator, value: string) {
  await section.getByRole('textbox', { name: '직접 굴린 값', exact: true }).fill(value);
  await section.getByRole('button', { name: '확인', exact: true }).click();
}

test('physical shape and Tension rolls guide a room event and a later revisit at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
  const shape = exploration.getByRole('region', { name: '방·통로 모양' });
  const tension = exploration.getByRole('region', { name: '긴장 주사위', exact: true });
  const darkness = exploration.getByRole('region', { name: '짙어지는 어둠' });
  const encounter = exploration.getByRole('region', { name: '조우 판정' });
  const event = exploration.getByRole('region', { name: '이벤트', exact: true });

  await enterRoll(shape, '00');
  await expect(shape.getByRole('status')).toContainText('방 · 출입구');
  await expect(exploration.getByRole('link', { name: '광원 1 소모' })).toBeVisible();
  await tension.getByRole('combobox', { name: '긴장 주사위 크기' }).selectOption('4');
  const manual = tension.getByRole('textbox', { name: '긴장 주사위 굴린 값' });
  const submit = tension.getByRole('button', { name: '긴장 주사위 확인' });
  await manual.fill('5');
  await submit.click();
  await expect(tension.getByRole('alert')).toHaveText('1에서 4 사이의 정수를 입력하세요.');
  await manual.fill('2');
  await submit.click();
  await expect(tension.getByRole('status')).toContainText('다음 긴장 주사위 D8');
  await expect(encounter).toHaveCount(0);
  await enterRoll(darkness, '69');
  await expect(darkness.getByRole('status')).toContainText('방에 들어갈 때마다 광원 1 대신 2 소모');
  await enterRoll(encounter, '9');
  await enterRoll(event, '59');
  await expect(event.getByRole('status')).toContainText('고요한 샘');
  await expect(page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '탐험' })).toHaveAttribute('aria-current', 'step');

  await exploration.getByRole('group', { name: '방문 구분' }).getByRole('button', { name: '재방문', exact: true }).click();
  await expect(exploration.getByRole('link', { name: '광원 1 소모' })).toBeVisible();
  await expect(shape).toHaveCount(0);
  await expect(encounter).toHaveCount(0);
  await expect(event).toHaveCount(0);
  await expect(exploration.getByRole('button', { name: '정리로', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await enterRoll(darkness, '37');
  await expect(darkness.getByRole('status')).toContainText('매복!');
  await expect(encounter).toHaveCount(0);
  await expect(exploration.getByRole('button', { name: '정리로', exact: true })).toHaveCount(0);
  await exploration.getByRole('button', { name: '매복 조우로', exact: true }).click();
  await expect(page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '조우·전투' })).toHaveAttribute('aria-current', 'step');
});

test('door noise and deep search pass the resolved Tension die into each action', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  const exploration = page.getByRole('region', { name: '장소 탐험', exact: true });
  await exploration.getByRole('button', { name: '방', exact: true }).click();
  const entry = exploration.getByRole('region', { name: '긴장 주사위', exact: true });
  await entry.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('2');
  await entry.getByRole('button', { name: '긴장 주사위 확인' }).click();
  await enterRoll(exploration.getByRole('region', { name: '조우 판정', exact: true }), '9');
  await enterRoll(exploration.getByRole('region', { name: '이벤트', exact: true }), '59');
  const actions = exploration.getByRole('region', { name: '선택 탐험 행동' });

  await actions.getByText('문·함정 조사', { exact: true }).click();
  await enterRoll(actions.getByRole('region', { name: '문이 있는가?', exact: true }), '2');
  const door = actions.getByRole('region', { name: '문 조사' });
  await detectTrap(door);
  await door.getByLabel('함정 여부 D10', { exact: true }).fill('6');
  await door.getByRole('button', { name: '함정 여부 D10 확인', exact: true }).click();
  await door.getByLabel('잠김 여부 D20', { exact: true }).fill('15');
  await door.getByRole('button', { name: '잠김 여부 D20 확인', exact: true }).click();
  await door.getByLabel('개방 방법').selectOption('force');
  await skillRoll(door, '강제 개방 판정', 'Athletics', 50, 38);
  const noise = door.getByRole('region', { name: '강제 개방 긴장 굴림' });
  await expect(noise.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('6');
  await expect(door.getByText('개방 성공 · XP +10', { exact: true })).toHaveCount(0);
  await noise.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('2');
  await noise.getByRole('button', { name: '긴장 주사위 확인' }).click();
  await expect(door.getByText('개방 성공 · XP +10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '직전 굴림 되돌리기', exact: true }).click();
  await expect(door.getByText('개방 성공 · XP +10', { exact: true })).toHaveCount(0);
  await expect(noise.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('6');
  await noise.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('2');
  await noise.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).press('Enter');
  await expect(door.getByText('개방 성공 · XP +10', { exact: true })).toBeVisible();
  await actions.getByRole('button', { name: '다른 문 조사', exact: true }).click();
  await enterRoll(actions.getByRole('region', { name: '문이 있는가?', exact: true }), '9');

  await actions.getByText('방 뒤지기', { exact: true }).click();
  const scavenge = actions.getByRole('region', { name: '방 뒤지기 판정' });
  await scavenge.getByRole('textbox', { name: '보정 Scavenge Skill' }).fill('55');
  await scavenge.getByRole('textbox', { name: 'Scavenge D100' }).fill('31');
  await scavenge.getByRole('button', { name: '뒤지기 판정 확인' }).click();
  await enterRoll(scavenge.getByRole('group', { name: '뒤지기 결과 D20' }), '13');
  await enterRoll(scavenge.getByRole('group', { name: 'Cooking Ingredients 수량 D4' }), '2');

  await actions.getByText('깊은 수색', { exact: true }).click();
  await actions.getByRole('button', { name: '깊은 수색 시작' }).click();
  const deep = actions.getByRole('region', { name: '깊은 수색 긴장 굴림' });
  await expect(deep.getByRole('combobox', { name: '긴장 주사위 크기' })).toHaveValue('4');
  await deep.getByRole('textbox', { name: '긴장 주사위 굴린 값' }).fill('3');
  await deep.getByRole('button', { name: '긴장 주사위 확인' }).click();
  const container = actions.getByRole('region', { name: '용기 조사' });
  await detectTrap(container);
  await container.getByLabel('함정 여부 D10', { exact: true }).fill('6');
  await container.getByRole('button', { name: '함정 여부 D10 확인', exact: true }).click();
  await container.getByLabel('잠김 여부 D20', { exact: true }).fill('3');
  await container.getByRole('button', { name: '잠김 여부 D20 확인', exact: true }).click();
  await expect(actions.getByRole('region', { name: '숨은 용기 내용물' })).toHaveCount(0);
  await container.getByRole('button', { name: '용기 열기', exact: true }).click();
  await enterRoll(actions.getByRole('region', { name: '숨은 용기 내용물' }), '6');
  await enterRoll(actions.getByRole('group', { name: '용기 전리품 D20' }), '3');
  await enterRoll(actions.getByRole('group', { name: 'Crafting Supplies 수량 D4' }), '4');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByRole('navigation', { name: '플레이 단계' }).getByRole('button', { name: '저널' }).click();
  const journal = page.getByRole('region', { name: '이번 장소 기록', exact: true });
  await expect(journal).toContainText('Cooking Ingredients +2');
  await expect(journal).toContainText(/Crafting Supplies.*4/);
  await expect(journal).toContainText('Exhaustion +2');
  await expect(journal).toContainText('다음 긴장 주사위 D4');
  const paper = journal.getByRole('group', { name: '종이 시트에 반영' });
  await expect(paper.getByRole('checkbox', { name: 'XP +10', exact: true })).toBeVisible();
  await expect(paper.getByRole('checkbox', { name: '광원 −1', exact: true })).toBeVisible();
  await page.reload();
  await expect(journal).toContainText('문 2 · 문 없음');
  await expect(journal).toContainText('Cooking Ingredients +2');
  await expect(journal).toContainText(/Crafting Supplies.*4/);
  await expect(journal).toContainText('다음 긴장 주사위 D4');
  await expect(paper.getByRole('checkbox', { name: 'XP +10', exact: true })).toBeVisible();
});
