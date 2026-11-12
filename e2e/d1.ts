import { execFileSync } from 'node:child_process';

export const queryD1 = <T>(sql: string): T[] => {
  const output = execFileSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'execute',
      'bridgewarden-db',
      '--local',
      '--persist-to',
      '.wrangler/e2e',
      '--command',
      sql,
      '--json',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const parsed = JSON.parse(output) as { results?: T[] }[];
  return parsed[0]?.results ?? [];
};
