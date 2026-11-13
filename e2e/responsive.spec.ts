import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, unlockVault } from './fixtures';

const assertNoOverflow = async (page: import('@playwright/test').Page) => {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
    .toBe(true);
};

for (const width of [360, 768, 1024]) {
  test(`core surfaces fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/login');
    await assertNoOverflow(page);
    const loginButton = await page.getByRole('button', { name: en['login.submit'] }).boundingBox();
    expect(loginButton?.height).toBeGreaterThanOrEqual(44);
    await signIn(page);
    await expect(page).toHaveURL(/\/app$/);
    if (width === 1024) {
      await expect(page.getByRole('link', { name: en['trash.title'] }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: en['common.settings'] }).first()).toBeVisible();
    }
    if (width === 360) {
      const menu = page.getByRole('button', { name: en['common.menu'] });
      const box = await menu.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      await menu.click();
      await expect(page.getByRole('menuitem', { name: en['trash.title'] })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await assertNoOverflow(page);

    const name = `Responsive ${width}`;
    await page.getByRole('link', { name: en['vault.newItem'] }).click();
    await page.getByLabel(en['vaultItem.name']).fill(name);
    await assertNoOverflow(page);
    const saveButton = await page.getByRole('button', { name: en['vaultItem.save'] }).boundingBox();
    expect(saveButton?.height).toBeGreaterThanOrEqual(44);
    await page.getByLabel(en['vaultItem.username']).fill('responsive@example.com');
    await page.getByLabel(/^Password/).fill('responsive password');
    await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
    await page.getByRole('button', { name: en['vaultItem.save'] }).click();
    await expect(page).toHaveURL(/\/app$/);

    await page.goto('/app/generator');
    await unlockVault(page);
    await assertNoOverflow(page);
    const copyButton = await page.getByRole('button', { name: en['generator.copy'] }).boundingBox();
    expect(copyButton?.height).toBeGreaterThanOrEqual(44);
    await page.goto('/app/trash');
    await unlockVault(page);
    await assertNoOverflow(page);
    await page.goto('/app/settings');
    await unlockVault(page);
    await assertNoOverflow(page);
  });
}

test('shows generic sync errors and the global offline banner', async ({ context, page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.route(/\/api\/vault/, (route) => route.fulfill({ status: 500, body: 'raw server failure' }));
  await page.reload();
  await unlockVault(page);
  await expect(page.getByText(en['vault.syncError'])).toBeVisible();
  await expect(page.getByText('raw server failure')).toBeHidden();

  await context.setOffline(true);
  await expect(page.getByText(en['common.offline'])).toBeVisible({ timeout: 15_000 });
  await context.setOffline(false);
  await expect(page.getByText(en['common.offline'])).toBeHidden();
});

test('renders the 404 boundary with safe navigation', async ({ page }) => {
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: en['errors.notFound.title'] })).toBeVisible();
  await expect(page.getByRole('link', { name: en['common.backToVault'] })).toBeVisible();
});
