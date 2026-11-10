import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createPasswordFixture } from '../../../__test__/password-change-fixtures';
import { testEnv } from '../../../__test__/auth-fixtures';
import { resetDatabase } from '../../../__test__/reset-database';
import { getSession } from '../../../lib/.server/session';
import { prepareRecoveryReset } from '../../../lib/crypto/recovery-reset';
import { parseRecoveryResetInput } from '../.server/recovery-input';
import { lookupRecovery } from '../.server/use-cases/lookup';
import { resetWithRecovery } from '../.server/use-cases/reset';

const NEW_PASSWORD = 'new master password 456';

const request = () =>
  new Request('https://app.example/auth/recover/reset', {
    method: 'POST',
    headers: { 'cf-connecting-ip': '203.0.113.9', 'user-agent': 'preflight' },
  });

const row = (userId: string) =>
  env.DB.prepare(
    `SELECT auth_hash, kdf_salt, vault_key_wrapped, recovery_key_wrapped, recovery_key_wrap_iv,
      recovery_auth_hash, recovery_server_salt, session_version FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<Record<string, string | number | null>>();

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDatabase();
});

describe('recovery lookup', () => {
  it('returns stored material for an active account', async () => {
    const fixture = await createPasswordFixture();
    const result = await lookupRecovery(testEnv(), request(), fixture.email);

    expect(result).toEqual({
      status: 'ok',
      recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped,
      recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv,
    });
  });

  it('returns deterministic synthetic material for unknown and disabled accounts', async () => {
    const disabled = await createPasswordFixture({ status: 'disabled' });
    const first = await lookupRecovery(testEnv(), request(), 'missing@example.com');
    const second = await lookupRecovery(testEnv(), request(), 'missing@example.com');
    const disabledResult = await lookupRecovery(testEnv(), request(), disabled.email);
    const disabledAgain = await lookupRecovery(testEnv(), request(), disabled.email);

    expect(first).toEqual(second);
    expect(disabledResult).toEqual(disabledAgain);
    expect(disabledResult).not.toEqual(first);
    expect(first.status).toBe('ok');
    if (first.status === 'ok') {
      expect(first.recoveryKeyWrapped).toHaveLength(64);
      expect(first.recoveryKeyWrapIv).toHaveLength(16);
    }
  });
});

describe('recovery reset', () => {
  it('rotates credentials, burns the old proof, and issues a working session', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      NEW_PASSWORD,
    );
    const parsed = parseRecoveryResetInput({ email: fixture.email, ...prepared.request });
    const before = await row(fixture.userId);
    const result = await resetWithRecovery(testEnv(), request(), parsed!);

    expect(result.status).toBe('ok');
    const after = await row(fixture.userId);
    expect(after?.auth_hash).not.toBe(before?.auth_hash);
    expect(after?.recovery_auth_hash).not.toBe(before?.recovery_auth_hash);
    expect(after?.session_version).toBe(1);

    if (result.status === 'ok') {
      const token = result.cookie.match(/bw_session=([^;]+)/)?.[1];
      const session = token
        ? await getSession(
            testEnv(),
            new Request('https://app.example/app', { headers: { cookie: `bw_session=${token}` } }),
          )
        : null;
      expect(session).toMatchObject({ user: { id: fixture.userId, sessionVersion: 1 } });
    }

    const replay = await resetWithRecovery(testEnv(), request(), parsed!);
    expect(replay.status).toBe('invalid');
    expect(await row(fixture.userId)).toEqual(after);

    const events = await env.DB.prepare(
      'SELECT type, metadata FROM audit_events WHERE user_id = ? ORDER BY created_at, rowid',
    )
      .bind(fixture.userId)
      .all<{ type: string; metadata: string | null }>();
    expect(events.results?.map((event) => event.type)).toEqual(['recovery.completed', 'recovery.failed']);
    expect(JSON.stringify(events.results)).not.toContain(fixture.email);
  }, 20_000);

  it('reports a committed reset when session issuance fails', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      NEW_PASSWORD,
    );
    const parsed = parseRecoveryResetInput({ email: fixture.email, ...prepared.request })!;
    const before = await row(fixture.userId);
    const put = vi.spyOn(env.KV_SESSIONS, 'put').mockRejectedValueOnce(new Error('kv unavailable'));

    const result = await resetWithRecovery(testEnv(), request(), parsed);
    put.mockRestore();

    expect(result.status).toBe('committed');
    const after = await row(fixture.userId);
    expect(after?.auth_hash).not.toBe(before?.auth_hash);
    expect(after?.session_version).toBe(1);
  }, 20_000);

  it('rejects wrong proof, legacy null verifier, and disabled accounts without mutation', async () => {
    const fixture = await createPasswordFixture();
    const prepared = await prepareRecoveryReset(
      fixture.setup.recoveryKey,
      { recoveryKeyWrapped: fixture.setup.recoveryKeyWrapped, recoveryKeyWrapIv: fixture.setup.recoveryKeyWrapIv },
      NEW_PASSWORD,
    );
    const parsed = parseRecoveryResetInput({ email: fixture.email, ...prepared.request })!;
    const before = await row(fixture.userId);

    expect(
      (
        await resetWithRecovery(testEnv(), request(), {
          ...parsed,
          currentRecoveryAuthKeyBytes: new Uint8Array(32).fill(4),
        })
      ).status,
    ).toBe('invalid');
    expect(await row(fixture.userId)).toEqual(before);

    await env.DB.prepare('UPDATE users SET recovery_auth_hash = NULL, recovery_server_salt = NULL WHERE id = ?')
      .bind(fixture.userId)
      .run();
    expect((await resetWithRecovery(testEnv(), request(), parsed)).status).toBe('invalid');

    const disabled = await createPasswordFixture({ status: 'disabled' });
    const disabledPrepared = await prepareRecoveryReset(
      disabled.setup.recoveryKey,
      { recoveryKeyWrapped: disabled.setup.recoveryKeyWrapped, recoveryKeyWrapIv: disabled.setup.recoveryKeyWrapIv },
      NEW_PASSWORD,
    );
    const disabledInput = parseRecoveryResetInput({ email: disabled.email, ...disabledPrepared.request })!;
    expect((await resetWithRecovery(testEnv(), request(), disabledInput)).status).toBe('invalid');
  }, 20_000);
});
