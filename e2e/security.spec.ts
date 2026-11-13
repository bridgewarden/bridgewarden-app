import { expect, test } from '@playwright/test';

import { en } from '../app/lib/i18n/en';
import { queryD1 } from './d1';
import { E2E_ADMIN, signIn, waitForHydration } from './fixtures';

const nonceFromCsp = (csp: string | null): string | null => csp?.match(/'nonce-([^']+)'/)?.[1] ?? null;

test('sets hardening headers and a unique nonce on every document', async ({ request }) => {
  const first = await request.get('/login');
  const second = await request.get('/login');
  const head = await request.head('/login');
  const csp = first.headers()['content-security-policy'];
  const nonce = nonceFromCsp(csp);

  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain("script-src 'unsafe-inline'");
  expect(csp).toContain("style-src-attr 'unsafe-inline'");
  expect(nonce).not.toBeNull();
  expect(nonceFromCsp(second.headers()['content-security-policy'])).not.toBe(nonce);
  expect(first.headers()['x-content-type-options']).toBe('nosniff');
  expect(first.headers()['referrer-policy']).toBe('no-referrer');
  expect(first.headers()['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  expect(first.headers()['cache-control']).toBe('no-store');
  expect(first.headers()['x-request-id']).toBeTruthy();
  expect(first.headers()['strict-transport-security']).toBeUndefined();
  expect(head.headers()['content-security-policy']).toContain("script-src 'self' 'nonce-");

  const html = await first.text();
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((tag) => tag.includes(`nonce="${nonce}"`))).toBe(true);
});

test('loads the document without CSP console violations', async ({ page }) => {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (/Content Security Policy|Refused to/i.test(error.message)) violations.push(error.message);
  });

  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.getByLabel(en['login.email'])).toBeVisible();
  expect(violations).toEqual([]);
});

test('rejects foreign and missing origins and keeps GET side-effect free', async ({ request }) => {
  const foreign = await request.post('/auth/logout', {
    headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
    data: {},
  });
  expect(foreign.status()).toBe(403);

  const missing = await request.post('/auth/logout', {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(missing.status()).toBe(403);

  const read = await request.get('/auth/logout');
  expect(read.status()).toBe(400);
  expect(read.headers()['set-cookie']).toBeUndefined();
});

test('vault SSR HTML contains no ciphertext or item ids and is no-store', async ({ page }) => {
  await page.goto('/login');
  await signIn(page);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const rows = queryD1<{ id: string; data_ct: string }>('SELECT id, data_ct FROM vault_items LIMIT 10');
  expect(rows.length).toBeGreaterThan(0);

  const response = await page.context().request.get('/app');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  const html = await response.text();

  for (const row of rows) {
    expect(html).not.toContain(row.data_ct);
    expect(html).not.toContain(row.id);
  }
  expect(html).not.toContain(E2E_ADMIN.password);
});
