import { expect, test } from '@playwright/test';

test('rate limits repeated password failures', async ({ request }) => {
  const authHash = 'A'.repeat(43);
  const email = `abuse-${Date.now()}@example.com`;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const response = await request.post('/auth/login', {
      data: { email, authHash },
      headers: { origin: 'http://localhost:8787' },
    });
    expect([401, 423, 429]).toContain(response.status());
    if (attempt === 24) expect(response.status()).toBe(429);
  }
});
