import { data } from 'react-router';

import type { Route } from './+types/setup.member';
import MemberSetup from '~/features/member-setup';
import { parseMemberSetupInput } from '~/features/member-setup/.server/member-setup-input';
import { completeMemberSetup } from '~/features/member-setup/.server/use-cases/complete-member-setup';
import { cloudflareContext } from '~/lib/.server/context';
import { readConfig } from '~/lib/.server/env';
import { hashInvitationToken } from '~/lib/.server/invitation-token';
import { readMutationJson } from '~/lib/.server/json-action';
import { createSetupInvitationQueries } from '~/lib/.server/queries/setup-invitations';
import { limitIp, rateLimited } from '~/lib/.server/rate-limit';
import { isSameOrigin } from '~/lib/.server/request-origin';
import { t } from '~/lib/i18n/en';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return data({ valid: false as const }, { headers: { 'Cache-Control': 'no-store' } });

  const invitation = await createSetupInvitationQueries(env).findValid(await hashInvitationToken(token), Date.now());
  if (!invitation) return data({ valid: false as const }, { headers: { 'Cache-Control': 'no-store' } });

  return data(
    {
      valid: true as const,
      email: invitation.email,
      displayName: invitation.display_name,
      role: invitation.role,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  if (!isSameOrigin(request, readConfig(env, 'APP_ORIGIN'), readConfig(env, 'APP_ENV') === 'development')) {
    return data({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const ipLimit = await limitIp(env, 'member-setup', request);
  if (!ipLimit.allowed) return rateLimited(ipLimit.retryAfter);

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) return data({ ok: false, error: mutation.error }, { status: mutation.status });
  const input = parseMemberSetupInput(mutation.value);
  if (!input) return data({ ok: false, error: 'invalid-input' }, { status: 400 });

  const result = await completeMemberSetup(env, input);
  if (result.status === 'invalid') return data({ ok: false, error: 'invalid' }, { status: 401 });
  if (result.status === 'conflict') return data({ ok: false, error: 'conflict' }, { status: 409 });
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });

  return data({ ok: true }, { headers: { 'Set-Cookie': result.cookie, 'Cache-Control': 'no-store' } });
}

export default function MemberSetupRoute({ loaderData }: Route.ComponentProps) {
  return <MemberSetup {...loaderData} />;
}

export const meta = () => [{ title: t('memberSetup.title') }];
