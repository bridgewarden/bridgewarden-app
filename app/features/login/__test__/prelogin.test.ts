import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { lookupKdfParameters } from '../.server/use-cases/prelogin';
import { createAuthUser, testEnv } from '../../../__test__/auth-fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('KDF parameter lookup', () => {
  it('returns the stored parameters for a known email', async () => {
    const { userId, email } = await createAuthUser();
    const salt = await env.DB.prepare('SELECT kdf_salt FROM users WHERE id = ?')
      .bind(userId)
      .first<{ kdf_salt: string }>();

    const known = await lookupKdfParameters(testEnv(), email);
    const unknown = await lookupKdfParameters(testEnv(), 'missing@example.com');

    expect(known.status).toBe('ok');
    expect(unknown.status).toBe('ok');
    expect(unknown.status === 'ok' && known.status === 'ok' && Object.keys(known.parameters).sort()).toEqual(
      unknown.status === 'ok' ? Object.keys(unknown.parameters).sort() : [],
    );
    expect(unknown.status === 'ok' && unknown.parameters.kdfSalt).toHaveLength(22);
    expect(known.status === 'ok' && known.parameters.kdfSalt).not.toBe(salt?.kdf_salt);
  });

  it('is deterministic for an unknown email', async () => {
    const first = await lookupKdfParameters(testEnv(), 'missing@example.com');
    const second = await lookupKdfParameters(testEnv(), 'missing@example.com');

    expect(first).toEqual(second);
  });
});
