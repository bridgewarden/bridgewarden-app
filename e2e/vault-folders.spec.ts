import { expect, test, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { queryD1 } from './d1';
import { E2E_ADMIN, openNewItem, signIn, toBase64Url, unlockVault } from './fixtures';

type FolderRow = {
  id: string;
  name_ct: string;
  name_iv: string;
  data_version: number;
  rev: number;
};

const createFolder = async (page: Page, name: string) => {
  await page.getByRole('combobox', { name: en['vault.folder'] }).click();
  await page.getByRole('option', { name: en['vaultItem.folderNewOption'] }).click();
  await page.getByLabel(en['vaultItem.folderName']).fill(name);
  await page.getByRole('button', { name: en['vaultItem.folderCreate'] }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('combobox', { name: en['vault.folder'] })).toContainText(name);
};

const openFolderFilter = async (page: Page) => {
  await page.getByRole('combobox', { name: en['vault.folder'] }).click();
};

test('renames and deletes folders through the authenticated API', async ({ page, baseURL }) => {
  test.setTimeout(60_000);
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const first = `Folder A ${Date.now()}`;
  const second = `Folder B ${Date.now()}`;
  const secondItem = `Second folder item ${Date.now()}`;

  await openNewItem(page);
  await createFolder(page, first);
  await page.getByRole('link', { name: en['vaultItem.back'] }).click();
  const discard = page.getByRole('button', { name: en['vaultItem.unsavedLeave'] });
  await expect(discard).toBeVisible();
  await discard.click();
  await expect(page).toHaveURL(/\/app$/);

  await openNewItem(page);
  await createFolder(page, second);
  await page.getByLabel(en['vaultItem.name']).fill(secondItem);
  await page.getByLabel(en['vaultItem.username']).fill('folders@example.com');
  await page.getByLabel(/^Password/).fill('folder password');
  await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
  await page.getByRole('button', { name: en['vaultItem.save'] }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('button', { name: new RegExp(secondItem) })).toContainText(second);

  const [folderB, folderA] = queryD1<FolderRow>(
    `SELECT id, name_ct, name_iv, data_version, rev FROM folders WHERE user_id = (SELECT id FROM users WHERE email = '${E2E_ADMIN.email}') AND deleted_at IS NULL ORDER BY rowid DESC LIMIT 2`,
  );
  if (!folderA || !folderB) throw new Error('expected two folders');
  const folderRows = queryD1<{ name_ct: string }>(
    `SELECT name_ct FROM folders WHERE user_id = (SELECT id FROM users WHERE email = '${E2E_ADMIN.email}')`,
  );
  for (const row of folderRows) {
    const bytes = Buffer.from(row.name_ct, 'base64').toString('utf8');
    expect(bytes).not.toContain(first);
    expect(bytes).not.toContain(second);
  }

  const rename = await page.request.patch(`/api/folders/${folderA.id}`, {
    headers: { origin: baseURL! },
    data: {
      nameCt: toBase64Url(folderB.name_ct),
      nameIv: toBase64Url(folderB.name_iv),
      dataVersion: folderB.data_version,
      rev: folderA.rev,
    },
  });
  expect(rename.status()).toBe(200);

  await page.reload();
  await unlockVault(page);
  await openFolderFilter(page);
  await expect(page.getByRole('option', { name: second, exact: true })).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);

  const remove = await page.request.delete(`/api/folders/${folderB.id}`, {
    headers: { origin: baseURL! },
  });
  expect(remove.status()).toBe(200);

  await page.reload();
  await unlockVault(page);
  await openFolderFilter(page);
  await expect(page.getByRole('option', { name: second, exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  const secondRow = page.getByRole('button', { name: new RegExp(secondItem) });
  await expect(secondRow).toBeVisible();
  await expect(secondRow).not.toContainText(second);
  const detached = queryD1<{ count: number }>(
    `SELECT COUNT(*) AS count FROM vault_items WHERE user_id = (SELECT id FROM users WHERE email = '${E2E_ADMIN.email}') AND folder_id = '${folderB.id}'`,
  );
  expect(detached[0]?.count).toBe(0);
});
