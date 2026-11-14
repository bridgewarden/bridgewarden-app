import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { sealItem } from '~/lib/crypto/envelope';
import { t } from '~/lib/i18n/en';
import { getCachedItem } from '~/lib/vault/cache';
import { parseItemPayload } from '~/lib/vault/item-payload';
import { getVaultKey } from '~/lib/vault/key-store';
import { enqueueOutbox, flushOutbox, subscribeOutboxEvents } from '~/lib/vault/outbox';
import type { CachedItem } from '~/lib/vault/types';

import { withinCiphertextBudget, buildPayload, hasErrors, validateValues, valuesSnapshot } from '../vault-item.lib';
import type { EditorErrors, EditorValues } from '../vault-item.types';
import type { EditorStatus } from './use-vault-item-form';

type MutationsInput = {
  itemId: string;
  isNew: boolean;
  values: EditorValues;
  setErrors: Dispatch<SetStateAction<EditorErrors>>;
  setStatus: (status: EditorStatus) => void;
  setSavedSnapshot: (snapshot: string) => void;
};

export const useVaultItemMutations = ({
  itemId,
  isNew,
  values,
  setErrors,
  setStatus,
  setSavedSnapshot,
}: MutationsInput) => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const savingRef = useRef(false);

  const enqueueSave = useCallback(
    async (saveAsCopy: boolean) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setSaving(true);
      let key: Uint8Array | null = null;

      try {
        const validation = validateValues(values);
        if (hasErrors(validation)) {
          setErrors(validation);
          return;
        }

        const payload = buildPayload(values);
        const parsed = payload ? parseItemPayload(values.type, payload) : null;
        if (!parsed) {
          setErrors({ payload: t('vaultItem.error.payloadTooLarge') });
          return;
        }

        key = getVaultKey();
        if (!key) {
          setStatus('locked');
          return;
        }

        setErrors({});
        const id = isNew || saveAsCopy ? crypto.randomUUID() : itemId;
        const sealed = await sealItem(parsed, key, { kind: 'item', id, type: values.type });
        if (!withinCiphertextBudget(sealed.ct)) {
          setErrors({ payload: t('vaultItem.error.payloadTooLarge') });
          return;
        }

        const previous = isNew || saveAsCopy ? undefined : await getCachedItem(itemId);
        if (!isNew && !saveAsCopy && !previous) {
          setErrors({ payload: t('vaultItem.loadFailed') });
          return;
        }

        const now = Date.now();
        const optimistic: CachedItem = {
          id,
          type: values.type,
          folderId: values.folderId || null,
          favorite: values.favorite,
          dataCt: sealed.ct,
          dataIv: sealed.iv,
          dataVersion: sealed.v,
          rev: previous?.rev ?? 0,
          deletedAt: null,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
        };

        await enqueueOutbox({
          kind: isNew || saveAsCopy ? 'item.create' : 'item.update',
          id,
          idempotencyId: isNew || saveAsCopy ? id : null,
          entity: 'item',
          optimistic,
          previous: previous ?? null,
          payload: {
            type: values.type,
            folderId: optimistic.folderId,
            favorite: optimistic.favorite,
            dataCt: sealed.ct,
            dataIv: sealed.iv,
            dataVersion: sealed.v,
            ...(!isNew && !saveAsCopy ? { rev: previous!.rev } : {}),
          },
          queuedAt: now,
        });
        if (globalThis.navigator?.onLine === false) {
          setSavedSnapshot(valuesSnapshot(values));
          toast.success(t('vaultItem.savedOffline'));
          void flushOutbox();
          return;
        }

        let flushed = false;
        let failed = false;
        let conflicted = false;
        const unsubscribe = subscribeOutboxEvents((event) => {
          if (event.entry.id !== id) return;
          if (event.type === 'flushed') flushed = true;
          if (event.type === 'error') failed = true;
          if (event.type === 'conflict') conflicted = true;
        });
        try {
          await flushOutbox();
        } finally {
          unsubscribe();
        }

        if (conflicted) {
          setConflict(true);
          return;
        }
        if (failed) {
          setErrors({ payload: t('vaultItem.saveFailed') });
          return;
        }
        setSavedSnapshot(valuesSnapshot(values));
        setConflict(false);
        if (!flushed) {
          toast.success(t('vaultItem.savedOffline'));
          return;
        }
        toast.success(t('vaultItem.saved'));
        navigate('/app');
      } catch {
        setErrors({ payload: t('vaultItem.saveFailed') });
      } finally {
        key?.fill(0);
        savingRef.current = false;
        setSaving(false);
      }
    },
    [isNew, itemId, navigate, setErrors, setSavedSnapshot, setStatus, values],
  );

  const save = useCallback(() => enqueueSave(false), [enqueueSave]);
  const saveAsCopy = useCallback(() => enqueueSave(true), [enqueueSave]);

  return {
    saving,
    conflict,
    save,
    saveAsCopy,
    setConflict,
    dismissConflict: () => setConflict(false),
  };
};
