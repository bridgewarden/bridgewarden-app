import { WifiOffIcon } from 'lucide-react';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { useOnlineStatus } from '~/hooks/use-online-status';
import { t } from '~/lib/i18n/en';

export const OfflineBanner = () => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Alert role="status" className="rounded-none border-x-0 border-t-0">
      <WifiOffIcon aria-hidden="true" />
      <AlertDescription>{t('common.offline')}</AlertDescription>
    </Alert>
  );
};
