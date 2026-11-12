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
  await expect(page).toHaveURL(/\/login\?next=%2Fapp$/);
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

test('idle auto-lock fires at the configured timeout and activity postpones it', async ({ page }) => {
  await page.clock.install();
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['common.settings'] }).click();
  await expect(page.getByRole('heading', { name: en['settings.title'] })).toBeVisible();

  const timeout = page.getByRole('combobox', { name: en['settings.autoLock.minutes'] });
  await expect(timeout).toHaveText(en['settings.autoLock.minutes.15']);
  await timeout.click();
  await page.getByRole('option', { name: en['settings.autoLock.minutes.1'] }).click();

  await page.clock.fastForward(30_000);
  await page.keyboard.press('Tab');
  await page.clock.fastForward(30_000);
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeHidden();
  await page.clock.fastForward(31_000);
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await expect(page.getByRole('heading', { name: en['settings.title'] })).toHaveCount(0);

  await unlockVault(page);
  await expect(page.getByRole('heading', { name: en['settings.title'] })).toBeVisible();
});

test('enabling hide-lock locks immediately when the tab becomes hidden', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['common.settings'] }).click();
  await page.getByRole('checkbox', { name: en['settings.autoLock.hide'] }).click();

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
});

test('auto-lock settings persist across reload and hide-lock defaults off', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole('link', { name: en['common.settings'] }).click();

  const timeout = page.getByRole('combobox', { name: en['settings.autoLock.minutes'] });
  await timeout.click();
  await page.getByRole('option', { name: en['settings.autoLock.minutes.30'] }).click();
  const hide = page.getByRole('checkbox', { name: en['settings.autoLock.hide'] });
  await expect(hide).not.toBeChecked();
  await hide.click();

  await expect
    .poll(() =>
      page.evaluate(() => ({
        minutes: localStorage.getItem('bw_auto_lock_minutes'),
        hide: localStorage.getItem('bw_lock_on_hide'),
      })),
    )
    .toEqual({ minutes: '30', hide: 'true' });

  await page.reload();
  await unlockVault(page);
  await page.getByRole('link', { name: en['common.settings'] }).click();
  await expect(page.getByRole('combobox', { name: en['settings.autoLock.minutes'] })).toHaveText(
    en['settings.autoLock.minutes.30'],
  );
  await expect(page.getByRole('checkbox', { name: en['settings.autoLock.hide'] })).toBeChecked();

  await page.getByRole('button', { name: en['common.signOut'] }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        minutes: localStorage.getItem('bw_auto_lock_minutes'),
        hide: localStorage.getItem('bw_lock_on_hide'),
      })),
    )
    .toEqual({ minutes: null, hide: null });
});

test('locking one tab locks sibling tabs in the same context', async ({ context, page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);

  const second = await context.newPage();
  try {
    await second.goto('/app');
    await unlockVault(second);
    await expect(second.getByRole('heading', { level: 1 })).toHaveText(en['vault.title']);

    await page.getByRole('button', { name: en['common.lock'] }).click();
    await expect(second.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  } finally {
    await second.close();
  }
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

test('failed logout still locks and wipes local vault state', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  let intercepted = false;
  await page.route(/\/auth\/logout/, async (route) => {
    intercepted = true;
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.abort();
  });

  await page.getByRole('button', { name: en['common.signOut'] }).click();

  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await expect.poll(() => intercepted).toBe(true);
  await expect(page.getByText(en['common.signOutFailed'])).toBeVisible();
  await expect(page).toHaveURL(/\/app$/);
  await expect
    .poll(async () => page.evaluate(async () => (await indexedDB.databases?.())?.map((db) => db.name) ?? []))
    .not.toContain('bridgewarden-vault');
  await page.unroute(/\/auth\/logout/);
});
