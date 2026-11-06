import { env } from 'cloudflare:workers';
import { describe, expect, it, inject } from 'vitest';

describe('test database migrations', () => {
  it('applies every repository migration', async () => {
    const expected = inject('d1Migrations')
      .map((migration) => migration.name)
      .sort();

    const { results } = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{ name: string }>();

    expect((results ?? []).map((row) => row.name)).toEqual(expected);
  });
});
