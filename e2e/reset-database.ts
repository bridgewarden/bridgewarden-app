import { execFileSync } from 'node:child_process';

import { SETUP_STATE_KEY } from '../app/constants/setup-state';

const persistTo = '.wrangler/e2e';

const wrangler = (args: string[], capture = false) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'pipe',
  });

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
    'DELETE FROM setup_invitations; DELETE FROM audit_events',
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
  try {
    wrangler([
      'kv',
      'key',
      'delete',
      SETUP_STATE_KEY,
      '--binding',
      'KV_SESSIONS',
      '--local',
      '--persist-to',
      persistTo,
    ]);
  } catch {
    // The setup cache is absent on a fresh E2E state directory.
  }
};
