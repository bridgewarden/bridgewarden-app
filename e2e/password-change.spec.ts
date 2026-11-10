import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, waitForHydration } from './fixtures';

const NEW_PASSWORD = 'rotated master password 456';

test('rotates the master password and revokes the old credential', async ({ page, browser }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/login');
    await waitForHydration(otherPage);
    await otherPage.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
    await otherPage.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
    await otherPage.getByRole('button', { name: en['login.submit'] }).click();
    await expect(otherPage).toHaveURL(/\/app$/);

    await page.goto('/app/settings');
    await waitForHydration(page);
    await page.getByLabel(en['passwordChange.current']).fill(E2E_ADMIN.password);
    await page.getByLabel(en['passwordChange.new'], { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel(en['passwordChange.confirm']).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: en['passwordChange.submit'] }).click();
    await expect(page.getByText(en['passwordChange.success'])).toBeVisible({ timeout: 15_000 });

    await otherPage.goto('/app');
    await expect(otherPage).toHaveURL(/\/login/);
  } finally {
    await otherContext.close();
  }

  await page.getByRole('button', { name: en['common.signOut'] }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await page.getByLabel(en['login.password']).fill(NEW_PASSWORD);
  await page.getByRole('button', { name: en['login.submit'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/app/settings');
  await waitForHydration(page);
  await page.getByLabel(en['passwordChange.current']).fill(NEW_PASSWORD);
  await page.getByLabel(en['passwordChange.new'], { exact: true }).fill(E2E_ADMIN.password);
  await page.getByLabel(en['passwordChange.confirm']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['passwordChange.submit'] }).click();
  await expect(page.getByText(en['passwordChange.success'])).toBeVisible({ timeout: 15_000 });
});
