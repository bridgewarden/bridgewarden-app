import { CopyIcon, UserPlusIcon } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { toast } from 'sonner';

import { t, type MessageKey } from '~/lib/i18n/en';

import type { AdminUsersPageData } from '../admin-users.types';
import { useAdminUsers } from '../admin-users.hooks';

type AdminUsersPanelProps = { data: AdminUsersPageData };

const ERROR_KEYS: Record<string, MessageKey> = {
  'user-exists': 'adminUsers.error.userExists',
  conflict: 'adminUsers.error.conflict',
  'last-admin': 'adminUsers.error.lastAdmin',
  'not-found': 'adminUsers.error.notFound',
  'invalid-input': 'adminUsers.error.invalidInput',
  forbidden: 'adminUsers.error.forbidden',
  self: 'adminUsers.error.self',
  'rate-limited': 'adminUsers.error.rateLimited',
  'server-error': 'adminUsers.error.serverError',
};

const errorMessage = (code: string) => t(ERROR_KEYS[code] ?? 'adminUsers.error.serverError');

export const AdminUsersPanel = ({ data }: AdminUsersPanelProps) => {
  const flow = useAdminUsers();
  return (
    <section className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('adminUsers.title')}</h1>
        <p className="text-muted-foreground">{t('adminUsers.description')}</p>
      </div>

      <form
        className="space-y-4 rounded-lg border p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          flow.createInvitation({
            email: String(form.get('email') ?? ''),
            displayName: String(form.get('displayName') ?? ''),
            role: form.get('role') === 'admin' ? 'admin' : 'member',
          });
        }}
      >
        <h2 className="text-lg font-medium">{t('adminUsers.inviteTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t('adminUsers.email')}</Label>
            <Input id="invite-email" name="email" type="email" required maxLength={254} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">{t('adminUsers.displayName')}</Label>
            <Input id="invite-name" name="displayName" required maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t('adminUsers.role')}</Label>
            <select
              id="invite-role"
              name="role"
              defaultValue="member"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <Button type="submit" className="min-h-11" disabled={flow.invitation.state !== 'idle'}>
          <UserPlusIcon aria-hidden="true" />
          {t('adminUsers.createInvitation')}
        </Button>
        {flow.invitation.data && !flow.invitation.data.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(flow.invitation.data.error)}
          </p>
        ) : null}
        {flow.setupUrl ? (
          <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm">{t('adminUsers.setupLinkWarning')}</p>
            <div className="flex gap-2">
              <Input readOnly value={flow.setupUrl} aria-label={t('adminUsers.setupLink')} />
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(flow.setupUrl!);
                    toast.success(t('adminUsers.copied'));
                  } catch {
                    toast.error(t('adminUsers.copyFailed'));
                  }
                }}
              >
                <CopyIcon aria-hidden="true" />
                {t('adminUsers.copyLink')}
              </Button>
            </div>
          </div>
        ) : null}
      </form>

      <div className="space-y-3 rounded-lg border p-5">
        <h2 className="text-lg font-medium">{t('adminUsers.usersTitle')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">{t('adminUsers.email')}</th>
                <th className="p-2">{t('adminUsers.role')}</th>
                <th className="p-2">{t('adminUsers.status')}</th>
                <th className="p-2">{t('adminUsers.twoFactor')}</th>
                <th className="p-2">{t('adminUsers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id} className="border-b last:border-0">
                  <td className="p-2">
                    <div className="font-medium">{user.displayName ?? user.email}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="p-2">
                    <select
                      aria-label={`${t('adminUsers.role')} — ${user.email}`}
                      value={user.role}
                      disabled={flow.mutation.state !== 'idle' || user.id === data.currentUserId}
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      onChange={(event) => flow.mutate(`/admin/users/${user.id}/role`, { role: event.target.value })}
                    >
                      <option value="member">{t('adminUsers.role.member')}</option>
                      <option value="admin">{t('adminUsers.role.admin')}</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'}>
                      {t(`adminUsers.status.${user.status}` as MessageKey)}
                    </Badge>
                  </td>
                  <td className="p-2">{user.twoFactorEnabled ? t('common.yes') : t('common.no')}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={flow.mutation.state !== 'idle' || user.id === data.currentUserId}
                        onClick={() =>
                          flow.mutate(`/admin/users/${user.id}/${user.status === 'active' ? 'disable' : 'enable'}`)
                        }
                      >
                        {user.status === 'active' ? t('adminUsers.disable') : t('adminUsers.enable')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={flow.mutation.state !== 'idle' || user.id === data.currentUserId}
                        onClick={() => flow.mutate(`/admin/users/${user.id}/revoke`)}
                      >
                        {t('adminUsers.revokeSessions')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {flow.mutation.data && !flow.mutation.data.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(flow.mutation.data.error)}
          </p>
        ) : null}
      </div>

      {data.invitations.length > 0 ? (
        <div className="space-y-3 rounded-lg border p-5">
          <h2 className="text-lg font-medium">{t('adminUsers.pendingTitle')}</h2>
          <ul className="space-y-2 text-sm">
            {data.invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                <span>
                  {invitation.display_name} · {invitation.email} ·{' '}
                  {t(`adminUsers.role.${invitation.role}` as MessageKey)}
                </span>
                <Badge variant="outline">{t('adminUsers.pendingSetup')}</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
};
