import type { ShouldRevalidateFunctionArgs } from 'react-router';

import type { Route } from './+types/settings';
import AccountSettings from '~/features/account-settings';
import { cloudflareContext } from '~/lib/.server/context';
import { requireUser } from '~/lib/.server/require-user';
import { t } from '~/lib/i18n/en';

import { getPasswordKdf } from '~/features/account-settings/.server/use-cases/password-kdf';
import { getTwoFactorSummary } from '~/features/two-factor/.server/use-cases/two-factor-summary';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUser(request, env);
  const password = await getPasswordKdf(env, user.id);
  if (!password) throw new Response(null, { status: 500 });

  return {
    email: user.email,
    displayName: user.displayName,
    twoFactor: await getTwoFactorSummary(env, user.id),
    password,
  };
}

export default function SettingsRoute({ loaderData }: Route.ComponentProps) {
  return <AccountSettings {...loaderData} />;
}

export const meta = () => [{ title: t('settings.title') }];

export const shouldRevalidate = ({ formAction }: ShouldRevalidateFunctionArgs) => formAction !== '/auth/logout';
