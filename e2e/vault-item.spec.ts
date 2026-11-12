import { expect, test, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { totpCode } from './totp';
import { queryD1 } from './d1';
import { signIn, unlockVault } from './fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const openCreate = async (page: Page) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
};

const openItem = async (page: Page, name: string) => {
  await page.getByRole('button', { name: new RegExp(name) }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: en['vault.edit'] }).click();
  await expect(page).toHaveURL(/\/app\/edit\/[0-9a-f-]+$/);
};

const createLogin = async (page: Page, name: string) => {
  await openCreate(page);
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByLabel(en['vaultItem.username']).fill('helper@example.com');
  await page.getByLabel(/^Password/).fill('helper password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
};

test('creates and edits a login without plaintext reaching D1', async ({ page }) => {
  const name = `Login ${Date.now()}`;
  const password = 'editor-secret-password';
  const username = 'editor-user@example.com';
  const totp = 'JBSWY3DPEHPK3PXP';

  await openCreate(page);
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByLabel(en['vaultItem.username']).fill(username);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByLabel(en['vaultItem.totpSecret'], { exact: true }).fill(totp);
  await page.getByRole('button', { name: en['vaultItem.addField'] }).click();
  await page.getByLabel('Label 1', { exact: true }).fill('PIN');
  await page.getByLabel('Value 1', { exact: true }).fill('9876');
  await page.getByLabel('Hidden value 1', { exact: true }).click();
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();

  const rows = queryD1<{ data_ct: string }>('SELECT data_ct FROM vault_items');
  const stored = rows.map((row) => row.data_ct).join('\n');
  for (const plaintext of [name, username, password, totp, '9876', 'https://example.com']) {
    expect(stored).not.toContain(plaintext);
  }

  await page.reload();
  await unlockVault(page);
  await openItem(page, name);
  const html = await (await page.request.get(page.url())).text();
  expect(html).not.toContain(name);
  expect(html).not.toContain(password);
  await expect(page.getByLabel(en['vaultItem.username'])).toHaveValue(username);
  await expect(page.getByLabel(/^Password/)).toHaveValue(password);
  await expect(page.getByLabel(en['vaultItem.totpSecret'], { exact: true })).toHaveValue(totp);
  await expect(page.getByLabel('Value 1', { exact: true })).toHaveValue('9876');

  await page.getByLabel(en['vaultItem.username']).fill('updated@example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: /updated@example\.com/ })).toBeVisible();
});

test('saves a 50KB note and blocks an oversized body', async ({ page }) => {
  const name = `Note ${Date.now()}`;
  const body = 'A'.repeat(50 * 1024);

  await openCreate(page);
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await page.getByLabel(en['vaultItem.body']).fill(body);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  const rows = queryD1<{ data_ct: string }>('SELECT data_ct FROM vault_items');
  expect(rows.map((row) => row.data_ct).join('\n')).not.toContain(body.slice(0, 64));

  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await openItem(page, name);
  await expect(page.getByLabel(en['vaultItem.body'])).toHaveValue(body);

  await page.getByRole('link', { name: en['vaultItem.back'] }).click();
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill(`${name} big`);
  await page.getByRole('combobox', { name: en['vault.type'] }).click();
  await page.getByRole('option', { name: en['vault.type.note'] }).click();
  await page.getByLabel(en['vaultItem.body']).fill('B'.repeat(50 * 1024 + 1));
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page.getByText(en['vaultItem.error.noteTooLarge'])).toBeVisible();
  await expect(page).toHaveURL(/\/app\/new$/);
});

test('blocks empty required login fields', async ({ page }) => {
  await openCreate(page);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();

  await expect(page.getByText(en['vaultItem.error.nameRequired'])).toBeVisible();
  await expect(page.getByText(en['vaultItem.error.usernameRequired'])).toBeVisible();
  await expect(page.getByText(en['vaultItem.error.passwordRequired'])).toBeVisible();
  await expect(page.getByText(en['vaultItem.error.urlsRequired'])).toBeVisible();
  await expect(page.getByLabel(en['vaultItem.name'])).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(en['vaultItem.username'])).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel(/^Password/)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('URL 1', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/app\/new$/);
});

test('creates a folder from the item editor', async ({ page }) => {
  await openCreate(page);
  await page.getByRole('combobox', { name: en['vault.folder'] }).click();
  await page.getByRole('option', { name: en['vaultItem.folderNewOption'] }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: en['vaultItem.folderDialogTitle'] }),
  ).toBeVisible();
  await page.getByLabel(en['vaultItem.folderName']).fill('Work');
  await page.getByRole('button', { name: en['vaultItem.folderCreate'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('combobox', { name: en['vault.folder'] })).toContainText('Work');

  const name = `Folder item ${Date.now()}`;
  await page.getByLabel(en['vaultItem.name']).fill(name);
  await page.getByLabel(en['vaultItem.username']).fill('folder@example.com');
  await page.getByLabel(/^Password/).fill('folder password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: /Folder item/ })).toContainText('Work');
});

test('guards unsaved changes and restores a deleted item', async ({ page }) => {
  const name = `Trash ${Date.now()}`;
  await createLogin(page, name);
  await openItem(page, name);
  await page.getByLabel(en['vaultItem.name']).fill(`${name} changed`);
  expect(await page.evaluate(() => !window.dispatchEvent(new Event('beforeunload', { cancelable: true })))).toBe(true);
  await page.getByRole('link', { name: en['vaultItem.back'] }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: en['vaultItem.unsavedStay'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill(name);

  await page.getByRole('button', { name: en['vaultItem.delete'] }).click();
  await page.getByRole('button', { name: en['vaultItem.deleteConfirm'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
  await page.getByRole('button', { name: en['vaultItem.undo'] }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
});

test('resolves stale updates by copy and reload', async ({ page, browser }) => {
  const name = `Conflict ${Date.now()}`;
  await createLogin(page, name);
  await openItem(page, name);
  const itemUrl = page.url();

  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await second.goto('/login');
  await signIn(second);
  await expect(second).toHaveURL(/\/app$/);
  await second.goto(itemUrl);
  await unlockVault(second);
  await expect(second.getByLabel(en['vaultItem.name'])).toHaveValue(name);
  await second.waitForLoadState('networkidle');

  await page.getByLabel(en['vaultItem.name']).fill(`${name} A`);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await second.getByLabel(en['vaultItem.name']).fill(`${name} B`);
  await second.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(second.getByRole('alertdialog')).toBeVisible();
  await second.getByRole('button', { name: en['vaultItem.conflictCopy'] }).click();
  await expect(second).toHaveURL(/\/app$/);
  await expect(second.getByRole('button', { name: new RegExp(`${name} A`) })).toBeVisible();
  await expect(second.getByRole('button', { name: new RegExp(`${name} B`) })).toBeVisible();

  await second.getByRole('button', { name: new RegExp(`${name} A`) }).focus();
  await second.keyboard.press('Enter');
  await second.getByRole('link', { name: en['vault.edit'] }).click();
  await expect(second.getByLabel(en['vaultItem.name'])).toHaveValue(`${name} A`);
  await page.getByRole('button', { name: new RegExp(`${name} A`) }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: en['vault.edit'] }).click();

  await page.getByLabel(en['vaultItem.name']).fill(`${name} C`);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await second.getByLabel(en['vaultItem.name']).fill(`${name} D`);
  await second.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(second.getByRole('alertdialog')).toBeVisible();
  await second.getByRole('button', { name: en['vaultItem.conflictReload'] }).click();
  await expect(second.getByLabel(en['vaultItem.name'])).toHaveValue(`${name} C`);
  await secondContext.close();
});

test('renders an item TOTP and hides revealed passwords on timeout', async ({ page }) => {
  const fixedNow = new Date('2026-01-01T00:00:00Z');
  const secret = 'JBSWY3DPEHPK3PXP';
  const expected = totpCode(secret, Math.floor(fixedNow.getTime() / 30_000));

  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await page.getByLabel(en['vaultItem.name']).fill('TOTP login');
  await page.getByLabel(en['vaultItem.username']).fill('totp@example.com');
  await page.getByLabel(/^Password/).fill('totp-password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByLabel(en['vaultItem.totpSecret'], { exact: true }).fill(secret);
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.clock.install({ time: fixedNow });
  await page.getByRole('button', { name: /TOTP login/ }).focus();
  await page.keyboard.press('Enter');
  const code = page.getByRole('dialog').getByText(`${expected.slice(0, 3)} ${expected.slice(3)}`);
  await expect(code).toBeVisible();
  const copyTotpLabel = en['vault.detail.copyField'].replace('{field}', en['vault.detail.totp']);
  await page.getByRole('button', { name: copyTotpLabel }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);

  await page.getByRole('button', { name: en['vaultItem.showPassword'] }).click();
  await expect(page.getByRole('dialog').getByText('totp-password')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByRole('dialog').getByText('totp-password')).toBeHidden();

  await page.getByRole('button', { name: en['vaultItem.showPassword'] }).click();
  await expect(page.getByRole('dialog').getByText('totp-password')).toBeVisible();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('dialog').getByText('totp-password')).toBeHidden();
  await expect
    .poll(
      async () =>
        (await page
          .getByRole('dialog')
          .getByText(/\d{3} \d{3}/)
          .textContent()) ?? '',
    )
    .not.toBe(`${expected.slice(0, 3)} ${expected.slice(3)}`);
});
