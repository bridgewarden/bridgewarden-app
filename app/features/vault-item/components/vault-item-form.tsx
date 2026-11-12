import { useState } from 'react';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Checkbox } from '~/components/ui/checkbox';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { t } from '~/lib/i18n/en';
import { MAX_ITEM_NAME_LENGTH } from '~/lib/vault/limits';

import type { DecryptedFolder } from '~/lib/vault/projection';

import type { CustomFieldForm, EditorErrors, EditorType, EditorValues } from '../vault-item.types';
import { FieldHint, RequiredMark } from './field-hint';
import { CreateFolderDialog } from './create-folder-dialog';
import { LoginFields } from './login-fields';
import { NoteFields } from './note-fields';

type VaultItemFormProps = {
  values: EditorValues;
  errors: EditorErrors;
  folders: DecryptedFolder[];
  isNew: boolean;
  actions: {
    save: () => void;
    update: (patch: Partial<EditorValues>) => void;
    setType: (type: EditorType) => void;
    setUrl: (index: number, value: string) => void;
    addUrl: () => void;
    removeUrl: (index: number) => void;
    setField: (index: number, patch: Partial<CustomFieldForm>) => void;
    addField: () => void;
    removeField: (index: number) => void;
    createFolder: (name: string) => Promise<string>;
  };
};

export const VaultItemForm = ({ values, errors, folders, isNew, actions }: VaultItemFormProps) => {
  const [folderOpen, setFolderOpen] = useState(false);
  const { save, update, setType, setUrl, addUrl, removeUrl, setField, addField, removeField, createFolder } = actions;

  return (
    <form
      id="vault-item-form"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <p className="text-sm text-muted-foreground">{t('vaultItem.requiredNotice')}</p>

      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <div className="space-y-1">
          <h2 className="font-medium">{t('vaultItem.basics')}</h2>
          <p className="text-sm text-muted-foreground">{t('vaultItem.basicsHint')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-name">
            {t('vaultItem.name')} <RequiredMark />
          </Label>
          <Input
            id="item-name"
            className="min-h-11"
            aria-required="true"
            autoFocus
            maxLength={MAX_ITEM_NAME_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('vaultItem.namePlaceholder')}
            value={values.name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'item-name-error' : 'item-name-hint'}
            onChange={(event) => update({ name: event.target.value })}
          />
          <FieldHint id="item-name-hint">{t('vaultItem.nameHint')}</FieldHint>
          {errors.name ? (
            <p id="item-name-error" role="alert" className="text-sm text-destructive">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="item-type">{t('vault.type')}</Label>
            <Select
              value={values.type}
              disabled={!isNew}
              onValueChange={(value) => setType(value === 'note' ? 'note' : 'login')}
            >
              <SelectTrigger id="item-type" className="min-h-11 w-full" aria-describedby="item-type-hint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="login">{t('vault.type.login')}</SelectItem>
                <SelectItem value="note">{t('vault.type.note')}</SelectItem>
              </SelectContent>
            </Select>
            <FieldHint id="item-type-hint">{t('vaultItem.typeHint')}</FieldHint>
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-folder">{t('vault.folder')}</Label>
            <Select
              value={values.folderId || 'none'}
              onValueChange={(value) => {
                if (value === 'new') {
                  setFolderOpen(true);
                  return;
                }
                update({ folderId: value === 'none' ? '' : value });
              }}
            >
              <SelectTrigger id="item-folder" className="min-h-11 w-full" aria-describedby="item-folder-hint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="none">{t('vault.folder.none')}</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">{t('vaultItem.folderNewOption')}</SelectItem>
              </SelectContent>
            </Select>
            <FieldHint id="item-folder-hint">{t('vaultItem.folderHint')}</FieldHint>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{t('vaultItem.favorite')}</span>
            <div className="flex min-h-11 items-center gap-3 rounded-md border border-input px-3">
              <Checkbox
                id="item-favorite"
                className="size-6"
                checked={values.favorite}
                aria-describedby="item-favorite-hint"
                onCheckedChange={(checked) => update({ favorite: checked === true })}
              />
              <Label htmlFor="item-favorite" className="font-normal text-muted-foreground">
                {t('vaultItem.favoriteToggle')}
              </Label>
            </div>
            <FieldHint id="item-favorite-hint">{t('vaultItem.favoriteHint')}</FieldHint>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <div className="space-y-1">
          <h2 className="font-medium">
            {t(values.type === 'login' ? 'vaultItem.credentials' : 'vaultItem.noteSection')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(values.type === 'login' ? 'vaultItem.credentialsHint' : 'vaultItem.noteSectionHint')}
          </p>
        </div>

        {values.type === 'login' ? (
          <LoginFields
            values={values}
            errors={errors}
            onChange={update}
            onUrlChange={setUrl}
            onAddUrl={addUrl}
            onRemoveUrl={removeUrl}
            onFieldChange={setField}
            onAddField={addField}
            onRemoveField={removeField}
          />
        ) : (
          <NoteFields body={values.body} error={errors.body} onChange={(body) => update({ body })} />
        )}
      </section>

      <CreateFolderDialog
        open={folderOpen}
        onOpenChange={setFolderOpen}
        onCreate={createFolder}
        onCreated={(folderId) => update({ folderId })}
      />

      {errors.payload ? (
        <Alert variant="destructive">
          <AlertDescription>{errors.payload}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
};
