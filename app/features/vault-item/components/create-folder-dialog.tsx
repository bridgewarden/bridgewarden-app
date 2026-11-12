import { useState } from 'react';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_NAME_LENGTH } from '~/lib/vault/limits';

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<string>;
  onCreated: (id: string) => void;
};

const CreateFolderForm = ({
  onCancel,
  onCreate,
  onCreated,
}: Omit<CreateFolderDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) => {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('vaultItem.folderNameRequired'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const id = await onCreate(trimmed);
      onCreated(id);
      setName('');
      onCancel();
    } catch {
      setError(t('vaultItem.folderCreateFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('vaultItem.folderDialogTitle')}</DialogTitle>
        <DialogDescription>{t('vaultItem.folderDialogDescription')}</DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="folder-name">{t('vaultItem.folderName')}</Label>
          <Input
            id="folder-name"
            autoFocus
            className="min-h-11"
            maxLength={MAX_ITEM_NAME_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('vaultItem.folderNamePlaceholder')}
            value={name}
            disabled={busy}
            aria-invalid={Boolean(error)}
            aria-required="true"
            aria-describedby={error ? 'folder-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
          {error ? (
            <p id="folder-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onCancel}>
            {t('common.close')}
          </Button>
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? t('vaultItem.folderCreating') : t('vaultItem.folderCreate')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

export const CreateFolderDialog = ({ open, onOpenChange, onCreate, onCreated }: CreateFolderDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      {open ? (
        <CreateFolderForm onCancel={() => onOpenChange(false)} onCreate={onCreate} onCreated={onCreated} />
      ) : null}
    </DialogContent>
  </Dialog>
);
