import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';

it('creates and fills a table in its own test storage', async () => {
  await env.DB.exec('CREATE TABLE IF NOT EXISTS __isolation (id TEXT PRIMARY KEY)');
  await env.DB.prepare('INSERT INTO __isolation (id) VALUES (?)').bind('a').run();

  const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM __isolation').first<{ count: number }>();
  expect(row?.count).toBe(1);
});
