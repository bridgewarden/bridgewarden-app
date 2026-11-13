import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, unlockVault } from './fixtures';

const createLogin = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByLabel(en['vaultItem.username']).fill(`${name}@example.com`);
  await page.getByLabel(/^Password/).fill('trash password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
};

const trashItem = async (page: import('@playwright/test').Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(name) }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: en['vault.edit'] }).click();
  await page.getByRole('button', { name: en['vaultItem.delete'] }).click();
  await page.getByRole('button', { name: en['vaultItem.deleteConfirm'] }).click();
  await expect(page).toHaveURL(/\/app$/);
};

test('restores and purges items from trash', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const name = `Trash ${Date.now()}`;
  await createLogin(page, name);
  await trashItem(page, name);

  await page.getByRole('link', { name: en['trash.title'] }).click();
  await expect(page).toHaveURL(/\/app\/trash$/);
  const trashRow = page.getByRole('listitem').filter({ hasText: name });
  await expect(trashRow).toBeVisible();
  await trashRow.getByRole('button', { name: en['trash.restore'] }).click();
  await expect(trashRow).toBeHidden();

  await page.goto('/app');
  await unlockVault(page);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await trashItem(page, name);
  await page.goto('/app/trash');
  await unlockVault(page);
  const purgeRow = page.getByRole('listitem').filter({ hasText: name });
  await purgeRow.getByRole('button', { name: en['trash.purge'] }).click();
  await page.getByRole('button', { name: en['trash.purgeConfirm'] }).click();
  await expect(page.getByText(en['trash.empty.title'])).toBeVisible();

  await page.getByRole('button', { name: en['common.lock'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
});

test('requires the exact item name when trash is large', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const names = Array.from({ length: 6 }, (_, index) => `Bulk trash ${Date.now()}-${index}`);
  for (const name of names) {
    await createLogin(page, name);
    await trashItem(page, name);
  }

  await page.goto('/app/trash');
  await unlockVault(page);
  await expect(page.getByRole('listitem')).toHaveCount(6);
  const firstRow = page.getByRole('listitem').first();
  const firstName = (await firstRow.locator('p').first().innerText()).trim();
  await firstRow.getByRole('button', { name: en['trash.purge'] }).click();
  const dialog = page.getByRole('alertdialog');
  const confirm = dialog.getByRole('button', { name: en['trash.purgeConfirm'] });
  await expect(confirm).toBeDisabled();
  await page.getByLabel(en['trash.purgeName']).fill('wrong name');
  await expect(confirm).toBeDisabled();
  await page.getByLabel(en['trash.purgeName']).fill(firstName);
  await expect(confirm).toBeEnabled();
  await page.getByRole('button', { name: en['common.close'] }).click();
  await expect(page.getByRole('listitem')).toHaveCount(6);
  await firstRow.getByRole('button', { name: en['trash.purge'] }).click();
  await page.getByLabel(en['trash.purgeName']).fill(firstName);
  await dialog.getByRole('button', { name: en['trash.purgeConfirm'] }).click();
  await expect(page.getByRole('listitem')).toHaveCount(5);
});
