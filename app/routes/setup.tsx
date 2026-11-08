import { data } from 'react-router';

import type { Route } from './+types/setup';
import Setup, { type SetupActionResponse, type SetupError } from '~/features/setup';
import { parseSetupInput } from '~/features/setup/.server/setup-input';
import { completeBootstrap } from '~/features/setup/.server/use-cases/complete-bootstrap';
import { cloudflareContext } from '~/lib/.server/context';
import { readConfig } from '~/lib/.server/env';
import { readJsonBody } from '~/lib/.server/request-body';
import { requireBootstrapAvailable } from '~/lib/.server/setup-guard';
import { isSameOrigin } from '~/lib/.server/request-origin';
import { t } from '~/lib/i18n/en';

const failure = (error: SetupError, status: number) => data<SetupActionResponse>({ ok: false, error }, { status });

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);

  await requireBootstrapAvailable(env);

  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);

  if (!isSameOrigin(request, readConfig(env, 'APP_ORIGIN'), readConfig(env, 'APP_ENV') === 'development')) {
    return failure('forbidden', 403);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return failure('invalid-input', body.reason === 'too-large' ? 413 : body.reason === 'unsupported' ? 415 : 400);
  }

  const input = parseSetupInput(body.value);
  if (!input) {
    return failure('invalid-input', 400);
  }

  const result = await completeBootstrap(env, input);

  switch (result.status) {
    case 'exists':
      return failure('already-configured', 409);
    case 'server-error':
      return failure('server-error', 500);
    case 'created':
      return data<SetupActionResponse>(
        { ok: true },
        { status: 200, headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } },
      );
  }
}

export default function SetupRoute() {
  return <Setup />;
}

export const shouldRevalidate = () => false;

export const meta = () => [{ title: t('setup.title') }];
