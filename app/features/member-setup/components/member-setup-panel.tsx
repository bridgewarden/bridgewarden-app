import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import { useMemberSetup } from '../member-setup.hooks';

type MemberSetupPanelProps = {
  invitation: { email: string; displayName: string; role: string } | null;
};

export const MemberSetupPanel = ({ invitation }: MemberSetupPanelProps) => {
  const flow = useMemberSetup();
  if (!invitation) {
    return (
      <section className="mx-auto w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">{t('memberSetup.title')}</h1>
        <p role="alert" className="text-sm text-destructive">
          {t('memberSetup.invalid')}
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('memberSetup.title')}</h1>
        <p className="text-muted-foreground">
          {invitation.displayName} · {invitation.email} · {invitation.role}
        </p>
      </div>

      {flow.material ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p id="member-recovery-label" className="text-sm font-medium">
              {t('memberSetup.recoveryLabel')}
            </p>
            <code
              id="member-recovery-key"
              aria-labelledby="member-recovery-label"
              className="block rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all select-all"
            >
              {flow.recoveryKey}
            </code>
            <p className="text-sm text-muted-foreground">{t('memberSetup.recoveryWarning')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-recovery-confirm">{t('memberSetup.recoveryConfirm')}</Label>
            <Input
              id="member-recovery-confirm"
              value={flow.confirmation}
              aria-invalid={flow.error === 'recovery'}
              onChange={(event) => flow.changeConfirmation(event.target.value)}
            />
          </div>
          {flow.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`memberSetup.error.${flow.error}` as 'memberSetup.error.server')}
            </p>
          ) : null}
          <Button type="button" className="min-h-11" disabled={flow.busy} onClick={flow.submit}>
            {t('memberSetup.submit')}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void flow.generate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="member-password">{t('memberSetup.password')}</Label>
            <Input
              id="member-password"
              type="password"
              autoComplete="new-password"
              value={flow.password}
              aria-invalid={flow.error === 'password'}
              onChange={(event) => flow.changePassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="member-password-confirm">{t('memberSetup.confirmPassword')}</Label>
            <Input
              id="member-password-confirm"
              type="password"
              autoComplete="new-password"
              value={flow.confirmPassword}
              aria-invalid={flow.error === 'mismatch'}
              onChange={(event) => flow.changeConfirmPassword(event.target.value)}
            />
          </div>
          {flow.error ? (
            <p role="alert" className="text-sm text-destructive">
              {t(`memberSetup.error.${flow.error}` as 'memberSetup.error.server')}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11" disabled={flow.deriving}>
            {flow.deriving ? t('memberSetup.generating') : t('memberSetup.generate')}
          </Button>
        </form>
      )}
    </section>
  );
};
