import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { readConfig } from '../../../../lib/.server/env';
import { createInvitationToken } from '../../../../lib/.server/invitation-token';
import { createSetupInvitationQueries } from '../../../../lib/.server/queries/setup-invitations';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { InvitationResult } from '../../admin-users.types';
import { INVITATION_TTL_MS } from '../constants/invitations';

export type CreateInvitationInput = {
  email: string;
  displayName: string;
  role: 'admin' | 'member';
};

export const createInvitation = async (
  env: Env,
  actorId: string,
  input: CreateInvitationInput,
): Promise<InvitationResult> => {
  const origin = readConfig(env, 'APP_ORIGIN');
  if (!origin) return { status: 'server-error' };
  const users = createUsersQueries(env);
  if (await users.findIdByEmail(input.email)) return { status: 'user-exists' };

  const now = Date.now();
  const { token, tokenHash } = await createInvitationToken();
  const invitationId = crypto.randomUUID();
  const created = await createSetupInvitationQueries(env).upsert({
    id: invitationId,
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    tokenHash,
    invitedById: actorId,
    expiresAt: now + INVITATION_TTL_MS,
    now,
  });

  if (!created) return { status: 'conflict' };

  await recordAuditEventSafe(env, {
    type: 'admin.invitation_created',
    userId: actorId,
    createdAt: now,
    metadata: JSON.stringify({ invitationId }),
  });

  return { status: 'ok', setupUrl: `${origin.replace(/\/$/, '')}/setup/member?token=${token}` };
};
