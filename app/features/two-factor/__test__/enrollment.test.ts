import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { currentStep, decodeBase32, generateCode } from '../../../lib/.server/totp';
import { beginEnrollment } from '../.server/use-cases/enroll';
import { verifyEnrollment } from '../.server/use-cases/verify-enrollment';
import { clearAuthKv, createTwoFactorUser, twoFactorEnv } from './two-factor-fixtures';

const request = () => new Request('https://app.example/api/account/2fa/enroll', { method: 'POST' });

beforeEach(async () => {
  await resetDatabase();
  await clearAuthKv();
});

afterEach(clearAuthKv);

describe('2FA enrollment', () => {
  it('stores a pending encrypted seed and returns the secret/URI once', async () => {
    const user = await createTwoFactorUser(0);
    const result = await beginEnrollment(twoFactorEnv(), request(), user.userId, user.email, {
      authHashBytes: user.authHash,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.secret).toHaveLength(32);
    expect(result.uri).toContain('otpauth://totp/');
    expect(result.uri).toContain('issuer=Bridgewarden');

    const row = await env.DB.prepare('SELECT enabled, totp_secret_ct, totp_secret_iv FROM user_2fa WHERE user_id = ?')
      .bind(user.userId)
      .first<{ enabled: number; totp_secret_ct: string; totp_secret_iv: string }>();
    expect(row?.enabled).toBe(0);
    expect(row?.totp_secret_ct).not.toContain(result.secret);
  });

  it('refuses to start when already enabled and enables only after a valid code', async () => {
    const enabled = await createTwoFactorUser(1);
    await expect(
      beginEnrollment(twoFactorEnv(), request(), enabled.userId, enabled.email, {
        authHashBytes: enabled.authHash,
      }),
    ).resolves.toEqual({
      status: 'already-enabled',
    });

    const pending = await createTwoFactorUser(0);
    const started = await beginEnrollment(twoFactorEnv(), request(), pending.userId, pending.email, {
      authHashBytes: pending.authHash,
    });
    if (started.status !== 'ok') throw new Error('enrollment did not start');
    const secret = decodeBase32(started.secret);
    await expect(verifyEnrollment(twoFactorEnv(), request(), pending.userId, '000000')).resolves.toEqual({
      status: 'invalid-code',
    });

    const step = currentStep();
    const result = await verifyEnrollment(twoFactorEnv(), request(), pending.userId, await generateCode(secret, step));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.backupCodes).toHaveLength(10);
    const row = await env.DB.prepare('SELECT enabled, last_totp_step FROM user_2fa WHERE user_id = ?')
      .bind(pending.userId)
      .first<{ enabled: number; last_totp_step: number }>();
    expect(row?.enabled).toBe(1);
    expect(row?.last_totp_step).toBeGreaterThanOrEqual(step);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM backup_codes WHERE user_id = ?')
      .bind(pending.userId)
      .first<{ count: number }>();
    expect(count?.count).toBe(10);
  });
});
