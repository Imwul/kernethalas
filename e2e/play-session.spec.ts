import { expect, test, type Locator } from '@playwright/test';
import { detectTrap } from './helpers/skill-roll';

async function roll(scope: Locator, label: string, value: string) {
  const field = scope.getByRole('textbox', { name: label, exact: true });
  await field.fill(value);
  await field.press('Enter');
}

test('the session card reopens a suspended door and focuses its roll offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/play');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  const explore = page.getByRole('region', { name: '장소 탐험', exact: true });
  await explore.getByRole('button', { name: '방', exact: true }).click();
  await explore.getByRole('button', { name: '종이 지도 메모', exact: true }).click();
  const map = explore.getByRole('region', { name: '종이 지도 장소 색인', exact: true });
  await map.getByRole('textbox', { name: '종이 지도 번호', exact: true }).fill('B-07');
  await map.getByRole('checkbox', { name: '잠긴 문', exact: true }).check();
  await map.getByRole('button', { name: '장소 메모 저장', exact: true }).click();
  await roll(explore.getByRole('region', { name: '긴장 주사위', exact: true }), '긴장 주사위 굴린 값', '3');
  await roll(explore.getByRole('region', { name: '조우 판정', exact: true }), '직접 굴린 값', '1');
  await roll(explore.getByRole('region', { name: '이벤트', exact: true }), '직접 굴린 값', '55');
  const actions = explore.getByRole('region', { name: '선택 탐험 행동', exact: true });
  await actions.getByRole('button', { name: '문·함정 조사', exact: true }).click();
  await actions.getByRole('combobox', { name: '조사할 대상', exact: true }).selectOption('present');
  const door = actions.getByRole('region', { name: '문 조사', exact: true });
  await detectTrap(door);
  await roll(door, '함정 여부 D10', '6');
  await roll(door, '잠김 여부 D20', '15');
  const pick = door.getByRole('group', { name: '자물쇠 따기 판정', exact: true });
  await pick.getByRole('textbox', { name: 'Thievery 수치', exact: true }).fill('55');
  await pick.getByRole('textbox', { name: '직접 굴린 D100', exact: true }).focus();

  await page.getByRole('button', { name: '오늘 여기까지', exact: true }).click();
  const editor = page.getByRole('region', { name: '오늘 여기까지', exact: true });
  await editor.getByRole('textbox', { name: '다음에 할 일 (선택)' }).fill('북쪽 철문의 자물쇠를 딴다');
  await editor.getByRole('button', { name: '이 지점에서 멈추기', exact: true }).click();

  const paused = page.getByRole('region', { name: '지난번 멈춘 곳', exact: true });
  await expect(paused).toContainText('지도 B-07');
  await expect(paused).toContainText('이어갈 입력 · 자물쇠 따기 판정');
  await page.close();

  await context.setOffline(true);
  const reopened = await context.newPage();
  await reopened.setViewportSize({ width: 320, height: 800 });
  await reopened.goto('/play');
  const resume = reopened.getByRole('region', { name: '지난번 멈춘 곳', exact: true });
  await expect(resume).toContainText('북쪽 철문의 자물쇠를 딴다');
  await resume.getByRole('button', { name: '여기서 이어하기', exact: true }).click();
  const resumed = reopened.getByRole('group', { name: '자물쇠 따기 판정', exact: true });
  const input = resumed.getByRole('textbox', { name: '직접 굴린 D100', exact: true });
  await expect(input).toBeFocused();
  await expect(resumed.getByRole('textbox', { name: 'Thievery 수치', exact: true })).toHaveValue('55');
  const reminder = reopened.getByRole('region', { name: '다음에 할 일', exact: true });
  await expect(reminder).toContainText('북쪽 철문의 자물쇠를 딴다');
  await reopened.reload();
  await expect(reminder).toContainText('북쪽 철문의 자물쇠를 딴다');
  await input.fill('31');
  await input.press('Enter');
  await expect(reopened.getByRole('region', { name: '문 조사', exact: true })).toContainText('개방 성공 · XP +10');
  await expect(resume).toBeHidden();
  expect(await reopened.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await reopened.getByRole('navigation', { name: '플레이 단계', exact: true }).getByRole('button', { name: '저널', exact: true }).click();
  await reopened.getByRole('button', { name: '다음 장소', exact: true }).click();
  await expect(reminder).toContainText('북쪽 철문의 자물쇠를 딴다');
  await reminder.getByRole('button', { name: '완료 표시', exact: true }).click();
  await reopened.reload();
  await expect(reminder).toBeHidden();
});

test('a previously saved session keeps its note when old print data is present', async ({ page }) => {
  await page.addInitScript(() => {
    const roomId = 'test-room';
    localStorage.setItem('kn-play-room-v1', JSON.stringify({ slots: {
      roomLedgerId: roomId,
      playSession: {
        pause: { roomId, at: 1700000000000, place: '지도 B-07', intent: '북쪽 철문부터 조사', facts: [], point: { stage: 'explore' } },
        pins: [{ id: 'pin-1', roomId, place: 'B-07', label: '탐지 판정', dice: 'D100', value: '32', source: 'manual' }],
      },
    } }));
  });
  await page.goto('/play');
  const paused = page.getByRole('region', { name: '지난번 멈춘 곳', exact: true });
  await expect(paused).toContainText('북쪽 철문부터 조사');
  await expect(paused.getByRole('button', { name: /인쇄/ })).toHaveCount(0);
  await paused.getByRole('button', { name: '메모 수정', exact: true }).click();
  const editor = page.getByRole('region', { name: '오늘 여기까지', exact: true });
  await expect(editor.getByRole('textbox', { name: '다음에 할 일 (선택)' })).toHaveValue('북쪽 철문부터 조사');
  await expect(editor.getByRole('button', { name: /인쇄/ })).toHaveCount(0);
  await editor.getByRole('button', { name: '이 지점에서 멈추기', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kn-play-room-v1')!).slots.playSession);
  expect(saved).toHaveProperty('pause.intent', '북쪽 철문부터 조사');
  expect(saved).not.toHaveProperty('pins');
});
