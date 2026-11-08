import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestUser } from '../../../__test__/fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { readConfig } from '../../../lib/.server/env';
import type { SetupInput } from '../.server/setup-input';
import { completeBootstrap } from '../.server/use-cases/complete-bootstrap';

const random = (length: number) => encodeBase64(crypto.getRandomValues(new Uint8Array(length)));

const setupInput = (token: string): SetupInput => ({
  token,
  email: 'admin@example.com',
  displayName: 'Administrator',
  kdfIterations: 600_000,
  kdfSalt: random(16),
  authHashBytes: crypto.getRandomValues(new Uint8Array(32)),
  vaultKeyWrapped: random(48),
  vaultKeyWrapIv: random(12),
  recoveryKeyWrapped: random(48),
  recoveryKeyWrapIv: random(12),
});

const configuredToken = () => {
  const token = readConfig(env, 'BOOTSTRAP_TOKEN');
  expect(token).toBeTruthy();
  return token!;
};

const clearSessions = async () => {
  const list = await env.KV_SESSIONS.list({ prefix: 'session:' });
  await Promise.all(list.keys.map((key) => env.KV_SESSIONS.delete(key.name)));
};

beforeEach(async () => {
  await resetDatabase();
  await clearSessions();
});

afterEach(clearSessions);

describe('complete bootstrap use-case', () => {
  it('creates the admin, audits it, and issues a session', async () => {
    const result = await completeBootstrap(env, setupInput(configuredToken()));

    expect(result.status).toBe('created');
    expect(result.status === 'created' && result.cookie).toContain('bw_session=');

    const user = await env.DB.prepare('SELECT email, role, status FROM users').first();
    const audit = await env.DB.prepare('SELECT type, user_id FROM audit_events').first<{
      type: string;
      user_id: string;
    }>();
    const sessions = await env.KV_SESSIONS.list({ prefix: 'session:' });

    expect(user).toEqual({ email: 'admin@example.com', role: 'admin', status: 'active' });
    expect(audit?.type).toBe('bootstrap.created');
    expect(sessions.keys).toHaveLength(1);
  });

  it('rejects a wrong token without creating anything', async () => {
    const result = await completeBootstrap(env, setupInput(`${configuredToken()}-wrong`));

    expect(result.status).toBe('forbidden');
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()).toEqual({
      count: 0,
    });
    expect((await env.KV_SESSIONS.list({ prefix: 'session:' })).keys).toHaveLength(0);
  });

  it('returns exists and removes the pre-created session when an admin already exists', async () => {
    await createTestUser();

    const result = await completeBootstrap(env, setupInput(configuredToken()));

    expect(result.status).toBe('exists');
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()).toEqual({
      count: 1,
    });
    expect((await env.KV_SESSIONS.list({ prefix: 'session:' })).keys).toHaveLength(0);
  });

  it('fails closed without the pepper or KV without creating a user', async () => {
    const token = configuredToken();
    const withoutPepper = {
      DB: env.DB,
      KV_SESSIONS: env.KV_SESSIONS,
      BOOTSTRAP_TOKEN: token,
    } as Env;
    const withoutKv = {
      DB: env.DB,
      KV_SESSIONS: { put: async () => Promise.reject(new Error('kv down')), delete: async () => undefined },
      BOOTSTRAP_TOKEN: token,
      AUTH_PEPPER: readConfig(env, 'AUTH_PEPPER'),
    } as unknown as Env;

    expect((await completeBootstrap(withoutPepper, setupInput(token))).status).toBe('server-error');
    expect((await completeBootstrap(withoutKv, setupInput(token))).status).toBe('server-error');
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM users').first<{ count: number }>()).toEqual({
      count: 0,
    });
  });
});
