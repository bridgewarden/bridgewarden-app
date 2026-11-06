import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';

it('does not see a table created by another test file', async () => {
  const isolation = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = '__isolation'").first();
  const migrations = await env.DB.prepare('SELECT COUNT(*) AS count FROM d1_migrations').first<{ count: number }>();

  expect(isolation).toBeNull();
  expect(migrations?.count).toBeGreaterThan(0);
});
