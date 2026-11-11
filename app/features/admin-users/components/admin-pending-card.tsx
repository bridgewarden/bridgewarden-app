import { Badge } from '~/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { t, type MessageKey } from '~/lib/i18n/en';

import type { AdminUsersPageData } from '../admin-users.types';

type AdminPendingCardProps = { invitations: AdminUsersPageData['invitations'] };

export const AdminPendingCard = ({ invitations }: AdminPendingCardProps) => (
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
            <Badge variant="outline">{t('adminUsers.pendingSetup')}</Badge>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);
