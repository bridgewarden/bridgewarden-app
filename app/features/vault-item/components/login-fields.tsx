import { useState } from 'react';

import { EyeIcon, EyeOffIcon, WandSparklesIcon } from 'lucide-react';

import { useSecretReveal } from '~/hooks/use-secret-reveal';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { t } from '~/lib/i18n/en';

import type { CustomFieldForm, EditorErrors, EditorValues } from '../vault-item.types';
import { CustomFields } from './custom-fields';
import { FieldHint, RequiredMark } from './field-hint';
import { PasswordGeneratorDialog } from './password-generator-dialog';
import { TotpField } from './totp-field';
import { UrlFields } from './url-fields';

type LoginFieldsProps = {
  values: EditorValues;
  errors: EditorErrors;
  onChange: (patch: Partial<EditorValues>) => void;
  onUrlChange: (index: number, value: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (index: number) => void;
  onFieldChange: (index: number, patch: Partial<CustomFieldForm>) => void;
  onAddField: () => void;
  onRemoveField: (index: number) => void;
};

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

const RequiredLabel = ({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) => (
  <Label htmlFor={htmlFor}>
    {children} <RequiredMark />
  </Label>
);

export const LoginFields = ({
  values,
  errors,
  onChange,
  onUrlChange,
  onAddUrl,
  onRemoveUrl,
  onFieldChange,
  onAddField,
  onRemoveField,
}: LoginFieldsProps) => {
  const { revealed, reveal, hide } = useSecretReveal();
  const [generatorOpen, setGeneratorOpen] = useState(false);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <RequiredLabel htmlFor="item-username">{t('vaultItem.username')}</RequiredLabel>
          <Input
            id="item-username"
            className="min-h-11"
            aria-required="true"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('vaultItem.usernamePlaceholder')}
            value={values.username}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? 'item-username-error' : 'item-username-hint'}
            onChange={(event) => onChange({ username: event.target.value })}
          />
          <FieldHint id="item-username-hint">{t('vaultItem.usernameHint')}</FieldHint>
          <FieldError id="item-username-error" message={errors.username} />
        </div>
        <div className="space-y-2">
          <RequiredLabel htmlFor="item-password">{t('vaultItem.password')}</RequiredLabel>
          <div className="flex gap-2">
            <Input
              id="item-password"
              className="min-h-11"
              aria-required="true"
              type={revealed ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('vaultItem.passwordPlaceholder')}
              value={values.password}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'item-password-error' : 'item-password-hint'}
              onChange={(event) => onChange({ password: event.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t(revealed ? 'vaultItem.hidePassword' : 'vaultItem.showPassword')}
              onClick={() => (revealed ? hide() : reveal())}
            >
              {revealed ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t('vaultItem.generatePassword')}
              onClick={() => setGeneratorOpen(true)}
            >
              <WandSparklesIcon aria-hidden="true" />
            </Button>
          </div>
          <FieldHint id="item-password-hint">{t('vaultItem.passwordHint')}</FieldHint>
          <FieldError id="item-password-error" message={errors.password} />
        </div>
      </div>

      <UrlFields
        urls={values.urls}
        error={errors.urls}
        onUrlChange={onUrlChange}
        onAddUrl={onAddUrl}
        onRemoveUrl={onRemoveUrl}
      />

      <TotpField
        value={values.totpSecret}
        error={errors.totpSecret}
        onChange={(totpSecret) => onChange({ totpSecret })}
      />

      <div className="space-y-2">
        <Label htmlFor="item-notes">{t('vaultItem.notes')}</Label>
        <Textarea
          id="item-notes"
          rows={4}
          aria-invalid={Boolean(errors.notes)}
          aria-describedby={errors.notes ? 'item-notes-error' : 'item-notes-hint'}
          spellCheck={false}
          value={values.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
        <FieldHint id="item-notes-hint">{t('vaultItem.notesHint')}</FieldHint>
        <FieldError id="item-notes-error" message={errors.notes} />
      </div>

      <CustomFields
        fields={values.customFields}
        error={errors.customFields}
        onChange={onFieldChange}
        onAdd={onAddField}
        onRemove={onRemoveField}
      />

      <PasswordGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        onApply={(password) => {
          onChange({ password });
          setGeneratorOpen(false);
        }}
      />
    </div>
  );
};
