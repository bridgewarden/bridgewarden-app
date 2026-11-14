import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { createSetupInvitationQueries } from '../../../../lib/.server/queries/setup-invitations';

export type RevokeInvitationResult = 'ok' | 'not-found';

export const revokePendingInvitation = async (
  env: Env,
  actorId: string,
  invitationId: string,
): Promise<RevokeInvitationResult> => {
  const now = Date.now();
  const result = await createSetupInvitationQueries(env).revoke(invitationId, now);
  if (result.meta.changes !== 1) return 'not-found';

  await recordAuditEventSafe(env, {
    type: 'admin.invitation_revoked',
    userId: actorId,
    createdAt: now,
    metadata: JSON.stringify({ invitationId }),
  });
  return 'ok';
};
