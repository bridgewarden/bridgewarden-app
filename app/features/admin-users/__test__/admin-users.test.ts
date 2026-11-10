import { env } from 'cloudflare:workers';

import { standardToBase64Url } from '../../../lib/base64-url';
import { encodeBase64 } from '../../../lib/crypto/encoding';
import { beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../../__test__/reset-database';
import { createTestUser } from '../../../__test__/fixtures';
import { createInvitationToken } from '../../../lib/.server/invitation-token';
import {
  acceptInvitation,
  createSetupInvitationQueries,
  findValidInvitation,
} from '../../../lib/.server/queries/setup-invitations';
import { createUsersQueries } from '../../../lib/.server/queries/users';
import { changeRole } from '../.server/use-cases/change-role';
import { disableUser } from '../.server/use-cases/disable-user';

const db = env.DB;

beforeEach(async () => {
  await resetDatabase();
});

const invitation = async (email: string, inviterId: string) => {
  const { token, tokenHash } = await createInvitationToken();
  const now = Date.now();
  await createSetupInvitationQueries(env as unknown as Env).upsert({
    id: crypto.randomUUID(),
    email,
    displayName: 'Member',
    role: 'member',
    tokenHash,
    invitedById: inviterId,
    expiresAt: now + 60_000,
    now,
  });
  return { token, tokenHash };
};

const encoded = (length: number) => encodeBase64(crypto.getRandomValues(new Uint8Array(length)));

const userMaterial = (email: string, now: number) => ({
  id: crypto.randomUUID(),
  email,
  displayName: 'Member',
  role: 'member' as const,
  authHash: 'hash',
  serverSalt: 'salt',
  kdfIterations: 600_000,
  kdfSalt: encoded(16),
  vaultKeyWrapped: encoded(48),
  vaultKeyWrapIv: encoded(12),
  recoveryKeyWrapped: encoded(48),
  recoveryKeyWrapIv: encoded(12),
  recoveryAuthHash: 'recovery-hash',
  recoveryServerSalt: 'recovery-salt',
  now,
});

describe('setup invitations', () => {
  it('accepts once and creates one user', async () => {
    const inviter = await createTestUser({ email: 'admin@example.com' });
    const now = Date.now();
    const { tokenHash } = await invitation('member@example.com', inviter);

    expect(await findValidInvitation(db, tokenHash, now)).not.toBeNull();
    expect(await acceptInvitation(db, tokenHash, now, userMaterial('member@example.com', now))).toBe(true);
    expect(await acceptInvitation(db, tokenHash, now, userMaterial('member@example.com', now))).toBe(false);

    const count = await db
      .prepare('SELECT COUNT(*) AS count FROM users WHERE email = ?')
      .bind('member@example.com')
      .first<{ count: number }>();
    expect(count?.count).toBe(1);

    const row = await db
      .prepare('SELECT kdf_salt, recovery_auth_hash, recovery_server_salt FROM users WHERE email = ?')
      .bind('member@example.com')
      .first<{ kdf_salt: string; recovery_auth_hash: string | null; recovery_server_salt: string | null }>();
    expect(row?.recovery_auth_hash).toBe('recovery-hash');
    expect(row?.recovery_server_salt).toBe('recovery-salt');
    expect(() => standardToBase64Url(row!.kdf_salt)).not.toThrow();
  });

  it('rolls back consumption when the user email conflicts', async () => {
    const inviter = await createTestUser({ email: 'admin2@example.com' });
    await createTestUser({ email: 'taken@example.com' });
    const now = Date.now();
    const { tokenHash } = await invitation('taken@example.com', inviter);

    await expect(acceptInvitation(db, tokenHash, now, userMaterial('taken@example.com', now))).rejects.toThrow();
    expect(await findValidInvitation(db, tokenHash, now)).not.toBeNull();
  });
});

describe('last admin guards', () => {
  it('refuses to disable the last active admin', async () => {
    const admin = await createTestUser({ email: 'only-admin@example.com' });
    await db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(admin).run();

    const member = await createTestUser({ email: 'observer@example.com' });
    await expect(disableUser(env as unknown as Env, member, admin)).resolves.toBe('last-admin');
    expect((await createUsersQueries(env as unknown as Env).findSessionUser(admin))?.status).toBe('active');
  });

  it('allows disabling one of two admins and protects the last one', async () => {
    const first = await createTestUser({ email: 'admin-a@example.com' });
    const second = await createTestUser({ email: 'admin-b@example.com' });
    await db.prepare("UPDATE users SET role = 'admin' WHERE id IN (?, ?)").bind(first, second).run();

    await expect(disableUser(env as unknown as Env, second, first)).resolves.toBe('ok');
    await expect(changeRole(env as unknown as Env, first, second, 'member')).resolves.toBe('last-admin');
    await expect(changeRole(env as unknown as Env, second, second, 'member')).resolves.toBe('self');
  });
});
