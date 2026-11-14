import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { prepareLogin } from '../../../lib/crypto/login-keys';
import { rewrapPassword } from '../../../lib/crypto/password-change';
import { countUsers, findPasswordChangeState } from '../../../lib/.server/queries/users';
import { testEnv } from '../../../__test__/auth-fixtures';
import { parsePasswordChangeInput } from '../.server/password-input';
import { changeMasterPassword } from '../.server/use-cases/change-password';
import {
  createPasswordFixture,
  CURRENT_PASSWORD,
  fixtureRequest,
  userSnapshot,
  type PasswordFixture,
} from '../../../__test__/password-change-fixtures';

const changeInput = async (fixture: PasswordFixture) => {
  const current = await prepareLogin(CURRENT_PASSWORD, fixture.setup.kdfSalt, fixture.setup.kdfIterations);

  try {
    const rotated = await rewrapPassword(current.authHash, current.wrapKey, 'new master password 456', fixture.setup);
    const parsed = parsePasswordChangeInput({ currentAuthHash: current.authHash, ...rotated.request });
    if (!parsed) throw new Error('fixture produced invalid password input');

    return parsed;
  } finally {
    current.wrapKey.fill(0);
  }
};

beforeEach(async () => {
  await resetDatabase();
});

describe('changeMasterPassword', () => {
  it('rejects a disabled account without mutating credentials', async () => {
    const fixture = await createPasswordFixture({ status: 'disabled' });
    expect(await findPasswordChangeState(env.DB, fixture.userId)).toMatchObject({ status: 'disabled' });
    const before = await userSnapshot(fixture.userId);
    const prepare = vi.spyOn(env.DB, 'prepare');

    const result = await changeMasterPassword(testEnv(), fixtureRequest(), fixture.userId, await changeInput(fixture));
    const credentialUpdates = prepare.mock.calls.filter(([sql]) => String(sql).includes('UPDATE users'));
    prepare.mockRestore();

    expect(result.status).toBe('invalid-current');
    expect(credentialUpdates).toHaveLength(0);
    expect(await userSnapshot(fixture.userId)).toEqual(before);
  });

  it('rejects a missing account without creating or mutating credentials', async () => {
    const fixture = await createPasswordFixture();
    const missingId = crypto.randomUUID();
    const before = await userSnapshot(fixture.userId);
    const beforeCount = await countUsers(env.DB);

    const result = await changeMasterPassword(testEnv(), fixtureRequest(), missingId, await changeInput(fixture));

    expect(result.status).toBe('invalid-current');
    expect(await findPasswordChangeState(env.DB, missingId)).toBeNull();
    expect(await countUsers(env.DB)).toBe(beforeCount);
    expect(await userSnapshot(fixture.userId)).toEqual(before);
  });

  it('clears step-up failures after a successful rotation', async () => {
    const fixture = await createPasswordFixture();
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() + 60_000, fixture.userId)
      .run();

    const result = await changeMasterPassword(testEnv(), fixtureRequest(), fixture.userId, await changeInput(fixture));
    expect(result.status).toBe('ok');

    const row = await env.DB.prepare('SELECT step_up_failed_count, step_up_locked_until FROM users WHERE id = ?')
      .bind(fixture.userId)
      .first<{ step_up_failed_count: number; step_up_locked_until: number | null }>();
    expect(row).toEqual({ step_up_failed_count: 0, step_up_locked_until: null });
  });

  it('rejects a wrong current auth hash without mutating credentials', async () => {
    const fixture = await createPasswordFixture();
    await env.DB.prepare('UPDATE users SET step_up_failed_count = 10, step_up_locked_until = ? WHERE id = ?')
      .bind(Date.now() + 60_000, fixture.userId)
      .run();
    const before = await userSnapshot(fixture.userId);
    const input = await changeInput(fixture);

    const result = await changeMasterPassword(testEnv(), fixtureRequest(), fixture.userId, {
      ...input,
      currentAuthHashBytes: new Uint8Array(32).fill(7),
    });

    const after = await userSnapshot(fixture.userId);
    expect(result.status).toBe('invalid-current');
    expect(after).toEqual({ ...before, failed_login_count: (before?.failed_login_count ?? 0) + 1 });
  });
});
