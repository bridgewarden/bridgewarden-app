import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { UserMutationResult } from '../../admin-users.types';
import { auditMutation } from './audit-mutation';

export const disableUser = async (env: Env, actorId: string, targetId: string): Promise<UserMutationResult> => {
  if (actorId === targetId) return 'self';
  const result = await createUsersQueries(env).disableGuarded(targetId, Date.now());
  if (result.meta.changes !== 1) return 'last-admin';
  await auditMutation(env, 'admin.user_disabled', actorId, targetId);
  return 'ok';
};
