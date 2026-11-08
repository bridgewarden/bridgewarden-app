import { data } from 'react-router';

import type { Route } from './+types/api-account-2fa-verify';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { requireUserApi } from '~/lib/.server/require-user';
import { parseCodeInput } from '~/features/two-factor/.server/two-factor-input';
import { verifyEnrollment } from '~/features/two-factor/.server/use-cases/verify-enrollment';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const input = parseCodeInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireUserApi(request, env);
  const result = await verifyEnrollment(env, request, user.id, input.code);

  if (result.status === 'invalid-code') return data({ ok: false, error: 'invalid-code' }, { status: 401 });
  if (result.status === 'not-pending') return data({ ok: false, error: 'not-pending' }, { status: 409 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true, backupCodes: result.backupCodes }, { headers: { 'Cache-Control': 'no-store' } });
}
