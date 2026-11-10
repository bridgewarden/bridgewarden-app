import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { UserMutationResult } from '../../admin-users.types';
import { auditMutation } from './audit-mutation';

export const changeRole = async (
  env: Env,
  actorId: string,
  targetId: string,
  role: 'admin' | 'member',
): Promise<UserMutationResult> => {
  if (actorId === targetId) return 'self';
  const result = await createUsersQueries(env).changeRoleGuarded(targetId, role, Date.now());
  if (result.meta.changes !== 1) return 'last-admin';
  await auditMutation(env, 'admin.role_changed', actorId, targetId);
  return 'ok';
};
