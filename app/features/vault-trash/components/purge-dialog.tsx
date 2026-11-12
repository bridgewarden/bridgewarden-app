import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import type { TrashedItem } from '~/lib/vault/projection';

type PurgeDialogProps = {
  selected: { item: TrashedItem; requiresName: boolean } | null;
  typedName: string;
  busy: boolean;
  onTypedName: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export const PurgeDialog = ({ selected, typedName, busy, onTypedName, onClose, onConfirm }: PurgeDialogProps) => (
  <AlertDialog open={selected !== null} onOpenChange={(open) => !open && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('trash.purgeTitle')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t('trash.purgeDescription', { name: selected?.item.name ?? '' })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {selected?.requiresName ? (
        <div className="space-y-2">
          <Label htmlFor="trash-purge-name">{t('trash.purgeName')}</Label>
          <Input
            id="trash-purge-name"
            autoComplete="off"
            spellCheck={false}
            value={typedName}
            onChange={(event) => onTypedName(event.target.value)}
          />
        </div>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onClose}>{t('common.close')}</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={busy || (selected?.requiresName === true && typedName !== selected.item.name)}
          onClick={onConfirm}
        >
          {t('trash.purgeConfirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
