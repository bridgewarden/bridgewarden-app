import { useState } from 'react';

import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
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
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
import { t } from '~/lib/i18n/en';
import type { DecryptedFolder } from '~/lib/vault/projection';

import type { CreateItemInput } from '../vault-list.hooks';

type CreateItemDialogProps = {
  open: boolean;
  folders: DecryptedFolder[];
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateItemInput) => Promise<void>;
};

type CreateItemFormProps = {
  folders: DecryptedFolder[];
  onCancel: () => void;
  onCreate: (input: CreateItemInput) => Promise<void>;
};

const CreateItemForm = ({ folders, onCancel, onCreate }: CreateItemFormProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<'login' | 'note'>('login');
  const [folderId, setFolderId] = useState('none');
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('vault.nameRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: trimmed, type, folderId: folderId === 'none' ? null : folderId, favorite });
      onCancel();
    } catch {
      setError(t('vault.createFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('vault.newItem')}</DialogTitle>
        <DialogDescription>{t('vault.newItemDescription')}</DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="create-item-name">{t('vault.name')}</Label>
          <Input
            id="create-item-name"
            autoFocus
            maxLength={200}
            value={name}
            disabled={busy}
            aria-invalid={error !== null}
            aria-describedby={error ? 'create-item-error' : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-item-type">{t('vault.type')}</Label>
          <NativeSelect
            id="create-item-type"
            className="min-h-11"
            wrapperClassName="w-full"
            value={type}
            disabled={busy}
            onChange={(event) => setType(event.target.value === 'note' ? 'note' : 'login')}
          >
            <NativeSelectOption value="login">{t('vault.type.login')}</NativeSelectOption>
            <NativeSelectOption value="note">{t('vault.type.note')}</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="create-item-folder">{t('vault.folder')}</Label>
          <NativeSelect
            id="create-item-folder"
            className="min-h-11"
            wrapperClassName="w-full"
            value={folderId}
            disabled={busy}
            onChange={(event) => setFolderId(event.target.value)}
          >
            <NativeSelectOption value="none">{t('vault.folder.none')}</NativeSelectOption>
            {folders.map((folder) => (
              <NativeSelectOption key={folder.id} value={folder.id}>
                {folder.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="create-item-favorite"
            className="size-6"
            checked={favorite}
            disabled={busy}
            onCheckedChange={(checked) => setFavorite(checked === true)}
          />
          <Label htmlFor="create-item-favorite">{t('vault.favorite')}</Label>
        </div>

        {error ? (
          <p id="create-item-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {t('common.close')}
          </Button>
          <Button type="submit" disabled={busy || !name.trim()}>
            {busy ? t('vault.creating') : t('vault.create')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

export const CreateItemDialog = ({ open, folders, onOpenChange, onCreate }: CreateItemDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <CreateItemForm folders={folders} onCancel={() => onOpenChange(false)} onCreate={onCreate} />
    </DialogContent>
  </Dialog>
);
