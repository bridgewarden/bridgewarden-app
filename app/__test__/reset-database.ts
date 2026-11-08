import { env } from 'cloudflare:workers';

import { readConfig } from '../lib/.server/env';

const SYSTEM_TABLES = new Set(['d1_migrations']);
const SYSTEM_PREFIXES = ['_cf_'];

// D1 rejects PRAGMA foreign_keys = OFF and PRAGMA foreign_key_list with SQLITE_AUTH,
// so the order is explicit and must be extended with every table PR #6 adds.
export const DELETE_ORDER = [
  'collection_items',
  'collections',
  'org_members',
  'orgs',
  'vault_items',
  'folders',
  'backup_codes',
  'user_2fa',
  'audit_events',
  'users',
];

const quote = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

const listTables = async (): Promise<string[]> => {
  const { results } = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).all<{ name: string }>();

  return (results ?? [])
    .map((row) => row.name)
    .filter((name) => !SYSTEM_TABLES.has(name) && !SYSTEM_PREFIXES.some((prefix) => name.startsWith(prefix)));
};

export const resetDatabase = async () => {
  if (readConfig(env, 'APP_ENV') === 'production') {
    throw new Error('resetDatabase refuses to run in production');
  }

  const tables = await listTables();
  if (tables.length === 0) return;

  const known = DELETE_ORDER.filter((table) => tables.includes(table));
  const unknown = tables.filter((table) => !DELETE_ORDER.includes(table));

  for (const table of [...unknown, ...known]) {
    await env.DB.prepare(`DELETE FROM ${quote(table)}`).run();
  }
};
