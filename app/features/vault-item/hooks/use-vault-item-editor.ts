import { useEffect } from 'react';

import { t } from '~/lib/i18n/en';
import { subscribeOutboxEvents } from '~/lib/vault/outbox';

import { useVaultItemForm } from './use-vault-item-form';
import { useVaultItemMutations } from './use-vault-item-mutations';
import { useVaultItemReload } from './use-vault-item-reload';
import { useVaultItemTrash } from './use-vault-item-trash';

export const useVaultItemEditor = (itemId: string) => {
  const form = useVaultItemForm(itemId);
  const mutations = useVaultItemMutations({ ...form, itemId });
  const reload = useVaultItemReload({
    itemId,
    replaceValues: form.replaceValues,
    setErrors: form.setErrors,
  });
  const { setErrors } = form;
  const { setConflict } = mutations;

  useEffect(
    () =>
      subscribeOutboxEvents((event) => {
        if (event.entry.id !== itemId) return;
        if (event.type === 'conflict') setConflict(true);
        if (event.type === 'error') setErrors((current) => ({ ...current, payload: t('vaultItem.saveFailed') }));
      }),
    [itemId, setConflict, setErrors],
  );

  const trash = useVaultItemTrash({
    itemId,
    isNew: form.isNew,
    values: form.values,
    setSavedSnapshot: form.setSavedSnapshot,
  });

  return { ...form, ...mutations, ...reload, ...trash };
};
