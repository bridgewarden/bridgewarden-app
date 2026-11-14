import { data } from 'react-router';

import type { Route } from './+types/admin.users.$userId.revoke';
import { userIdSchema } from '~/features/admin-users/admin-users.schema';
import { readAdminMutation } from '~/features/admin-users/.server/admin-mutation';
import { revokeSessions } from '~/features/admin-users/.server/use-cases/revoke-sessions';

export async function action({ request, context, params }: Route.ActionArgs) {
  const guard = await readAdminMutation(request, context);
  if (!guard.ok) return guard.response;

  const target = userIdSchema.safeParse(params.userId);
  if (!target.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const result = await revokeSessions(guard.env, guard.user.id, target.data);
  if (result === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404 });
  return data({ ok: true });
}
