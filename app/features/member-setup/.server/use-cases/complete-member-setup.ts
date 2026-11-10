import { deriveServerAuthHash, generateServerSalt } from '../../../../lib/.server/auth-hash';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { hashInvitationToken } from '../../../../lib/.server/invitation-token';
import { createSetupInvitationQueries } from '../../../../lib/.server/queries/setup-invitations';
import { createSession, destroySessionToken } from '../../../../lib/.server/session';
import type { MemberSetupInput } from '../member-setup-input';

export type MemberSetupResult =
  { status: 'ok'; cookie: string } | { status: 'invalid' } | { status: 'conflict' } | { status: 'server-error' };

export const completeMemberSetup = async (env: Env, input: MemberSetupInput): Promise<MemberSetupResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const now = Date.now();
  const tokenHash = await hashInvitationToken(input.token);
  const invitations = createSetupInvitationQueries(env);
  const invitation = await invitations.findValid(tokenHash, now);
  if (!invitation) return { status: 'invalid' };

  const serverAuthHash = await deriveServerAuthHash(input.authHashBytes, generateServerSalt(), pepper);
  const userId = crypto.randomUUID();

  let session: Awaited<ReturnType<typeof createSession>>;
  try {
    session = await createSession(env, { userId, ver: 0 });
  } catch {
    return { status: 'server-error' };
  }

  let accepted: boolean;
  try {
    accepted = await invitations.accept(tokenHash, now, {
      id: userId,
      email: invitation.email,
      displayName: invitation.display_name,
      role: invitation.role,
      authHash: serverAuthHash.authHash,
      serverSalt: serverAuthHash.serverSalt,
      kdfIterations: input.kdfIterations,
      kdfSalt: input.kdfSalt,
      vaultKeyWrapped: input.vaultKeyWrapped,
      vaultKeyWrapIv: input.vaultKeyWrapIv,
      recoveryKeyWrapped: input.recoveryKeyWrapped,
      recoveryKeyWrapIv: input.recoveryKeyWrapIv,
      now,
    });
  } catch {
    await destroySessionToken(env, session.token).catch(() => undefined);
    return { status: 'conflict' };
  }

  if (!accepted) {
    await destroySessionToken(env, session.token).catch(() => undefined);
    return { status: 'invalid' };
  }

  await recordAuditEventSafe(env, { type: 'member.setup_completed', userId, createdAt: now });
  return { status: 'ok', cookie: session.cookie };
};
