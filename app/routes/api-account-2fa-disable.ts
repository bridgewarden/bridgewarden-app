import { data } from 'react-router';

import type { Route } from './+types/api-account-2fa-disable';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { requireUserApi } from '~/lib/.server/require-user';
import { parseDisableInput } from '~/features/two-factor/.server/two-factor-input';
import { disableTwoFactor } from '~/features/two-factor/.server/use-cases/disable';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const input = parseDisableInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireUserApi(request, env);
  const result = await disableTwoFactor(env, request, user.id, input);

  if (result.status === 'invalid-password') return data({ ok: false, error: 'invalid-password' }, { status: 400 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
