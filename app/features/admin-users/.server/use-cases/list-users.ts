import { createSetupInvitationQueries } from '../../../../lib/.server/queries/setup-invitations';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import type { AdminUsersPageData } from '../../admin-users.types';
import { ADMIN_USER_LIST_LIMIT } from '../constants/invitations';

export const listAdminUsers = async (env: Env, currentUserId: string): Promise<AdminUsersPageData> => {
  const now = Date.now();
  const [users, invitations] = await Promise.all([
    createUsersQueries(env).listAdmin(ADMIN_USER_LIST_LIMIT),
    createSetupInvitationQueries(env).listPending(now),
  ]);

  return { users, invitations, currentUserId };
};
