import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';

const pages = [{ path: '/setup', heading: en['setup.title'] }];

test('health endpoint reports ok', async ({ request }) => {
  const response = await request.get('/health');

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test('unconfigured app routes redirect to setup', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/setup$/);

  await page.goto('/app');
  await expect(page).toHaveURL(/\/setup$/);

  await page.goto('/app/trash');
  await expect(page).toHaveURL(/\/setup$/);

  await page.goto('/login');
  await expect(page).toHaveURL(/\/setup$/);
});

for (const { path, heading } of pages) {
  test(`${path} renders inside the shell`, async ({ page }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
  });
}

test('theme cookie applies the dark class after a reload', async ({ baseURL, context, page }) => {
  await context.addCookies([{ name: 'bw_theme', value: 'dark', url: baseURL! }]);

  await page.goto('/');
  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
});
