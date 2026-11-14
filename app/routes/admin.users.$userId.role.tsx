import { data } from 'react-router';

import type { Route } from './+types/admin.users.$userId.role';
import { roleSchema, userIdSchema } from '~/features/admin-users/admin-users.schema';
import { readAdminMutation } from '~/features/admin-users/.server/admin-mutation';
import { changeRole } from '~/features/admin-users/.server/use-cases/change-role';

export async function action({ request, context, params }: Route.ActionArgs) {
  const guard = await readAdminMutation(request, context, (value) => {
    const parsed = roleSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  if (!guard.ok) return guard.response;

  const target = userIdSchema.safeParse(params.userId);
  if (!target.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const result = await changeRole(guard.env, guard.user.id, target.data, guard.input.role);
  if (result === 'self') return data({ ok: false, error: 'self' }, { status: 409 });
  if (result === 'last-admin') return data({ ok: false, error: 'last-admin' }, { status: 409 });
  if (result === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404 });
  return data({ ok: true });
}
