import { data } from 'react-router';

import type { Route } from './+types/admin.users.$userId.disable';
import { userIdSchema } from '~/features/admin-users/admin-users.schema';
import { readAdminMutation } from '~/features/admin-users/.server/admin-mutation';
import { disableUser } from '~/features/admin-users/.server/use-cases/disable-user';

export async function action({ request, context, params }: Route.ActionArgs) {
  const guard = await readAdminMutation(request, context);
  if (!guard.ok) return guard.response;

  const target = userIdSchema.safeParse(params.userId);
  if (!target.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const result = await disableUser(guard.env, guard.user.id, target.data);
  if (result === 'self') return data({ ok: false, error: 'self' }, { status: 409 });
  if (result === 'last-admin') return data({ ok: false, error: 'last-admin' }, { status: 409 });
  if (result === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404 });
  return data({ ok: true });
}
