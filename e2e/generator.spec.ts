import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, unlockVault } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const openGenerator = async (page: import('@playwright/test').Page) => {
  await page.goto('/app/generator');
  await signIn(page);
  await expect(page).toHaveURL(/\/app\/generator$/);
};

test('generates, toggles, copies, and persists generator options', async ({ page }) => {
  await openGenerator(page);

  const value = page.getByLabel(en['generator.value'], { exact: true });
  const first = await value.inputValue();
  expect(first.length).toBe(20);

  await page.getByRole('button', { name: en['generator.regenerate'] }).click();
  await expect(value).not.toHaveValue(first);

  await page.getByRole('checkbox', { name: en['generator.symbols'] }).click();
  await expect(value).toHaveValue(/^[A-Za-z0-9]+$/);

  await page.getByRole('tab', { name: en['generator.passphraseMode'] }).click();
  await expect(value).toHaveValue(/-/);
  await page.getByRole('combobox', { name: en['generator.separator'] }).click();
  await page.getByRole('option', { name: en['generator.separator.dot'] }).click();
  await expect(value).toHaveValue(/\./);

  await page.getByRole('button', { name: en['generator.copy'] }).click();
  await expect(page.getByText(en['generator.copied'])).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await value.inputValue());

  await page.getByRole('link', { name: en['common.settings'] }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('');
  await page.goto('/app/generator');
  await unlockVault(page);
  await page.getByRole('button', { name: en['generator.copy'] }).click();
  await page.getByRole('button', { name: en['common.lock'] }).click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('');
  await unlockVault(page);

  await page.reload();
  await unlockVault(page);
  await expect(page.getByRole('tab', { name: en['generator.passphraseMode'] })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('applies a generated password in the item editor', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.getByLabel(en['vaultItem.name']).fill('Generated login');
  await page.getByRole('button', { name: en['vaultItem.generatePassword'] }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: en['generator.dialogTitle'] })).toBeVisible();
  await page.getByRole('button', { name: en['generator.apply'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL(/\/app\/new$/);
  await expect(page.getByLabel(/^Password/)).not.toHaveValue('');
  await page.getByLabel(en['vaultItem.username']).fill('generated@example.com');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
});
