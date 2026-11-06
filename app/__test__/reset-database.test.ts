import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, inject, it } from 'vitest';

import { DELETE_ORDER, resetDatabase } from './reset-database';

describe('resetDatabase', () => {
  afterEach(async () => {
    await resetDatabase();
  });

  it('covers every table created by migrations', () => {
    const missing = inject('schemaTables').filter((table) => !DELETE_ORDER.includes(table));

    expect(missing).toEqual([]);
  });

  it('is a no-op on an empty user schema', async () => {
    await expect(resetDatabase()).resolves.toBeUndefined();
  });

  it('empties user tables without dropping them', async () => {
    await env.DB.exec('CREATE TABLE IF NOT EXISTS __probe (id TEXT PRIMARY KEY)');
    await env.DB.prepare('INSERT INTO __probe (id) VALUES (?)').bind('a').run();

    await resetDatabase();

    const row = await env.DB.prepare('SELECT COUNT(*) AS count FROM __probe').first<{ count: number }>();
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE name = '__probe'").first();

    expect(row?.count).toBe(0);
    expect(table).toBeTruthy();
  });
});
