import { useCallback, useState } from 'react';

import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { t } from '~/lib/i18n/en';
import { getCachedItem } from '~/lib/vault/cache';
import { enqueueOutbox, flushOutbox } from '~/lib/vault/outbox';
import type { CachedItem } from '~/lib/vault/types';

import { valuesSnapshot } from '../vault-item.lib';
import type { EditorValues } from '../vault-item.types';

type TrashInput = {
  itemId: string;
  isNew: boolean;
  values: EditorValues;
  setSavedSnapshot: (snapshot: string) => void;
};

export const useVaultItemTrash = ({ itemId, isNew, values, setSavedSnapshot }: TrashInput) => {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const undoDelete = useCallback(
    async (previous: CachedItem, optimistic: CachedItem) => {
      try {
        const current = (await getCachedItem(itemId)) ?? previous;
        const restored: CachedItem = { ...current, deletedAt: null, updatedAt: Date.now() };
        await enqueueOutbox({
          kind: 'item.restore',
          id: itemId,
          idempotencyId: null,
          entity: 'item',
          previous: optimistic,
          optimistic: restored,
          payload: {},
          queuedAt: Date.now(),
        });
        void flushOutbox();
      } catch {
        toast.error(t('vaultItem.undoFailed'));
      }
    },
    [itemId],
  );

  const remove = useCallback(async () => {
    if (isNew) return;
    const current = await getCachedItem(itemId);
    if (!current) {
      toast.error(t('vaultItem.saveFailed'));
      return;
    }

    setDeleting(true);
    const now = Date.now();
    const optimistic = { ...current, deletedAt: now, updatedAt: now };
    try {
      await enqueueOutbox({
        kind: 'item.trash',
        id: itemId,
        idempotencyId: null,
        entity: 'item',
        previous: current,
        optimistic,
        payload: {},
        queuedAt: now,
      });
      setSavedSnapshot(valuesSnapshot(values));
      navigate('/app');
      toast.success(t('vaultItem.deleted'), {
        action: { label: t('vaultItem.undo'), onClick: () => void undoDelete(current, optimistic) },
      });
      void flushOutbox();
    } catch {
      toast.error(t('vaultItem.saveFailed'));
    } finally {
      setDeleting(false);
    }
  }, [isNew, itemId, navigate, setSavedSnapshot, undoDelete, values]);

  return { deleting, remove };
};
