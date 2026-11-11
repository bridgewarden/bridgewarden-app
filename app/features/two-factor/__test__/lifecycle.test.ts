import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { consumeBackupCode, generateAndStoreBackupCodes } from '../.server/backup-codes';
import { disableTwoFactor } from '../.server/use-cases/disable';
import { regenerateBackupCodes } from '../.server/use-cases/regenerate';
import { createTwoFactorUser, TEST_PEPPER, twoFactorEnv } from './two-factor-fixtures';

const request = () =>
  new Request('https://app.example/api/account/2fa/disable', {
    method: 'POST',
    headers: { 'user-agent': 'test-agent', 'cf-connecting-ip': '203.0.113.9' },
  });

beforeEach(async () => {
  await resetDatabase();
});

describe('2FA lifecycle', () => {
  it('disables only with the matching auth hash and removes seed and backup codes', async () => {
    const user = await createTwoFactorUser(1);
    await generateAndStoreBackupCodes(twoFactorEnv(), user.userId, TEST_PEPPER);

    await expect(
      disableTwoFactor(twoFactorEnv(), request(), user.userId, {
        authHashBytes: crypto.getRandomValues(new Uint8Array(32)),
      }),
    ).resolves.toEqual({ status: 'invalid-password' });
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM user_2fa WHERE user_id = ?')
        .bind(user.userId)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });

    await expect(
      disableTwoFactor(twoFactorEnv(), request(), user.userId, { authHashBytes: user.authHash }),
    ).resolves.toMatchObject({ status: 'ok' });

    const twoFactor = await env.DB.prepare('SELECT COUNT(*) AS count FROM user_2fa WHERE user_id = ?')
      .bind(user.userId)
      .first<{ count: number }>();
    const backup = await env.DB.prepare('SELECT COUNT(*) AS count FROM backup_codes WHERE user_id = ?')
      .bind(user.userId)
      .first<{ count: number }>();
    expect(twoFactor).toEqual({ count: 0 });
    expect(backup).toEqual({ count: 0 });
  });

  it('regenerates only while enabled and invalidates old codes', async () => {
    const user = await createTwoFactorUser(1);
    const oldCodes = await generateAndStoreBackupCodes(twoFactorEnv(), user.userId, TEST_PEPPER);

    const result = await regenerateBackupCodes(twoFactorEnv(), request(), user.userId, {
      authHashBytes: user.authHash,
    });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.backupCodes).toHaveLength(10);

    await expect(consumeBackupCode(twoFactorEnv(), user.userId, oldCodes[0], TEST_PEPPER)).resolves.toBe(false);
    await expect(consumeBackupCode(twoFactorEnv(), user.userId, result.backupCodes[0], TEST_PEPPER)).resolves.toBe(
      true,
    );

    const disabled = await createTwoFactorUser(0);
    await expect(
      regenerateBackupCodes(twoFactorEnv(), request(), disabled.userId, { authHashBytes: disabled.authHash }),
    ).resolves.toEqual({
      status: 'not-enabled',
    });
  });
});
