import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { t, type MessageKey } from '~/lib/i18n/en';

import { adminInvitationErrorMessage } from '../admin-users.lib';

import type { AdminUsersPageData } from '../admin-users.types';

type AdminPendingCardProps = {
  invitations: AdminUsersPageData['invitations'];
  disabled?: boolean;
  error?: string | null;
  onRevoke: (id: string) => void;
};

export const AdminPendingCard = ({ invitations, disabled = false, error = null, onRevoke }: AdminPendingCardProps) => (
  <Card>
    <CardHeader>
      <CardTitle role="heading" aria-level={2}>
        {t('adminUsers.pendingTitle')}
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2 text-sm">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
            <span>
              {invitation.display_name} · {invitation.email} · {t(`adminUsers.role.${invitation.role}` as MessageKey)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11"
              aria-label={`${t('adminUsers.revokeInvitation')} — ${invitation.email}`}
              disabled={disabled}
              onClick={() => onRevoke(invitation.id)}
            >
              {t('adminUsers.revokeInvitation')}
            </Button>
          </li>
        ))}
      </ul>
      {error ? (
        <Alert variant="destructive" role="alert" className="mt-3">
          <AlertTitle>{t('adminUsers.error.title')}</AlertTitle>
          <AlertDescription>{adminInvitationErrorMessage(error)}</AlertDescription>
        </Alert>
      ) : null}
    </CardContent>
  </Card>
);
