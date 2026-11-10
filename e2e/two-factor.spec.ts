import { expect, test, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, waitForHydration } from './fixtures';
import { nextStepCode, totpCode } from './totp';

let secret = '';
let backupCodes: string[] = [];

test.describe.configure({ mode: 'serial' });

const signIn = async (page: Page) => {
  if (!page.url().includes('/login')) {
    await page.goto('/login');
  }
  await waitForHydration(page);
  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
};

const openChallenge = async (page: Page) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: en['login.twoFactorTitle'] })).toBeVisible();
};

const logout = async (page: Page) => {
  await page.getByRole('button', { name: en['common.signOut'] }).click();
  await expect(page).toHaveURL(/\/login$/);
};

test('enrolls TOTP and captures backup codes', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  const banner = page.getByText(en['twoFactor.banner']);
  await expect(banner).toBeVisible();

  await page.getByRole('link', { name: en['common.settings'] }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['settings.title']);

  await page.getByLabel(en['settings.twoFactor.password'], { exact: true }).fill(E2E_ADMIN.password);
  await expect(page.getByLabel(en['settings.twoFactor.password'], { exact: true })).toHaveValue(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['settings.twoFactor.enable'] }).click();
  await expect(page.getByLabel(en['settings.twoFactor.qrLabel'])).toBeVisible({ timeout: 15_000 });
  secret = (await page.locator('#setup-secret').textContent())!.trim();

  const codeInput = page.getByLabel(en['settings.twoFactor.code']);
  await codeInput.fill(totpCode(secret));
  await codeInput.press('Enter');

  await expect(page.getByRole('heading', { name: en['settings.twoFactor.codesTitle'] })).toBeVisible({
    timeout: 15_000,
  });
  backupCodes = await page.locator('[data-testid="backup-codes"] code').allTextContents();
  expect(backupCodes).toHaveLength(10);
  await expect(page.getByText(/backup codes remaining/)).toBeVisible();
  await expect(page.getByText(en['twoFactor.banner'])).toHaveCount(0);
  await expect(page.locator('#setup-secret')).toHaveCount(0);

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: en['settings.twoFactor.copyCodes'] }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(backupCodes[0]);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: en['settings.twoFactor.downloadCodes'] }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bridgewarden-backup-codes.txt');

  await logout(page);
});

test('logs in with a backup code', async ({ page }) => {
  await openChallenge(page);
  await page.getByRole('button', { name: en['login.useBackupCode'] }).click();
  await page.getByLabel(en['login.backupCode']).fill(backupCodes[0]);
  await page.getByRole('button', { name: en['login.verifyCode'] }).click();

  await expect(page).toHaveURL(/\/app$/);
  await logout(page);
});

test('logs in with TOTP', async ({ page }) => {
  await openChallenge(page);
  await page.getByLabel(en['login.totpCode']).fill(nextStepCode(secret));
  await page.getByRole('button', { name: en['login.verifyCode'] }).click();

  await expect(page).toHaveURL(/\/app$/);
  await logout(page);
});

test('invalidates the challenge after five failures and disables 2FA', async ({ page }) => {
  await openChallenge(page);

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.getByLabel(en['login.totpCode']).fill('000000');
    await page.getByRole('button', { name: en['login.verifyCode'] }).click();
  }

  await expect(page.getByLabel(en['login.email'])).toBeVisible();
  await expect(page.getByText(en['login.challengeExpired'])).toBeVisible();

  await openChallenge(page);
  await page.getByRole('button', { name: en['login.useBackupCode'] }).click();
  await page.getByLabel(en['login.backupCode']).fill(backupCodes[1]);
  await page.getByRole('button', { name: en['login.verifyCode'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('link', { name: en['common.settings'] }).click();
  await page.getByLabel(en['settings.twoFactor.password'], { exact: true }).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['settings.twoFactor.disable'] }).click();
  await expect(page.getByRole('button', { name: en['settings.twoFactor.enable'] })).toBeVisible();
  await expect(page.getByText(en['twoFactor.banner'])).toBeVisible();

  await logout(page);
});

test('password-only login works after disabling 2FA', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
});
