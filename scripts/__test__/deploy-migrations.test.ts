import { describe, expect, it } from 'vitest';

import { compareAppliedMigrations, migrationVersion, parseRemoteMigrations } from '../migration-names';

describe('deploy migration gate', () => {
  it('detects missing migrations and remote-ahead skew', () => {
    const local = ['0014_step_up_lockout.sql', '0015_two_factor_lockout.sql'];
    const remote = ['0014_step_up_lockout.sql'];

    expect(compareAppliedMigrations(local, remote)).toEqual({
      missing: ['0015_two_factor_lockout.sql'],
      localVersion: 15,
      remoteVersion: 14,
    });
    expect(compareAppliedMigrations(local, [...remote, '0016_future.sql'])).toMatchObject({
      missing: ['0015_two_factor_lockout.sql'],
      remoteVersion: 16,
    });
  });

  it('parses wrangler JSON and derives the high-water mark from names', () => {
    const output = JSON.stringify([
      { results: [{ name: '0014_step_up_lockout.sql' }, { name: '0015_two_factor_lockout.sql' }] },
    ]);
    const remote = parseRemoteMigrations(output);

    expect(remote).toHaveLength(2);
    expect(migrationVersion(remote)).toBe(15);
    expect(migrationVersion(['0016_future.sql'])).toBe(16);
    expect(() => parseRemoteMigrations('not-json')).toThrow();
  });
});
