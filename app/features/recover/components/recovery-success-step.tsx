import { Link } from 'react-router';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

import { RecoveryKeyPanel } from './recovery-key-panel';

type RecoverySuccessStepProps = {
  recoveryKey: string;
  sessionIssued: boolean;
};

export const RecoverySuccessStep = ({ recoveryKey, sessionIssued }: RecoverySuccessStepProps) => (
  <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{t('recover.success.description')}</p>
    <RecoveryKeyPanel recoveryKey={recoveryKey} />
    <Alert variant="destructive">
      <AlertDescription>{t('recover.success.warning')}</AlertDescription>
    </Alert>
    <Button asChild className="min-h-11 w-full">
      <Link to={sessionIssued ? '/app' : '/login'}>
        {t(sessionIssued ? 'recover.success.continue' : 'recover.success.signIn')}
      </Link>
    </Button>
    {sessionIssued ? (
      <Button asChild variant="ghost" className="min-h-11 w-full">
        <Link to="/login">{t('common.signIn')}</Link>
      </Button>
    ) : null}
  </div>
);
