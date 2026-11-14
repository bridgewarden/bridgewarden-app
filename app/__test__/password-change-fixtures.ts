import { env } from 'cloudflare:workers';

import { createSession, type CreatedSession } from '../lib/.server/session';
import { base64UrlToStandard, fromBase64Url } from '../lib/base64-url';
import { deriveServerAuthHash, generateServerSalt } from '../lib/.server/auth-hash';
import { generateSetupKeyMaterial, type SetupKeyMaterial } from '../lib/crypto/setup-keys';
import { TEST_PEPPER, testEnv } from './auth-fixtures';

export const CURRENT_PASSWORD = 'current master password 123';

type PasswordFixtureOptions = {
  status?: 'active' | 'disabled';
};

export type PasswordFixture = {
  userId: string;
  email: string;
  setup: SetupKeyMaterial;
};

export const createPasswordFixture = async (options: PasswordFixtureOptions = {}): Promise<PasswordFixture> => {
  const setup = await generateSetupKeyMaterial(CURRENT_PASSWORD);
  const serverHash = await deriveServerAuthHash(fromBase64Url(setup.authHash), generateServerSalt(), TEST_PEPPER);
  const recoveryHash = await deriveServerAuthHash(
    fromBase64Url(setup.recoveryAuthKey),
    generateServerSalt(),
    TEST_PEPPER,
  );
  const id = crypto.randomUUID();
  const email = `password-${id}@example.com`;
  const now = Date.now();
  const testEnvironment = testEnv();

  await testEnvironment.DB.prepare(
    `INSERT INTO users (
      id, email, display_name, auth_hash, server_salt, kdf_alg, kdf_iterations, kdf_salt,
      vault_key_wrapped, vault_key_wrap_iv, recovery_key_wrapped, recovery_key_wrap_iv,
      recovery_auth_hash, recovery_server_salt,
      role, status, vault_rev, session_version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      email,
      'Password Fixture',
      serverHash.authHash,
      serverHash.serverSalt,
      'pbkdf2-sha256',
      setup.kdfIterations,
      base64UrlToStandard(setup.kdfSalt),
      base64UrlToStandard(setup.vaultKeyWrapped),
      base64UrlToStandard(setup.vaultKeyWrapIv),
      base64UrlToStandard(setup.recoveryKeyWrapped),
      base64UrlToStandard(setup.recoveryKeyWrapIv),
      recoveryHash.authHash,
      recoveryHash.serverSalt,
      'admin',
      options.status ?? 'active',
      0,
      0,
      now,
      now,
    )
    .run();

  return { userId: id, email, setup };
};

export const createFixtureSession = (userId: string, ver = 0): Promise<CreatedSession> =>
  createSession(testEnv(), { userId, ver });

export const fixtureRequest = (cookie?: string, body = '{}') =>
  new Request('https://app.example/api/account/password', {
    method: 'POST',
    headers: {
      origin: 'https://app.example',
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.9',
      ...(cookie ? { cookie } : {}),
    },
    body,
  });

export const userSnapshot = async (userId: string) =>
  env.DB.prepare(
    `SELECT auth_hash, kdf_salt, vault_key_wrapped, recovery_key_wrapped, recovery_key_wrap_iv,
      failed_login_count, locked_until, step_up_failed_count, step_up_locked_until FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{
      auth_hash: string;
      kdf_salt: string;
      vault_key_wrapped: string;
      recovery_key_wrapped: string;
      recovery_key_wrap_iv: string;
      failed_login_count: number;
      locked_until: number | null;
      step_up_failed_count: number;
      step_up_locked_until: number | null;
    }>();
