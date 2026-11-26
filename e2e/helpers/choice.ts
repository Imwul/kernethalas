import { expect, type Locator, type Page } from '@playwright/test';

/** The button group of a ChoiceButtons field, found by its visible label. */
export const choiceGroup = (scope: Locator | Page, label: string) => scope.getByRole('group', { name: label, exact: true });

/** Presses the option with this value in a ChoiceButtons field (the chip version of selectOption). */
export async function choose(scope: Locator | Page, label: string, value: string) {
  const option = choiceGroup(scope, label).locator(`button[data-value="${value}"]`);
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
}

/** The value of the pressed option, for assertions that used toHaveValue on a select. */
export const chosen = (scope: Locator | Page, label: string) => choiceGroup(scope, label).locator('button[aria-pressed="true"]');
