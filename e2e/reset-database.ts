import { execFileSync } from 'node:child_process';

const persistTo = '.wrangler/e2e';

const wrangler = (args: string[], capture = false) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'pipe',
  });

const deleteSessions = () => {
  try {
    const output = wrangler(
      ['kv', 'key', 'list', '--binding', 'KV_SESSIONS', '--local', '--persist-to', persistTo],
      true,
    ).toString();
    const keys = JSON.parse(output) as { name: string }[];

    for (const key of keys) {
      wrangler([
        'kv',
        'key',
        'delete',
        '--binding',
        'KV_SESSIONS',
        '--local',
        '--persist-to',
        persistTo,
        '--key',
        key.name,
      ]);
    }
  } catch {
    // Local KV may not exist before the first test run.
  }
};

export const resetE2eDatabase = () => {
  wrangler(['d1', 'migrations', 'apply', 'bridgewarden-db', '--local', '--persist-to', persistTo]);
  wrangler([
    'd1',
    'execute',
    'bridgewarden-db',
    '--local',
    '--persist-to',
    persistTo,
    '--command',
    'DELETE FROM audit_events',
  ]);
  wrangler([
    'd1',
    'execute',
    'bridgewarden-db',
    '--local',
    '--persist-to',
    persistTo,
    '--command',
    'DELETE FROM users',
  ]);
  deleteSessions();
};
