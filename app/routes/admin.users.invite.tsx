import { data } from 'react-router';

import type { Route } from './+types/admin.users.invite';
import { inviteSchema } from '~/features/admin-users/admin-users.schema';
import { createInvitation } from '~/features/admin-users/.server/use-cases/create-invitation';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { requireAdminApi } from '~/lib/.server/require-user';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const input = inviteSchema.safeParse(mutation.value);
  if (!input.success) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireAdminApi(request, env);
  const result = await createInvitation(env, user.id, input.data);

  if (result.status === 'user-exists') return data({ ok: false, error: 'user-exists' }, { status: 409 });
  if (result.status === 'conflict') return data({ ok: false, error: 'conflict' }, { status: 409 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true, setupUrl: result.setupUrl }, { headers: { 'Cache-Control': 'no-store' } });
}
