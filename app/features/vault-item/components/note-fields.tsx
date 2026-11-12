import { Label } from '~/components/ui/label';
import { Textarea } from '~/components/ui/textarea';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_NOTE_BYTES, utf8ByteLength } from '~/lib/vault/limits';

import { FieldHint } from './field-hint';

type NoteFieldsProps = {
  body: string;
  error?: string;
  onChange: (body: string) => void;
};

export const NoteFields = ({ body, error, onChange }: NoteFieldsProps) => {
  const used = utf8ByteLength(body);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="item-body">{t('vaultItem.body')}</Label>
        <span className="text-sm text-muted-foreground">
          {t('vaultItem.bodyCount', { used, max: MAX_ITEM_NOTE_BYTES })}
        </span>
      </div>
      <Textarea
        id="item-body"
        rows={12}
        spellCheck={false}
        value={body}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'item-body-error' : undefined}
        placeholder={t('vaultItem.noteSectionHint')}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldHint id="item-body-hint">{t('vaultItem.noteSectionHint')}</FieldHint>
      {error ? (
        <p id="item-body-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
};
