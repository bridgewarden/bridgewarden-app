import { Trash2Icon, Undo2Icon } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';
import type { TrashedItem } from '~/lib/vault/projection';

type TrashRowProps = {
  item: TrashedItem;
  busy: boolean;
  onRestore: () => void;
  onPurge: () => void;
};

export const TrashRow = ({ item, busy, onRestore, onPurge }: TrashRowProps) => (
  <li className="flex flex-wrap items-center gap-3 px-4 py-3" data-trash-row={item.id}>
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
      <Trash2Icon className="size-4 text-muted-foreground" aria-hidden="true" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{item.name}</p>
      <p className="text-sm text-muted-foreground">
        {t(item.type === 'login' ? 'vault.type.login' : 'vault.type.note')} ·{' '}
        {t('trash.deletedAt', { date: new Date(item.deletedAt).toLocaleDateString() })}
      </p>
    </div>
    {item.folderName ? (
      <Badge variant="outline" aria-label={`${t('trash.folder')}: ${item.folderName}`}>
        {item.folderName}
      </Badge>
    ) : null}
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={busy}
        aria-label={`${t('trash.restore')} ${item.name}`}
        data-trash-action
        onClick={onRestore}
      >
        <Undo2Icon aria-hidden="true" />
        {busy ? t('trash.restoring') : t('trash.restore')}
      </Button>
      <Button
        type="button"
        variant="destructive"
        className="min-h-11"
        disabled={busy}
        aria-label={`${t('trash.purge')} ${item.name}`}
        data-trash-action
        onClick={onPurge}
      >
        <Trash2Icon aria-hidden="true" />
        {busy ? t('trash.purging') : t('trash.purge')}
      </Button>
    </div>
  </li>
);
