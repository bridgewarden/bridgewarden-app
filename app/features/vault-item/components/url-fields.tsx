import { PlusIcon, Trash2Icon } from 'lucide-react';

import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_URLS } from '~/lib/vault/limits';

import { FieldHint, RequiredMark } from './field-hint';

type UrlFieldsProps = {
  urls: string[];
  error?: string;
  onUrlChange: (index: number, value: string) => void;
  onAddUrl: () => void;
  onRemoveUrl: (index: number) => void;
};

export const UrlFields = ({ urls, error, onUrlChange, onAddUrl, onRemoveUrl }: UrlFieldsProps) => (
  <fieldset className="space-y-3" aria-describedby={error ? 'item-urls-error' : 'item-urls-hint'}>
    <div className="flex items-center justify-between gap-3">
      <legend className="text-sm font-medium">
        {t('vaultItem.urls')} <RequiredMark />
      </legend>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        disabled={urls.filter((url) => url.trim() !== '').length >= MAX_ITEM_URLS}
        onClick={onAddUrl}
      >
        <PlusIcon aria-hidden="true" />
        {t('vaultItem.addUrl')}
      </Button>
    </div>
    {urls.map((url, index) => (
      <div key={index} className="flex gap-2">
        <Input
          aria-label={t('vaultItem.url', { index: index + 1 })}
          aria-required={index === 0 ? 'true' : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'item-urls-error' : 'item-urls-hint'}
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
    {error ? (
      <p id="item-urls-error" role="alert" className="text-sm text-destructive">
        {error}
      </p>
    ) : null}
  </fieldset>
);
