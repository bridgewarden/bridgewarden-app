import { PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_CUSTOM_FIELDS } from '~/lib/vault/limits';

import type { CustomFieldForm } from '../vault-item.types';
import { FieldHint } from './field-hint';

type CustomFieldsProps = {
  fields: CustomFieldForm[];
  error?: string;
  onChange: (index: number, patch: Partial<CustomFieldForm>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
};

export const CustomFields = ({ fields, error, onChange, onAdd, onRemove }: CustomFieldsProps) => (
  <fieldset className="space-y-3" aria-describedby={error ? 'custom-fields-error' : 'custom-fields-hint'}>
    <div className="flex items-center justify-between gap-3">
      <legend className="text-sm font-medium">{t('vaultItem.customFields')}</legend>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={fields.length >= MAX_ITEM_CUSTOM_FIELDS}
        onClick={onAdd}
      >
        <PlusIcon aria-hidden="true" />
        {t('vaultItem.addField')}
      </Button>
    </div>

    <FieldHint id="custom-fields-hint">{t('vaultItem.customFieldsHint')}</FieldHint>

    {fields.map((field, index) => (
      <div key={index} className="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor={`custom-label-${index}`}>{t('vaultItem.fieldLabel', { index: index + 1 })}</Label>
          <Input
            id={`custom-label-${index}`}
            className="min-h-11"
            autoComplete="off"
            spellCheck={false}
            value={field.label}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'custom-fields-error' : 'custom-fields-hint'}
            onChange={(event) => onChange(index, { label: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`custom-value-${index}`}>{t('vaultItem.fieldValue', { index: index + 1 })}</Label>
          <Input
            id={`custom-value-${index}`}
            className="min-h-11"
            type={field.hidden ? 'password' : 'text'}
            autoComplete="off"
            spellCheck={false}
            value={field.value}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'custom-fields-error' : 'custom-fields-hint'}
            onChange={(event) => onChange(index, { value: event.target.value })}
          />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <Checkbox
            id={`custom-hidden-${index}`}
            className="size-6"
            checked={field.hidden}
            onCheckedChange={(checked) => onChange(index, { hidden: checked === true })}
          />
          <Label htmlFor={`custom-hidden-${index}`}>{t('vaultItem.fieldHidden', { index: index + 1 })}</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={t('vaultItem.removeField', { index: index + 1 })}
            onClick={() => onRemove(index)}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </div>
      </div>
    ))}
    {error ? (
      <p id="custom-fields-error" role="alert" className="text-sm text-destructive">
        {error}
      </p>
    ) : null}
  </fieldset>
);
