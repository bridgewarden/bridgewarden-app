import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

import { compareAppliedMigrations, parseRemoteMigrations } from './migration-names';

export const localMigrations = (directory = 'migrations'): string[] =>
  readdirSync(directory)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();

const expectedSchemaVersion = (): number => {
  const source = readFileSync('app/lib/.server/schema.ts', 'utf8');
  const match = /SCHEMA_VERSION\s*=\s*(\d+)/.exec(source);
  if (!match) throw new Error('SCHEMA_VERSION is missing');
  return Number(match[1]);
};

const main = () => {
  const local = localMigrations();
  let remote: string[];
  try {
    const output = execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'execute',
        'bridgewarden-db',
        '--remote',
        '--json',
        '--command',
        'SELECT name FROM d1_migrations ORDER BY name',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    remote = parseRemoteMigrations(output);
  } catch (error) {
    console.error('Unable to read the remote D1 schema; deploy aborted.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const comparison = compareAppliedMigrations(local, remote);
  if (comparison.missing.length > 0) {
    console.error(`Remote D1 has pending migrations: ${comparison.missing.join(', ')}`);
    console.error('Run `pnpm db:migrate:remote` before deploying.');
    process.exitCode = 1;
    return;
  }

  const expected = expectedSchemaVersion();
  if (comparison.localVersion !== expected || comparison.remoteVersion !== expected) {
    console.error(
      `Schema mismatch: expected ${expected}, local ${comparison.localVersion}, remote ${comparison.remoteVersion}`,
    );
    process.exitCode = 1;
  }
};

if (process.argv[1]?.endsWith('check-remote-migrations.ts')) main();
