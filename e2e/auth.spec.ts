import { expect, test, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { E2E_ADMIN, unlockVault, waitForHydration } from './fixtures';

test.describe.configure({ mode: 'serial' });

const signIn = async (page: Page) => {
  await waitForHydration(page);
  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
};

test('unauthenticated home redirects to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?next=%2F$/);
  await expect(page.getByRole('button', { name: en['common.lock'] })).toBeDisabled();
});

test('unauthenticated app access returns to the requested path after login', async ({ page }) => {
  await page.goto('/app/trash?x=1');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByLabel(en['login.email'])).toBeVisible();

  await signIn(page);

  await expect(page).toHaveURL(/\/app\/trash\?x=1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['trash.title']);
});

test('login unlocks the app, redirects an authenticated visit, and logout revokes', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['vault.title']);
  await expect(page.getByText(E2E_ADMIN.displayName)).toBeVisible();

  const session = (await page.context().cookies()).find((cookie) => cookie.name === 'bw_session');
  expect(session).toBeDefined();
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');

  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage).toEqual({ local: [], session: [] });

  await page.goto('/login?next=%2Fapp%2Ftrash');
  await expect(page).toHaveURL(/\/app\/trash$/);
  await unlockVault(page);

  await page.getByRole('button', { name: en['common.signOut'] }).click();
  await expect(page).toHaveURL(/\/login$/);

  await expect
    .poll(async () => page.evaluate(async () => (await indexedDB.databases?.())?.map((db) => db.name) ?? []))
    .not.toContain('bridgewarden-vault');

  await page.goto('/app');
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('manual lock requires the master password and sign out revokes the session', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole('button', { name: en['common.lock'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await expect(page.getByLabel(en['lock.password'])).toBeFocused();
  await expect(page.getByRole('heading', { name: en['vault.title'], exact: true })).toHaveCount(0);
  await page.getByLabel(en['lock.password']).fill('wrong password');
  await page.getByRole('button', { name: en['lock.submit'] }).click();
  await expect(page.getByRole('alert')).toHaveText(en['lock.invalid']);
  await expect(page.getByLabel(en['lock.password'])).toBeFocused();

  await page.getByLabel(en['lock.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['lock.submit'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeHidden();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(en['vault.title']);

  await page.getByRole('button', { name: en['common.lock'] }).click();
  await page.getByRole('dialog').getByRole('button', { name: en['lock.signOut'] }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('five failed local unlocks force sign out', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('button', { name: en['common.lock'] }).click();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.getByLabel(en['lock.password']).fill('wrong password');
    await page.getByRole('button', { name: en['lock.submit'] }).click();
  }

  await expect(page).toHaveURL(/\/login$/);
});

test('unsafe next targets fall back to the app root', async ({ page }) => {
  await page.goto('/login?next=%2F%2Fevil.example');
  await signIn(page);

  await expect(page).toHaveURL(/\/app$/);
});
