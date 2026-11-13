import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, unlockVault } from './fixtures';

test('creates, filters, opens, and retains an item across lock', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const firstItem = page.getByRole('link', { name: en['vault.createFirst'] });
  if ((await firstItem.count()) > 0) await firstItem.click();
  else await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.getByLabel(en['vaultItem.name']).fill('E2E Login');
  await page.getByLabel(en['vaultItem.username']).fill('e2e@example.com');
  await page.getByLabel(/^Password/).fill('e2e password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: /E2E Login/ })).toBeVisible();

  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await expect(page.getByText(en['vault.noMatches'])).toBeVisible();
  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.login'] }).click();
  await expect(page.getByRole('button', { name: /E2E Login/ })).toBeVisible();

  await page.getByRole('button', { name: /E2E Login/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'E2E Login' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: en['common.lock'] }).click();
  await unlockVault(page);
  await expect(page.getByRole('button', { name: /E2E Login/ })).toBeVisible();
});

test('creates a note and stays usable at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.getByLabel(en['vaultItem.name']).fill('E2E Note');
  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await page.getByLabel(en['vaultItem.body']).fill('Note body');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await expect(page.getByRole('button', { name: /E2E Note/ })).toBeVisible();
  await page.getByRole('button', { name: /E2E Note/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByText(en['vault.detail.body'], { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('queues an offline create and flushes when the connection returns', async ({ context, page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.getByLabel(en['vaultItem.name']).fill('Offline Item');
  await page.getByLabel(en['vaultItem.username']).fill('offline@example.com');
  await page.getByLabel(/^Password/).fill('offline password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page.getByText(en['vaultItem.savedOffline'])).toBeVisible();
  await expect(page).toHaveURL(/\/app\/new$/);

  const flushed = page.waitForResponse((response) => response.url().endsWith('/api/vault/items'));
  await context.setOffline(false);
  await flushed;
  await page.getByRole('link', { name: en['vaultItem.back'] }).click();
  await expect(page.getByRole('button', { name: /Offline Item/ })).toBeVisible();
  await page.reload();
  await unlockVault(page);
  await expect(page.getByRole('button', { name: /Offline Item/ })).toBeVisible();
});
