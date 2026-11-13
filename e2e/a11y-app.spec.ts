import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { expectNoSeriousA11yViolations } from './a11y';
import { signIn, unlockVault, waitForHydration } from './fixtures';

test('core vault surfaces and dialogs are accessible', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'login');

  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { name: en['vault.title'], level: 1, exact: true })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'vault list');

  if ((await page.getByRole('listitem').count()) === 0) {
    await page.getByRole('link', { name: en['vault.newItem'] }).click();
    await page.getByLabel(en['vaultItem.name']).fill(`A11y item ${Date.now()}`);
    await page.getByLabel(en['vaultItem.username']).fill('a11y@example.com');
    await page.getByLabel(/^Password/).fill('a11y password');
    await page.getByLabel('URL 1', { exact: true }).fill('https://example.com');
    await page.getByRole('button', { name: en['vaultItem.save'] }).click();
    await expect(page).toHaveURL(/\/app$/);
  }

  const firstItem = page.getByRole('listitem').first().getByRole('button');
  await firstItem.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'item detail dialog');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(firstItem).toBeFocused();

  await page.getByRole('button', { name: en['common.lock'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'unlock');

  await page.getByLabel(en['lock.password']).fill('correct horse battery staple');
  await page.getByRole('button', { name: en['lock.submit'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeHidden();

  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await expectNoSeriousA11yViolations(page, 'item editor');

  await page.goto('/app/generator');
  await unlockVault(page);
  await expect(page.getByRole('heading', { name: en['generator.title'], level: 1 })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'generator');

  await page.context().addCookies([{ name: 'bw_theme', value: 'dark', url: 'http://localhost:8787' }]);
  await page.goto('/app');
  await unlockVault(page);
  await expect(page.getByRole('heading', { name: en['vault.title'], level: 1, exact: true })).toBeVisible();
  await expectNoSeriousA11yViolations(page, 'vault list dark');
});
