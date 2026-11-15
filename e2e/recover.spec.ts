import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, waitForHydration } from './fixtures';

const NEW_PASSWORD = 'recovered master password 789';

test.describe.configure({ mode: 'serial' });

test('recovery validates back, short password, and mismatch', async ({ page }) => {
  await page.goto('/recover');
  await waitForHydration(page);
  await page.getByLabel(en['recover.email.label']).fill(E2E_ADMIN.email);
  await page.getByRole('button', { name: en['recover.email.submit'] }).click();

  await expect(page.getByRole('heading', { name: en['recover.reset.heading'], level: 2 })).toBeFocused();

  const password = page.getByLabel(en['recover.password.label'], { exact: true });
  const confirmation = page.getByLabel(en['recover.confirm.label'], { exact: true });
  await page.getByLabel(en['recover.key.label']).fill('fake-recovery-key');
  await password.fill('short');
  await confirmation.fill('different');
  await page.getByRole('button', { name: en['recover.submit'] }).click();

  await expect(page.getByText(en['password.hint'])).toBeVisible();
  await expect(page.getByRole('progressbar', { name: en['password.strength'] })).toHaveAttribute('aria-valuenow', '0');
  await expect(page.getByText(en['password.mismatch'])).toBeVisible();
  await expect(password).toBeFocused();
  await expect(page.getByRole('progressbar', { name: en['password.strength'] })).toHaveAttribute(
    'aria-valuetext',
    'Weak',
  );

  await password.fill('long enough password 123');
  await confirmation.fill('other password 123');
  await page.getByRole('button', { name: en['recover.submit'] }).click();
  await expect(confirmation).toBeFocused();
  await expect(page.getByRole('progressbar', { name: en['password.strength'] })).toHaveAttribute('aria-valuenow', '3');
  await expect(page.getByRole('progressbar', { name: en['password.strength'] })).toHaveAttribute(
    'aria-valuetext',
    'Good',
  );
  await expect(page.getByText(en['password.mismatch'])).toBeVisible();

  await page.getByRole('button', { name: en['recover.back'] }).click();
  await expect(page.getByLabel(en['recover.email.label'])).toHaveValue(E2E_ADMIN.email);
  await expect(page.getByRole('heading', { name: en['recover.email.heading'], level: 2 })).toBeFocused();
});

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
    await expect(page.getByRole('link', { name: en['common.signIn'] })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: en['recover.success.download'] }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    if (!downloadPath) throw new Error('recovery key download missing');
    const downloadedKey = await readFile(downloadPath, 'utf8');
    expect(downloadedKey).toContain(newRecoveryKey);
    expect(downloadedKey).toContain(en['recover.success.description']);
    expect(downloadedKey).toContain(en['recover.success.warning']);

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
