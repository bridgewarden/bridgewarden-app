import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { E2E_ADMIN, waitForHydration } from './fixtures';

const NEW_PASSWORD = 'recovered master password 789';

test('recovers the vault, burns the old key, and revokes other sessions', async ({ page, browser }) => {
  let newRecoveryKey: string | undefined;
  const recoveryKey = (await readFile('.wrangler/e2e/recovery-key.txt', 'utf8')).trim();

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  try {
    await otherPage.goto('/login');
    await waitForHydration(otherPage);
    await otherPage.getByLabel('Email').fill(E2E_ADMIN.email);
    await otherPage.getByLabel('Master password', { exact: true }).fill(E2E_ADMIN.password);
    await otherPage.getByRole('button', { name: 'Sign in' }).click();
    await expect(otherPage).toHaveURL(/\/app$/);

    await page.goto('/recover');
    await waitForHydration(page);
    await page.getByLabel('Email').fill(E2E_ADMIN.email);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByLabel('Recovery key').fill(recoveryKey);
    await page.getByLabel('New master password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Confirm new master password', { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Password reset complete')).toBeVisible({ timeout: 15_000 });
    newRecoveryKey = (await page.locator('#recover-new-key').textContent())!.trim();
    expect(newRecoveryKey).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}-[A-Z0-9]{2}$/);
    expect(newRecoveryKey).not.toBe(recoveryKey);

    await otherPage.goto('/app');
    await expect(otherPage).toHaveURL(/\/login/);

    await page.goto('/app');
    await expect(page).toHaveURL(/\/app$/);
  } finally {
    await otherContext.close();
  }

  const probe = await browser.newContext();
  const probePage = await probe.newPage();
  try {
    await probePage.goto('/recover');
    await waitForHydration(probePage);
    await probePage.getByLabel('Email').fill(E2E_ADMIN.email);
    await probePage.getByRole('button', { name: 'Continue' }).click();
    await probePage.getByLabel('Recovery key').fill(recoveryKey);
    await probePage.getByLabel('New master password', { exact: true }).fill('another master password 321');
    await probePage.getByLabel('Confirm new master password', { exact: true }).fill('another master password 321');
    await probePage.getByRole('button', { name: 'Reset password' }).click();
    await expect(probePage.getByRole('alert')).toContainText('The recovery key or new password could not be accepted.');

    await probePage.goto('/login');
    await waitForHydration(probePage);
    await probePage.getByLabel('Email').fill(E2E_ADMIN.email);
    await probePage.getByLabel('Master password', { exact: true }).fill(E2E_ADMIN.password);
    await probePage.getByRole('button', { name: 'Sign in' }).click();
    await expect(probePage.getByRole('alert')).toBeVisible();

    await probePage.getByLabel('Master password', { exact: true }).fill(NEW_PASSWORD);
    await probePage.getByRole('button', { name: 'Sign in' }).click();
    await expect(probePage).toHaveURL(/\/app$/);
  } finally {
    await probe.close();
  }

  const restore = await browser.newContext();
  const restorePage = await restore.newPage();
  try {
    await restorePage.goto('/recover');
    await waitForHydration(restorePage);
    await restorePage.getByLabel('Email').fill(E2E_ADMIN.email);
    await restorePage.getByRole('button', { name: 'Continue' }).click();
    if (!newRecoveryKey) throw new Error('new recovery key missing');
    await restorePage.getByLabel('Recovery key').fill(newRecoveryKey);
    await restorePage.getByLabel('New master password', { exact: true }).fill(E2E_ADMIN.password);
    await restorePage.getByLabel('Confirm new master password', { exact: true }).fill(E2E_ADMIN.password);
    await restorePage.getByRole('button', { name: 'Reset password' }).click();
    await expect
      .poll(
        async () =>
          (await restorePage.getByText('Password reset complete').count()) > 0 || /\/app$/.test(restorePage.url()),
      )
      .toBe(true);
  } finally {
    await restore.close();
  }
});
