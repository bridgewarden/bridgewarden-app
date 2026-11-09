import { expect, test } from '@playwright/test';

import { E2E_ADMIN } from './fixtures';

test('repeated password failures are rejected by rate limit or lockout', async ({ request }) => {
  const authHash = 'A'.repeat(43);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request.post('/auth/login', {
      data: { email: E2E_ADMIN.email, authHash },
      headers: { origin: 'http://localhost:8787' },
    });
    expect(response.status()).toBe(401);
  }

  const locked = await request.post('/auth/login', {
    data: { email: E2E_ADMIN.email, authHash },
    headers: { origin: 'http://localhost:8787' },
  });
  expect(locked.status()).toBe(423);
  expect(Number(locked.headers()['retry-after'])).toBeGreaterThan(0);
});
