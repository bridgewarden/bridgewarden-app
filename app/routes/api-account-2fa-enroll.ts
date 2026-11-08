import { data } from 'react-router';

import type { Route } from './+types/api-account-2fa-enroll';
import { cloudflareContext } from '~/lib/.server/context';
import { readMutationJson } from '~/lib/.server/json-action';
import { requireUserApi } from '~/lib/.server/require-user';
import { beginEnrollment } from '~/features/two-factor/.server/use-cases/enroll';
import { parseDisableInput } from '~/features/two-factor/.server/two-factor-input';

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });

  const input = parseDisableInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const { user } = await requireUserApi(request, env);
  const result = await beginEnrollment(env, request, user.id, user.email, input);

  if (result.status === 'invalid-password') {
    return data({ ok: false, error: 'invalid-password' }, { status: 400 });
  }
  if (result.status === 'already-enabled') {
    return data({ ok: false, error: 'already-enabled' }, { status: 409 });
  }
  if (result.status === 'server-error') {
    return data({ ok: false, error: 'server-error' }, { status: 500 });
  }

  return data({ ok: true, secret: result.secret, uri: result.uri }, { headers: { 'Cache-Control': 'no-store' } });
}
