import { useCallback, useEffect, useRef, useState } from 'react';

import { sealItem } from '~/lib/crypto/envelope';
import { readVaultItem } from '~/lib/vault/item-read';
import { parseFolderPayload } from '~/lib/vault/item-payload';
import { getVaultKey } from '~/lib/vault/key-store';
import { enqueueOutbox, flushOutbox } from '~/lib/vault/outbox';
import type { CachedFolder } from '~/lib/vault/types';
import { readVaultFolders, type DecryptedFolder } from '~/lib/vault/projection';
import { syncVault } from '~/lib/vault/sync';

import { emptyField, emptyValues, valuesFromItem, valuesSnapshot } from '../vault-item.lib';
import type { CustomFieldForm, EditorErrors, EditorType, EditorValues } from '../vault-item.types';

export type EditorStatus = 'loading' | 'ready' | 'locked' | 'missing' | 'error';

export const useVaultItemForm = (itemId: string) => {
  const isNew = itemId === 'new';
  const [values, setValues] = useState<EditorValues>(() => emptyValues());
  const [savedSnapshot, setSavedSnapshot] = useState<string>(() => valuesSnapshot(emptyValues()));
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [status, setStatus] = useState<EditorStatus>('loading');
  const [errors, setErrors] = useState<EditorErrors>({});
  const generation = useRef(0);

  const replaceValues = useCallback((next: EditorValues) => {
    setValues(next);
    setSavedSnapshot(valuesSnapshot(next));
  }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setStatus('loading');
    setErrors({});
    try {
      await syncVault();
      const nextFolders = await readVaultFolders();
      if (current !== generation.current) return;
      setFolders(nextFolders);

      if (isNew) {
        replaceValues(emptyValues('login'));
        setStatus('ready');
        return;
      }

      const result = await readVaultItem(itemId);
      if (current !== generation.current) return;
      if (result.status === 'locked') {
        setStatus('locked');
        return;
      }
      if (result.status === 'not-found') {
        setStatus('missing');
        return;
      }
      if (result.status === 'invalid') {
        setStatus('error');
        return;
      }

      replaceValues(valuesFromItem(result.item));
      setStatus('ready');
    } catch {
      if (current === generation.current) setStatus('error');
    }
  }, [isNew, itemId, replaceValues]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const update = useCallback((patch: Partial<EditorValues>) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  const setType = useCallback((type: EditorType) => {
    setValues((current) => ({
      ...emptyValues(type),
      name: current.name,
      folderId: current.folderId,
      favorite: current.favorite,
    }));
  }, []);

  const setUrl = useCallback((index: number, value: string) => {
    setValues((current) => ({ ...current, urls: current.urls.map((url, i) => (i === index ? value : url)) }));
  }, []);

  const addUrl = useCallback(() => {
    setValues((current) => ({ ...current, urls: [...current.urls, ''] }));
  }, []);

  const removeUrl = useCallback((index: number) => {
    setValues((current) => ({
      ...current,
      urls: current.urls.length === 1 ? [''] : current.urls.filter((_, i) => i !== index),
    }));
  }, []);

  const setField = useCallback((index: number, patch: Partial<CustomFieldForm>) => {
    setValues((current) => ({
      ...current,
      customFields: current.customFields.map((field, i) => (i === index ? { ...field, ...patch } : field)),
    }));
  }, []);

  const addField = useCallback(() => {
    setValues((current) => ({ ...current, customFields: [...current.customFields, emptyField()] }));
  }, []);

  const removeField = useCallback((index: number) => {
    setValues((current) => ({ ...current, customFields: current.customFields.filter((_, i) => i !== index) }));
  }, []);

  const createFolder = useCallback(async (name: string): Promise<string> => {
    const key = getVaultKey();
    if (!key) throw new Error('vault is locked');

    try {
      const payload = parseFolderPayload({ name: name.trim() });
      if (!payload) throw new Error('invalid folder name');
      const id = crypto.randomUUID();
      const sealed = await sealItem(payload, key, { kind: 'folder', id });
      const now = Date.now();
      const optimistic: CachedFolder = {
        id,
        nameCt: sealed.ct,
        nameIv: sealed.iv,
        dataVersion: sealed.v,
        rev: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };

      await enqueueOutbox({
        kind: 'folder.create',
        id,
        idempotencyId: id,
        entity: 'folder',
        optimistic,
        previous: null,
        payload: {
          nameCt: sealed.ct,
          nameIv: sealed.iv,
          dataVersion: sealed.v,
        },
        queuedAt: now,
      });
      setFolders(await readVaultFolders());
      void flushOutbox();
      return id;
    } finally {
      key.fill(0);
    }
  }, []);

  return {
    isNew,
    values,
    folders,
    status,
    errors,
    setErrors,
    setStatus,
    setSavedSnapshot,
    replaceValues,
    dirty: status === 'ready' && valuesSnapshot(values) !== savedSnapshot,
    update,
    setType,
    setUrl,
    addUrl,
    removeUrl,
    setField,
    addField,
    removeField,
    createFolder,
    retry: load,
  };
};
