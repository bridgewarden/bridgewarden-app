import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';

test('login LCP stays under 2.5s on throttled 4G', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __lcp?: number }).__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        (window as unknown as { __lcp?: number }).__lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: en['login.title'] })).toBeVisible();
  await page.waitForLoadState('load');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const lcp = await page.evaluate(() => (window as unknown as { __lcp?: number }).__lcp ?? 0);

  console.log(`login LCP on throttled 4G: ${lcp.toFixed(0)}ms`);
  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(2500);
});
