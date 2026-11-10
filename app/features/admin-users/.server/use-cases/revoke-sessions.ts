import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { UserMutationResult } from '../../admin-users.types';
import { auditMutation } from './audit-mutation';

export const revokeSessions = async (env: Env, actorId: string, targetId: string): Promise<UserMutationResult> => {
  if (actorId === targetId) return 'self';
  const result = await createUsersQueries(env).revokeSessions(targetId, Date.now());
  if (result.meta.changes !== 1) return 'not-found';
  await auditMutation(env, 'admin.sessions_revoked', actorId, targetId);
  return 'ok';
};
