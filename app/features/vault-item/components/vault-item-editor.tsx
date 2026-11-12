import { useState } from 'react';

import { ArrowLeftIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { t } from '~/lib/i18n/en';

import { useUnsavedGuard, useVaultItemEditor } from '../hooks';
import { ConflictDialog, DeleteDialog, DirtyDialog } from './editor-dialogs';
import { VaultItemForm } from './vault-item-form';

type VaultItemEditorProps = { itemId: string };

export const VaultItemEditor = ({ itemId }: VaultItemEditorProps) => {
  const flow = useVaultItemEditor(itemId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const blocker = useUnsavedGuard(flow.dirty, flow.saving || flow.deleting);

  if (flow.status === 'loading') {
    return (
      <div role="status" aria-busy="true" aria-label={t('vaultItem.loading')} className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (flow.status === 'locked') return null;

  if (flow.status === 'missing' || flow.status === 'error') {
    return (
      <section className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            {t(flow.status === 'missing' ? 'vaultItem.notFound' : 'vaultItem.loadFailed')}
          </AlertDescription>
        </Alert>
        <Button variant="outline" className="min-h-11" asChild>
          <Link to="/app">
            <ArrowLeftIcon aria-hidden="true" />
            {t('vaultItem.back')}
          </Link>
        </Button>
        {flow.status === 'error' ? (
          <Button variant="outline" className="min-h-11" onClick={() => void flow.retry()}>
            {t('vault.retry')}
          </Button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" className="min-h-11 px-2" asChild>
        <Link to="/app">
          <ArrowLeftIcon aria-hidden="true" />
          {t('vaultItem.back')}
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t(flow.isNew ? 'vaultItem.title.create' : 'vaultItem.title.edit')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(flow.isNew ? 'vaultItem.description.create' : 'vaultItem.description.edit')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!flow.isNew ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={flow.saving || flow.deleting}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              {t('vaultItem.delete')}
            </Button>
          ) : null}
          <Button type="submit" form="vault-item-form" className="min-h-11" disabled={flow.saving || flow.deleting}>
            <SaveIcon aria-hidden="true" />
            {flow.saving ? t('vaultItem.saving') : t('vaultItem.save')}
          </Button>
        </div>
      </div>

      <VaultItemForm
        values={flow.values}
        errors={flow.errors}
        folders={flow.folders}
        isNew={flow.isNew}
        actions={{
          save: flow.save,
          update: flow.update,
          setType: flow.setType,
          setUrl: flow.setUrl,
          addUrl: flow.addUrl,
          removeUrl: flow.removeUrl,
          setField: flow.setField,
          addField: flow.addField,
          removeField: flow.removeField,
          createFolder: flow.createFolder,
        }}
      />

      <DeleteDialog
        open={deleteOpen}
        busy={flow.deleting}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void flow.remove()}
      />
      <DirtyDialog
        open={blocker.state === 'blocked'}
        onStay={() => blocker.reset?.()}
        onDiscard={() => blocker.proceed?.()}
      />
      <ConflictDialog
        open={flow.conflict}
        busy={flow.conflictBusy}
        onReload={() => void flow.reloadConflict()}
        onCopy={() => {
          flow.dismissConflict();
          void flow.saveAsCopy();
        }}
        onCancel={flow.dismissConflict}
      />
    </section>
  );
};
