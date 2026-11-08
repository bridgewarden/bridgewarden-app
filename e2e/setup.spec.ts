import { expect, test } from '@playwright/test';

import { getBootstrapToken } from './bootstrap-token';
import { resetE2eDatabase } from './reset-database';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => {
  resetE2eDatabase();
});
test.afterAll(() => {
  resetE2eDatabase();
});

const zeros = (length: number) => Buffer.from(new Uint8Array(length)).toString('base64url');

const validPayload = (token: string) => ({
  token,
  email: 'admin@example.com',
  displayName: 'Administrator',
  kdfIterations: 600_000,
  kdfSalt: zeros(16),
  authHash: zeros(32),
  vaultKeyWrapped: zeros(48),
  vaultKeyWrapIv: zeros(12),
  recoveryKeyWrapped: zeros(48),
  recoveryKeyWrapIv: zeros(12),
});

test('rejects foreign origins, malformed bodies, and wrong tokens', async ({ baseURL, request }) => {
  const token = getBootstrapToken();
  const headers = { origin: baseURL!, 'content-type': 'application/json' };

  const foreign = await request.post('/setup', {
    headers: { ...headers, origin: 'https://evil.example' },
    data: validPayload(token),
  });
  // React Router aborts a cross-origin action with 400 before the route action runs.
  expect(foreign.status()).toBe(400);

  const malformed = await request.post('/setup', { headers, data: 'not-json' });
  expect(malformed.status()).toBe(400);

  const invalid = await request.post('/setup', { headers, data: { token } });
  expect(invalid.status()).toBe(400);

  const wrongToken = await request.post('/setup', {
    headers,
    data: validPayload(`${token}-wrong`),
  });
  expect(wrongToken.status()).toBe(403);
});

test('creates the first admin through the wizard and locks setup', async ({ page }) => {
  const token = getBootstrapToken();
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/setup');
  await page.waitForFunction(() => {
    const button = document.querySelector('button');

    return Boolean(button && Object.keys(button).some((key) => key.startsWith('__reactProps')));
  });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toHaveText('The bootstrap token is missing or incorrect.');
  await expect(page.getByLabel('Bootstrap token')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Bootstrap token').fill(token);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();

  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Display name').fill('Administrator');
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Master password').fill('correct horse battery staple');
  await page.getByRole('button', { name: 'Create keys' }).click();

  const recoveryKey = (await page.locator('#setup-recovery-key').textContent())!.trim();
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

  await page.goto('/setup');
  await expect(page).toHaveURL(/\/login$/);
});

test('returns 409 after the first admin exists', async ({ baseURL, request }) => {
  const token = getBootstrapToken();
  const response = await request.post('/setup.data', {
    headers: { origin: baseURL!, 'content-type': 'application/json' },
    data: validPayload(token),
    maxRedirects: 0,
  });

  expect(response.status()).toBe(409);
});
