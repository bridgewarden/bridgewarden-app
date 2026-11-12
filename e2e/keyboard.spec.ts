import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, waitForHydration } from './fixtures';

const typeInto = async (page: import('@playwright/test').Page, label: string | RegExp, value: string) => {
  const field = label === 'URL 1' ? page.getByRole('textbox', { name: 'URL 1', exact: true }) : page.getByLabel(label);
  await field.focus();
  await page.keyboard.type(value);
};

test('keyboard-only create, lock, and unlock', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);

  await typeInto(page, en['login.email'], E2E_ADMIN.email);
  await typeInto(page, en['login.password'], E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('link', { name: en['vault.newItem'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/new$/);

  const name = `Keyboard ${Date.now()}`;
  await typeInto(page, en['vaultItem.name'], name);
  await typeInto(page, en['vaultItem.username'], 'keyboard@example.com');
  await typeInto(page, /^Password/, 'keyboard password');
  await typeInto(page, 'URL 1', 'https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();

  await page.getByRole('button', { name: en['common.lock'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await expect(page.getByLabel(en['lock.password'])).toBeFocused();

  await typeInto(page, en['lock.password'], E2E_ADMIN.password);
  await page.getByRole('button', { name: en['lock.submit'] }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeHidden();
  await expect(page.getByRole('heading', { name: en['vault.title'], level: 1, exact: true })).toBeVisible();
});
