import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { signIn, waitForHydration } from './fixtures';

test('manifest exposes install metadata and valid icons', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = (await response.json()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    display?: string;
    icons?: { src: string; sizes: string; type: string }[];
  };
  expect(manifest).toMatchObject({
    name: 'Bridgewarden',
    short_name: 'Bridgewarden',
    start_url: '/app',
    display: 'standalone',
  });
  expect(manifest.icons?.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(manifest.icons?.some((icon) => icon.sizes === '512x512')).toBe(true);

  for (const icon of manifest.icons ?? []) {
    const image = await request.get(icon.src);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
  }
});

test('service worker boots the offline shell and never caches API requests', async ({ page, context }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const status = await page.evaluate(() => fetch('/api/vault').then((response) => response.status));
  expect([200, 401]).toContain(status);

  const cachedApiPaths = await page.evaluate(async () => {
    const paths: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths.filter((path) => path.startsWith('/api/'));
  });
  expect(cachedApiPaths).toEqual([]);

  await context.setOffline(true);
  await page.goto('/app').catch(() => undefined);
  await expect(page).toHaveURL(/\/offline$/);
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: en['offline.title'] })).toBeVisible();
  expect(
    await page.evaluate(() =>
      fetch('/api/vault')
        .then(() => 'resolved')
        .catch(() => 'rejected'),
    ),
  ).toBe('rejected');
  await context.setOffline(false);
});

test('shows and accepts an update prompt when a new worker is waiting', async ({ page }) => {
  await page.goto('/login');
  await waitForHydration(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await page.evaluate(() => navigator.serviceWorker.register('/sw.js?update=1'));
  await expect(page.getByText(en['pwa.updateAvailable'])).toBeVisible({ timeout: 15_000 });

  const navigation = page.waitForEvent('framenavigated');
  await page.getByRole('button', { name: en['pwa.reload'] }).click();
  await navigation;
  await expect(page).toHaveURL(/\/login$/);
});
