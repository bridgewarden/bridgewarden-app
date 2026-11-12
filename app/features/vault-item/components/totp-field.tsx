import { useState } from 'react';

import { InfoIcon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';

import { FieldHint } from './field-hint';

type TotpFieldProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

export const TotpField = ({ value, error, onChange }: TotpFieldProps) => {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="item-totp">{t('vaultItem.totpSecret')}</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label={t('vaultItem.totpHelp')}
          onClick={() => setHelpOpen(true)}
        >
          <InfoIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <Input
        id="item-totp"
        className="min-h-11"
        autoComplete="off"
        spellCheck={false}
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'item-totp-error' : 'item-totp-hint'}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldHint id="item-totp-hint">{t('vaultItem.totpHint')}</FieldHint>
      {error ? (
        <p id="item-totp-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('vaultItem.totpHelpTitle')}</DialogTitle>
            <DialogDescription>{t('vaultItem.totpHelpDescription')}</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>{t('vaultItem.totpHelpWhat')}</li>
            <li>{t('vaultItem.totpHelpFormat')}</li>
            <li>{t('vaultItem.totpHelpEncrypted')}</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
};
