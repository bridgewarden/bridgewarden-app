import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, unlockVault } from './fixtures';

test('creates, filters, opens, and retains an item across lock', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const firstItem = page.getByRole('button', { name: en['vault.createFirst'] });
  if ((await firstItem.count()) > 0) await firstItem.click();
  else await page.getByRole('button', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vault.name']).fill('E2E Login');
  await page.getByRole('button', { name: en['vault.create'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /E2E Login/ })).toBeVisible();

  await page.getByLabel(en['vault.type']).selectOption('note');
  await expect(page.getByText(en['vault.noMatches'])).toBeVisible();
  await page.getByLabel(en['vault.type']).selectOption('login');
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

  await page.getByRole('button', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vault.name']).fill('E2E Note');
  await page.getByRole('dialog').getByLabel(en['vault.type']).selectOption('note');
  await page.getByRole('button', { name: en['vault.create'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByLabel(en['vault.type']).selectOption('note');
  await expect(page.getByRole('button', { name: /E2E Note/ })).toBeVisible();
  await page.getByRole('button', { name: /E2E Note/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByText(en['vault.detail.body'])).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('queues an offline create and flushes when the connection returns', async ({ context, page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  await context.setOffline(true);
  await page.getByRole('button', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vault.name']).fill('Offline Item');
  await page.getByRole('button', { name: en['vault.create'] }).click();
  await expect(page.getByRole('button', { name: /Offline Item/ })).toBeVisible();

  const flushed = page.waitForResponse((response) => response.url().endsWith('/api/vault/items'));
  await context.setOffline(false);
  await flushed;
  await page.reload();
  await unlockVault(page);
  await expect(page.getByRole('button', { name: /Offline Item/ })).toBeVisible();
});
