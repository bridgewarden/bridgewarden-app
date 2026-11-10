import type { Route } from './+types/admin.users';
import AdminUsersPage from '~/features/admin-users';
import { listAdminUsers } from '~/features/admin-users/.server/use-cases/list-users';
import { cloudflareContext } from '~/lib/.server/context';
import { requireAdmin } from '~/lib/.server/require-user';
import { t } from '~/lib/i18n/en';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const { user } = await requireAdmin(request, env);
  return listAdminUsers(env, user.id);
}

export default function AdminUsersRoute({ loaderData }: Route.ComponentProps) {
  return <AdminUsersPage {...loaderData} />;
}

export const meta = () => [{ title: t('adminUsers.title') }];
