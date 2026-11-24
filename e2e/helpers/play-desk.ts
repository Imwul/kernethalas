import { expect, type Locator, type Page } from '@playwright/test';

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Opens one of the play desk's tool strips (탐험 행동, 전투 진행 도구, 종이 지도 …) by its label. */
export async function openPane(scope: Locator | Page, label: string) {
  const button = scope.getByRole('button', { name: new RegExp(`^${escape(label)}(?:\\s|$)`) }).first();
  if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  return button;
}

/** Opens a pane of the side drawer (이력, 장비, 상태, 보류, 도메인, 저장, 도구) and returns the drawer. */
export async function openDrawer(page: Page, label: string) {
  const drawer = page.locator('#play-drawer');
  const tray = page.getByRole('group', { name: '플레이 서랍' });
  const direct = tray.getByRole('button', { name: new RegExp(`^${escape(label)}(?:\\s|$)`) });
  if (await direct.isVisible()) {
    if (await direct.getAttribute('aria-expanded') !== 'true') await direct.click();
  } else {
    if (!await drawer.isVisible()) await tray.getByRole('button', { name: /^장부/ }).click();
    const tab = drawer.getByRole('group', { name: '서랍 항목' }).getByRole('button', { name: new RegExp(`^${escape(label)}(?:\\s|$)`) });
    if (await tab.getAttribute('aria-pressed') !== 'true') await tab.click();
  }
  await expect(drawer).toBeVisible();
  return drawer;
}

/** Sets a switch in the 보기 popover (실물 입력 우선, 집중 보기, 화면 켜 두기). */
export async function setViewOption(page: Page, name: string, on: boolean) {
  const trigger = page.getByRole('button', { name: '보기 설정', exact: true });
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const toggle = page.getByRole('group', { name: '보기 설정' }).getByRole('button', { name, exact: true });
  if ((await toggle.getAttribute('aria-pressed') === 'true') !== on) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', String(on));
  await page.keyboard.press('Escape');
  return toggle;
}

/** Closes the side drawer (on narrow screens it covers the stage). */
export async function closeDrawer(page: Page) {
  const drawer = page.locator('#play-drawer');
  if (await drawer.isVisible()) await drawer.getByRole('button', { name: '서랍 닫기' }).click();
  await expect(drawer).toBeHidden();
}
