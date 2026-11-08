import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { E2E_ADMIN, waitForHydration } from './fixtures';
import { resetE2eDatabase } from './reset-database';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => {
  resetE2eDatabase();
});

const zeros = (length: number) => Buffer.from(new Uint8Array(length)).toString('base64url');

const validPayload = () => ({
  email: E2E_ADMIN.email,
  displayName: E2E_ADMIN.displayName,
  kdfIterations: 600_000,
  kdfSalt: zeros(16),
  authHash: zeros(32),
  vaultKeyWrapped: zeros(48),
  vaultKeyWrapIv: zeros(12),
  recoveryKeyWrapped: zeros(48),
  recoveryKeyWrapIv: zeros(12),
});

test('rejects foreign origins, malformed bodies, and invalid input', async ({ baseURL, request }) => {
  const headers = { origin: baseURL!, 'content-type': 'application/json' };

  const foreign = await request.post('/setup', {
    headers: { ...headers, origin: 'https://evil.example' },
    data: validPayload(),
  });
  // React Router aborts a cross-origin action with 400 before the route action runs.
  expect(foreign.status()).toBe(400);

  const malformed = await request.post('/setup', { headers, data: 'not-json' });
  expect(malformed.status()).toBe(400);

  const invalid = await request.post('/setup', { headers, data: {} });
  expect(invalid.status()).toBe(400);
});

test('creates the first admin through the wizard and locks setup', async ({ page }) => {
  let setupRequestBody = '';
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/setup.data')) {
      setupRequestBody = request.postData() ?? '';
    }
  });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/setup');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  await page.getByLabel('Email').fill(E2E_ADMIN.email);
  await page.getByLabel('Display name').fill(E2E_ADMIN.displayName);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Master password', { exact: true }).fill(E2E_ADMIN.password);
  await page.getByLabel('Confirm master password').fill('different password');
  await page.getByRole('button', { name: 'Create keys' }).click();
  await expect(page.getByRole('alert')).toHaveText('The passwords do not match.');

  await page.getByLabel('Confirm master password').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: 'Create keys' }).click();

  const recoveryKey = (await page.locator('#setup-recovery-key').textContent())!.trim();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy' }).click();
  await expect(page.getByText('Copied to clipboard. Clear it when you are done.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(recoveryKey);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download recovery key' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('bridgewarden-recovery-key.txt');
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, 'utf8')).toContain(recoveryKey);

  expect(setupRequestBody).not.toContain(recoveryKey);
  expect(setupRequestBody).not.toContain('vaultKey');

  await page.getByLabel('Type the first 6 characters').fill(recoveryKey.replaceAll('-', '').slice(0, 6).toLowerCase());
  await page.getByRole('button', { name: 'Confirm recovery key' }).click();

  await expect(page.getByText('Enrollment is not available in this milestone.')).toBeVisible();
  await page.getByRole('button', { name: 'Finish setup' }).click();

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vault');

  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) => cookie.name === 'bw_session');
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);

  const storage = await page.evaluate(async () => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    databases: ((await indexedDB.databases?.()) ?? []).map((database) => database.name),
    cookie: document.cookie,
  }));
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
  expect(storage.databases).toEqual([]);
  expect(storage.cookie).not.toMatch(/vault|recovery/i);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vault');

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bridgewarden');

  await page.goto('/app/trash');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trash');

  await page.goto('/setup');
  await expect(page).toHaveURL(/\/app$/);
});

test('returns 409 after the first admin exists', async ({ baseURL, request }) => {
  const response = await request.post('/setup.data', {
    headers: { origin: baseURL!, 'content-type': 'application/json' },
    data: validPayload(),
    maxRedirects: 0,
  });

  expect(response.status()).toBe(409);
});
