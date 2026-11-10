import { data } from 'react-router';

import type { Route } from './+types/admin.users.$userId.role';
import { roleSchema, userIdSchema } from '~/features/admin-users/admin-users.schema';
import { changeRole } from '~/features/admin-users/.server/use-cases/change-role';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { requireAdminApi } from '~/lib/.server/require-user';

export async function action({ request, context, params }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const target = userIdSchema.safeParse(params.userId);
  const input = roleSchema.safeParse(mutation.value);
  if (!target.success || !input.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireAdminApi(request, env);
  const result = await changeRole(env, user.id, target.data, input.data.role);
  if (result === 'self') return data({ ok: false, error: 'self' }, { status: 409 });
  if (result === 'last-admin') return data({ ok: false, error: 'last-admin' }, { status: 409 });
  if (result === 'not-found') return data({ ok: false, error: 'not-found' }, { status: 404 });
  return data({ ok: true });
}
