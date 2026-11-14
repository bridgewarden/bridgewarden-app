import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { currentStep, decodeBase32, generateCode } from '../../../lib/.server/totp';
import { beginEnrollment } from '../.server/use-cases/enroll';
import { PENDING_ENROLLMENT_TTL_MS } from '../.server/constants/enrollment';
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

  it('expires a stale pending enrollment and refreshes the window when restarted', async () => {
    const user = await createTwoFactorUser(0);
    const first = await beginEnrollment(twoFactorEnv(), request(), user.userId, user.email, {
      authHashBytes: user.authHash,
    });
    if (first.status !== 'ok') throw new Error('enrollment did not start');

    await env.DB.prepare('UPDATE user_2fa SET updated_at = ? WHERE user_id = ?')
      .bind(Date.now() - PENDING_ENROLLMENT_TTL_MS - 1, user.userId)
      .run();
    const stale = await verifyEnrollment(
      twoFactorEnv(),
      request(),
      user.userId,
      await generateCode(decodeBase32(first.secret), currentStep()),
    );
    expect(stale).toEqual({ status: 'not-pending' });
    const deleted = await env.DB.prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
      .bind(user.userId)
      .first<{ enabled: number }>();
    expect(deleted).toBeNull();

    const second = await beginEnrollment(twoFactorEnv(), request(), user.userId, user.email, {
      authHashBytes: user.authHash,
    });
    if (second.status !== 'ok') throw new Error('enrollment did not restart');
    const enabled = await verifyEnrollment(
      twoFactorEnv(),
      request(),
      user.userId,
      await generateCode(decodeBase32(second.secret), currentStep()),
    );
    expect(enabled.status).toBe('ok');
    if (enabled.status === 'ok') expect(enabled.backupCodes).toHaveLength(10);
  });

  it('replaces an existing pending secret when enrollment restarts', async () => {
    const user = await createTwoFactorUser(0);
    const first = await beginEnrollment(twoFactorEnv(), request(), user.userId, user.email, {
      authHashBytes: user.authHash,
    });
    if (first.status !== 'ok') throw new Error('enrollment did not start');
    const before = await env.DB.prepare('SELECT totp_secret_ct, updated_at FROM user_2fa WHERE user_id = ?')
      .bind(user.userId)
      .first<{ totp_secret_ct: string; updated_at: number }>();

    const second = await beginEnrollment(twoFactorEnv(), request(), user.userId, user.email, {
      authHashBytes: user.authHash,
    });
    if (second.status !== 'ok') throw new Error('enrollment did not restart');
    const after = await env.DB.prepare('SELECT totp_secret_ct, updated_at FROM user_2fa WHERE user_id = ?')
      .bind(user.userId)
      .first<{ totp_secret_ct: string; updated_at: number }>();
    expect(after?.totp_secret_ct).not.toBe(before?.totp_secret_ct);
    expect(after?.updated_at).toBeGreaterThanOrEqual(before?.updated_at ?? 0);

    const oldCode = await generateCode(decodeBase32(first.secret), currentStep());
    expect(await verifyEnrollment(twoFactorEnv(), request(), user.userId, oldCode)).toEqual({
      status: 'invalid-code',
    });
    const newCode = await generateCode(decodeBase32(second.secret), currentStep());
    expect((await verifyEnrollment(twoFactorEnv(), request(), user.userId, newCode)).status).toBe('ok');
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
