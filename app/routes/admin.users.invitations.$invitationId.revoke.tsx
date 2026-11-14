import { data } from 'react-router';

import type { Route } from './+types/admin.users.invitations.$invitationId.revoke';
import { invitationIdSchema } from '~/features/admin-users/admin-users.schema';
import { readAdminMutation } from '~/features/admin-users/.server/admin-mutation';
import { revokePendingInvitation } from '~/features/admin-users/.server/use-cases/revoke-invitation';

export async function action({ request, context, params }: Route.ActionArgs) {
  const guard = await readAdminMutation(request, context);
  if (!guard.ok) return guard.response;

  const target = invitationIdSchema.safeParse(params.invitationId);
  if (!target.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const result = await revokePendingInvitation(guard.env, guard.user.id, target.data);
  if (result === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404 });
  return data({ ok: true });
}
