import { useEffect, useState } from 'react';

import { EyeIcon, EyeOffIcon, PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_URLS } from '~/lib/vault/limits';

import type { CustomFieldForm, EditorErrors, EditorValues } from '../vault-item.types';
import { CustomFields } from './custom-fields';
import { FieldHint, RequiredMark } from './field-hint';
import { TotpField } from './totp-field';

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
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const timer = window.setTimeout(() => setRevealed(false), 30_000);
    return () => window.clearTimeout(timer);
  }, [revealed]);

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
              onClick={() => setRevealed((current) => !current)}
            >
              {revealed ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
            </Button>
          </div>
          <FieldHint id="item-password-hint">{t('vaultItem.passwordHint')}</FieldHint>
          <FieldError id="item-password-error" message={errors.password} />
        </div>
      </div>

      <fieldset className="space-y-3" aria-describedby={errors.urls ? 'item-urls-error' : 'item-urls-hint'}>
        <div className="flex items-center justify-between gap-3">
          <legend className="text-sm font-medium">
            {t('vaultItem.urls')} <RequiredMark />
          </legend>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={values.urls.filter((url) => url.trim() !== '').length >= MAX_ITEM_URLS}
            onClick={onAddUrl}
          >
            <PlusIcon aria-hidden="true" />
            {t('vaultItem.addUrl')}
          </Button>
        </div>
        {values.urls.map((url, index) => (
          <div key={index} className="flex gap-2">
            <Input
              aria-label={t('vaultItem.url', { index: index + 1 })}
              aria-required={index === 0 ? 'true' : undefined}
              aria-invalid={Boolean(errors.urls)}
              aria-describedby={errors.urls ? 'item-urls-error' : 'item-urls-hint'}
              className="min-h-11"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('vaultItem.urlPlaceholder')}
              value={url}
              onChange={(event) => onUrlChange(index, event.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={t('vaultItem.removeUrl', { index: index + 1 })}
              onClick={() => onRemoveUrl(index)}
            >
              <Trash2Icon aria-hidden="true" />
            </Button>
          </div>
        ))}
        <FieldHint id="item-urls-hint">{t('vaultItem.urlsHint')}</FieldHint>
        <FieldError id="item-urls-error" message={errors.urls} />
      </fieldset>

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
    </div>
  );
};
