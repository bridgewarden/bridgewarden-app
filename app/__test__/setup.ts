import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { inject } from 'vitest';

const stripComments = (query: string) =>
  query
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '')
    .trim();

const migrations = inject('d1Migrations').map((migration) => ({
  ...migration,
  queries: migration.queries.filter((query) => stripComments(query) !== ''),
}));

await applyD1Migrations(env.DB, migrations);
