import { CopyIcon, UserPlusIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/components/ui/table';

import { t, type MessageKey } from '~/lib/i18n/en';

import { adminErrorMessage } from '../admin-users.lib';

import type { AdminUsersPageData } from '../admin-users.types';
import { useAdminUsers } from '../admin-users.hooks';
import { AdminPendingCard } from './admin-pending-card';

type AdminUsersPanelProps = { data: AdminUsersPageData };

export const AdminUsersPanel = ({ data }: AdminUsersPanelProps) => {
  const flow = useAdminUsers();
  return (
    <section className="mx-auto w-full max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('adminUsers.title')}</h1>
        <p className="text-muted-foreground">{t('adminUsers.description')}</p>
      </div>

      <form
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
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t('adminUsers.inviteTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                <NativeSelect id="invite-role" name="role" defaultValue="member" wrapperClassName="w-full">
                  <NativeSelectOption value="member">{t('adminUsers.role.member')}</NativeSelectOption>
                  <NativeSelectOption value="admin">{t('adminUsers.role.admin')}</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
            <Button type="submit" className="min-h-11" disabled={flow.invitation.state !== 'idle'}>
              <UserPlusIcon aria-hidden="true" />
              {t('adminUsers.createInvitation')}
            </Button>
            {flow.invitation.data && !flow.invitation.data.ok ? (
              <Alert variant="destructive">
                <AlertTitle>{t('adminUsers.error.title')}</AlertTitle>
                <AlertDescription>{adminErrorMessage(flow.invitation.data.error)}</AlertDescription>
              </Alert>
            ) : null}
            {flow.setupUrl ? (
              <>
                <Alert role="status">
                  <AlertTitle>{t('adminUsers.setupLink')}</AlertTitle>
                  <AlertDescription>{t('adminUsers.setupLinkWarning')}</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Input readOnly value={flow.setupUrl} aria-label={t('adminUsers.setupLink')} />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={async () => {
                      const setupUrl = flow.setupUrl;
                      if (!setupUrl) return;
                      try {
                        await navigator.clipboard.writeText(setupUrl);
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
              </>
            ) : null}
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            {t('adminUsers.usersTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Table aria-label={t('adminUsers.usersTitle')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminUsers.email')}</TableHead>
                <TableHead>{t('adminUsers.role')}</TableHead>
                <TableHead>{t('adminUsers.status')}</TableHead>
                <TableHead>{t('adminUsers.twoFactor')}</TableHead>
                <TableHead>{t('adminUsers.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium">{user.displayName ?? user.email}</div>
                    <div className="text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>
                    <NativeSelect
                      aria-label={`${t('adminUsers.role')} — ${user.email}`}
                      defaultValue={user.role}
                      className="min-h-11"
                      wrapperClassName="w-full"
                      disabled={user.id === data.currentUserId}
                      onChange={(event) => flow.mutate(`/admin/users/${user.id}/role`, { role: event.target.value })}
                    >
                      <NativeSelectOption value="member">{t('adminUsers.role.member')}</NativeSelectOption>
                      <NativeSelectOption value="admin">{t('adminUsers.role.admin')}</NativeSelectOption>
                    </NativeSelect>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'}>
                      {t(`adminUsers.status.${user.status}` as MessageKey)}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.twoFactorEnabled ? t('common.yes') : t('common.no')}</TableCell>
                  <TableCell>
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {flow.mutation.data && !flow.mutation.data.ok ? (
            <Alert variant="destructive">
              <AlertTitle>{t('adminUsers.error.title')}</AlertTitle>
              <AlertDescription>{adminErrorMessage(flow.mutation.data.error)}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {data.invitations.length > 0 ? (
        <AdminPendingCard
          invitations={data.invitations}
          disabled={flow.invitationMutation.state !== 'idle'}
          error={
            flow.invitationMutation.data && !flow.invitationMutation.data.ok ? flow.invitationMutation.data.error : null
          }
          onRevoke={flow.revokeInvitation}
        />
      ) : null}
    </section>
  );
};
