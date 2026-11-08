import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { createTestUser } from '../../../__test__/fixtures';
import { fromBase64Url } from '../../../lib/base64-url';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { deriveServerAuthHash } from '../../../lib/.server/auth-hash';
import { generateSetupKeyMaterial } from '../../setup/setup-keys';
import { loginWithPassword } from '../.server/use-cases/login';
import { prepareLogin } from '../../../lib/crypto/login-keys';
import { clearSessions, createAuthUser, testEnv } from '../../../__test__/auth-fixtures';

const request = () =>
  new Request('https://app.example/auth/login', {
    method: 'POST',
    headers: { 'user-agent': 'test-agent', 'cf-connecting-ip': '203.0.113.9' },
  });

beforeEach(async () => {
  await resetDatabase();
  await clearSessions();
});

afterEach(clearSessions);

describe('password login', () => {
  it('issues a session and returns only unlock material', async () => {
    const { userId, authHash, email } = await createAuthUser({ email: 'user@example.com' });

    const result = await loginWithPassword(testEnv(), request(), {
      email,
      authHashBytes: authHash,
    });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.cookie).toContain('bw_session=');
    expect(result.body).toMatchObject({ requires2fa: false, kdfAlg: 'pbkdf2-sha256' });
    expect(result.body).not.toHaveProperty('email');
    expect(result.body.kdfSalt).toHaveLength(22);
    expect(result.body.vaultKeyWrapped).toHaveLength(64);

    const audit = await env.DB.prepare('SELECT type, user_id FROM audit_events ORDER BY created_at DESC').first();
    expect(audit).toMatchObject({ type: 'login.succeeded', user_id: userId });
  });

  it('returns the same failure for wrong password, unknown email, and disabled users', async () => {
    const { authHash, email } = await createAuthUser({ email: 'user@example.com' });
    const disabledUser = await createAuthUser({ email: 'disabled@example.com', status: 'disabled' });

    const wrong = await loginWithPassword(testEnv(), request(), {
      email,
      authHashBytes: crypto.getRandomValues(new Uint8Array(32)),
    });
    const unknown = await loginWithPassword(testEnv(), request(), {
      email: 'nobody@example.com',
      authHashBytes: authHash,
    });
    const disabled = await loginWithPassword(testEnv(), request(), {
      email: disabledUser.email,
      authHashBytes: disabledUser.authHash,
    });

    expect([wrong, unknown, disabled]).toEqual([
      { status: 'invalid-credentials' },
      { status: 'invalid-credentials' },
      { status: 'invalid-credentials' },
    ]);
    const failed = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE type = 'login.failed'",
    ).first<{
      count: number;
    }>();
    expect(failed?.count).toBe(3);
    expect((await env.KV_SESSIONS.list({ prefix: 'session:' })).keys).toHaveLength(0);
  });

  it('accepts credentials produced from the setup key material', async () => {
    const password = 'correct horse battery staple';
    const setup = await generateSetupKeyMaterial(password);
    const authHashBytes = fromBase64Url(setup.authHash);
    const serverSalt = crypto.getRandomValues(new Uint8Array(16));
    const serverHash = await deriveServerAuthHash(authHashBytes, serverSalt, 'test-auth-pepper');
    const userId = await createTestUser({ email: 'flow@example.com' });

    await env.DB.prepare(
      `UPDATE users SET auth_hash = ?, server_salt = ?, kdf_salt = ?, kdf_iterations = ?,
        vault_key_wrapped = ?, vault_key_wrap_iv = ? WHERE id = ?`,
    )
      .bind(
        serverHash.authHash,
        serverHash.serverSalt,
        encodeBase64(fromBase64Url(setup.kdfSalt)),
        setup.kdfIterations,
        encodeBase64(fromBase64Url(setup.vaultKeyWrapped)),
        encodeBase64(fromBase64Url(setup.vaultKeyWrapIv)),
        userId,
      )
      .run();

    const prepared = await prepareLogin(password, setup.kdfSalt, setup.kdfIterations);
    const result = await loginWithPassword(testEnv(), request(), {
      email: 'flow@example.com',
      authHashBytes: fromBase64Url(prepared.authHash),
    });
    prepared.wrapKey.fill(0);

    expect(result.status).toBe('ok');
  });

  it('fails closed without pepper or session secret', async () => {
    const { authHash, email } = await createAuthUser();

    await expect(
      loginWithPassword(testEnv({ AUTH_PEPPER: undefined }), request(), {
        email,
        authHashBytes: authHash,
      }),
    ).resolves.toEqual({ status: 'server-error' });
    await expect(
      loginWithPassword(testEnv({ SESSION_SECRET: undefined }), request(), {
        email,
        authHashBytes: authHash,
      }),
    ).resolves.toEqual({ status: 'server-error' });
  });
});
