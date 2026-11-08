import type { ShouldRevalidateFunctionArgs } from 'react-router';

import type { Route } from './+types/settings';
import AccountSettings from '~/features/account-settings';
import { cloudflareContext } from '~/lib/.server/context';
import { requireUser } from '~/lib/.server/require-user';
import { t } from '~/lib/i18n/en';

import { getTwoFactorSummary } from '~/features/two-factor/.server/use-cases/two-factor-summary';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireUser(request, env);
  return {
    email: user.email,
    displayName: user.displayName,
    twoFactor: await getTwoFactorSummary(env, user.id),
  };
}

export default function SettingsRoute({ loaderData }: Route.ComponentProps) {
  return <AccountSettings {...loaderData} />;
}

export const meta = () => [{ title: t('settings.title') }];

export const shouldRevalidate = ({ formAction }: ShouldRevalidateFunctionArgs) => formAction !== '/auth/logout';
