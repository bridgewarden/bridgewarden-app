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
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';

type DeleteDialogProps = {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export const DeleteDialog = ({ open, busy, onOpenChange, onConfirm }: DeleteDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('vaultItem.deleteTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{t('vaultItem.deleteDescription')}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>{t('common.close')}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" disabled={busy} onClick={onConfirm}>
          {busy ? t('vaultItem.deleting') : t('vaultItem.deleteConfirm')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type DirtyDialogProps = {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
};

export const DirtyDialog = ({ open, onStay, onDiscard }: DirtyDialogProps) => (
  <AlertDialog open={open} onOpenChange={(next) => !next && onStay()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('vaultItem.unsavedTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{t('vaultItem.unsavedDescription')}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onStay}>{t('vaultItem.unsavedStay')}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onDiscard}>
          {t('vaultItem.unsavedLeave')}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type ConflictDialogProps = {
  open: boolean;
  busy: boolean;
  onReload: () => void;
  onCopy: () => void;
  onCancel: () => void;
};

export const ConflictDialog = ({ open, busy, onReload, onCopy, onCancel }: ConflictDialogProps) => (
  <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('vaultItem.conflictTitle')}</AlertDialogTitle>
        <AlertDialogDescription>{t('vaultItem.conflictDescription')}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="sm:flex-wrap">
        <AlertDialogCancel disabled={busy}>{t('vaultItem.conflictCancel')}</AlertDialogCancel>
        <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
          {t('vaultItem.conflictReload')}
        </Button>
        <Button type="button" disabled={busy} onClick={onCopy}>
          {t('vaultItem.conflictCopy')}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
