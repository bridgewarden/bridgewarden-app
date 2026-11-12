import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { toast } from 'sonner';

import { t } from '~/lib/i18n/en';
import { readVaultItem } from '~/lib/vault/item-read';
import { syncVault } from '~/lib/vault/sync';

import { valuesFromItem } from '../vault-item.lib';
import type { EditorErrors, EditorValues } from '../vault-item.types';

type ReloadInput = {
  itemId: string;
  replaceValues: (values: EditorValues) => void;
  setErrors: Dispatch<SetStateAction<EditorErrors>>;
};

export const useVaultItemReload = ({ itemId, replaceValues, setErrors }: ReloadInput) => {
  const [conflictBusy, setConflictBusy] = useState(false);

  const reloadConflict = useCallback(async () => {
    setConflictBusy(true);
    try {
      await syncVault();
      const result = await readVaultItem(itemId);
      if (result.status !== 'ok') {
        toast.error(t('vaultItem.conflictReloadFailed'));
        return;
      }
      replaceValues(valuesFromItem(result.item));
      setErrors({});
    } finally {
      setConflictBusy(false);
    }
  }, [itemId, replaceValues, setErrors]);

  return { conflictBusy, reloadConflict };
};
