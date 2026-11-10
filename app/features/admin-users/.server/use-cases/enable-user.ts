import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { UserMutationResult } from '../../admin-users.types';
import { auditMutation } from './audit-mutation';

export const enableUser = async (env: Env, actorId: string, targetId: string): Promise<UserMutationResult> => {
  const result = await createUsersQueries(env).enable(targetId, Date.now());
  if (result.meta.changes !== 1) return 'not-found';
  await auditMutation(env, 'admin.user_enabled', actorId, targetId);
  return 'ok';
};
