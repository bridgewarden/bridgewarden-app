import { data } from 'react-router';

import type { Route } from './+types/admin.users.invite';
import { inviteSchema } from '~/features/admin-users/admin-users.schema';
import { readAdminMutation } from '~/features/admin-users/.server/admin-mutation';
import { createInvitation } from '~/features/admin-users/.server/use-cases/create-invitation';

export async function action({ request, context }: Route.ActionArgs) {
  const guard = await readAdminMutation(request, context, (value) => {
    const parsed = inviteSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  });
  if (!guard.ok) return guard.response;

  const result = await createInvitation(guard.env, guard.user.id, guard.input);

  if (result.status === 'user-exists') return data({ ok: false, error: 'user-exists' }, { status: 409 });
  if (result.status === 'conflict') return data({ ok: false, error: 'conflict' }, { status: 409 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true, setupUrl: result.setupUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
