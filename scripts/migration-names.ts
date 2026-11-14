export type AppliedMigrationComparison = {
  missing: string[];
  localVersion: number;
  remoteVersion: number;
};

export const migrationVersion = (names: string[]): number =>
  names.reduce((version, name) => {
    const match = /^(\d{4})_/.exec(name);
    return match ? Math.max(version, Number(match[1])) : version;
  }, 0);

export const parseRemoteMigrations = (output: string): string[] => {
  const parsed = JSON.parse(output) as Array<{ results?: Array<{ name?: unknown }> }>;
  if (!Array.isArray(parsed)) throw new Error('Unexpected D1 response');
  return parsed.flatMap((batch) =>
    (batch.results ?? []).flatMap((row) => (typeof row.name === 'string' ? [row.name] : [])),
  );
};

export const compareAppliedMigrations = (local: string[], remote: string[]): AppliedMigrationComparison => ({
  missing: local.filter((name) => !remote.includes(name)),
  localVersion: migrationVersion(local),
  remoteVersion: migrationVersion(remote),
});
