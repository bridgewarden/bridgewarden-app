import { expect, type Page } from '@playwright/test';

import { en } from '../app/lib/i18n/en';

export const E2E_ADMIN = {
  email: 'admin@example.com',
  displayName: 'Administrator',
  password: 'correct horse battery staple',
};

export const E2E_MEMBER = {
  email: 'member@example.com',
  password: 'member master password 123',
};

export const waitForHydration = async (page: Page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() =>
    Boolean((window as unknown as { __reactRouterContext?: unknown }).__reactRouterContext),
  );
};

export const signIn = async (page: Page) => {
  await waitForHydration(page);
  await page.getByLabel(en['login.email']).fill(E2E_ADMIN.email);
  await page.getByLabel(en['login.password']).fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: en['login.submit'] }).click();
};

export const unlockVault = async (page: Page, password = E2E_ADMIN.password) => {
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeVisible();
  await page.getByLabel(en['lock.password']).fill(password);
  await page.getByRole('button', { name: en['lock.submit'] }).click();
  await expect(page.getByRole('heading', { name: en['lock.title'] })).toBeHidden();
};

export const toBase64Url = (value: string) => value.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

export const openNewItem = async (page: Page) => {
  await page.getByRole('link', { name: en['vault.newItem'] }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
};
