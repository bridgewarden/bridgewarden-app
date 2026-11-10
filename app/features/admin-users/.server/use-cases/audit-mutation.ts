import { recordAuditEventSafe } from '../../../../lib/.server/audit';

export const auditMutation = (env: Env, type: string, actorId: string, targetId: string) =>
  recordAuditEventSafe(env, {
    type,
    userId: actorId,
    createdAt: Date.now(),
    metadata: JSON.stringify({ targetUserId: targetId }),
  });
