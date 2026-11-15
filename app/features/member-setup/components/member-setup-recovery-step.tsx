import { RecoveryKeyCard } from '~/components/recovery-key-card';
import { InlineError } from '~/components/inline-error';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import { MEMBER_SETUP_ERROR_KEY, type MemberSetupError } from '../member-setup.constants';

type MemberSetupRecoveryStepProps = {
  values: { recoveryKey: string; confirmation: string };
  error: MemberSetupError | null;
  formError: string | null;
  busy: boolean;
  status: { copy: 'idle' | 'copied' | 'failed'; download: 'idle' | 'downloaded' | 'failed' };
  actions: {
    onConfirmationChange: (value: string) => void;
    onCopy: () => void;
    onDownload: () => void;
    onBack: () => void;
    onSubmit: () => void;
  };
};

export const MemberSetupRecoveryStep = ({
  values,
  error,
  formError,
  busy,
  status,
  actions,
}: MemberSetupRecoveryStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      actions.onSubmit();
    }}
  >
    <RecoveryKeyCard
      recoveryKey={values.recoveryKey}
      ariaLabel={t('memberSetup.recoveryLabel')}
      warning={t('memberSetup.recoveryWarning')}
      copyStatus={status.copy}
      downloadStatus={status.download}
      onCopy={actions.onCopy}
      onDownload={actions.onDownload}
    />
    <div className="space-y-2">
      <Label htmlFor="member-recovery-confirm">{t('memberSetup.recoveryConfirm')}</Label>
      <Input
        id="member-recovery-confirm"
        autoComplete="off"
        spellCheck={false}
        disabled={busy}
        value={values.confirmation}
        aria-invalid={error === 'recovery'}
        aria-describedby={error === 'recovery' ? 'member-recovery-hint member-recovery-error' : 'member-recovery-hint'}
        onChange={(event) => actions.onConfirmationChange(event.target.value)}
      />
      <p id="member-recovery-hint" className="text-sm text-muted-foreground">
        {t('setup.recovery.confirmHint')}
      </p>
      {error === 'recovery' ? (
        <p id="member-recovery-error" role="alert" className="text-sm text-destructive">
          {t(MEMBER_SETUP_ERROR_KEY.recovery)}
        </p>
      ) : null}
    </div>
    {formError ? <InlineError message={formError} /> : null}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full sm:w-auto"
        disabled={busy}
        onClick={actions.onBack}
      >
        {t('setup.back')}
      </Button>
      <Button type="submit" className="min-h-11 w-full sm:flex-1" disabled={busy}>
        {busy ? t('memberSetup.generating') : t('memberSetup.submit')}
      </Button>
    </div>
  </form>
);
