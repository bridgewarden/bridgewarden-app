import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

type RecoveryEmailStepProps = {
  email: string;
  error: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export const RecoveryEmailStep = ({ email, error, busy, onChange, onSubmit }: RecoveryEmailStepProps) => (
  <form
    className="space-y-4"
    onSubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <div className="space-y-2">
      <Label htmlFor="recover-email">{t('recover.email.label')}</Label>
      <Input
        id="recover-email"
        type="email"
        autoComplete="email"
        autoFocus
        required
        value={email}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
    {error ? (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}
    <Button type="submit" className="min-h-11 w-full" disabled={busy}>
      {busy ? t('recover.busy') : t('recover.email.submit')}
    </Button>
  </form>
);
