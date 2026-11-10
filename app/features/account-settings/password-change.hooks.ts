import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import { prepareLogin } from '../../lib/crypto/login-keys';
import { rewrapPassword } from '../../lib/crypto/password-change';
import { storeKeyMaterial } from '../../lib/vault/key-material';
import type { VaultKeyMaterial } from '../../lib/vault/types';
import { MIN_MASTER_PASSWORD_LENGTH } from '../../lib/password-policy';
import type { PasswordSettings } from './account-settings.types';

type Prepared =
  | { ok: true; material: PasswordSettings & { vaultKeyWrapped: string; vaultKeyWrapIv: string } }
  | { ok: false; error: string };

export type PasswordFlow = ReturnType<typeof usePasswordChange>;

export const usePasswordChange = (password: PasswordSettings, email: string) => {
  const prepareFetcher = useFetcher<Prepared>();
  const changeFetcher = useFetcher<{ ok: true } | { ok: false; error: string }>();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [success, setSuccess] = useState(false);
  const currentRef = useRef<{ authHash: string; wrapKey: Uint8Array } | null>(null);
  const startedRef = useRef(false);
  const materialRef = useRef<VaultKeyMaterial | null>(null);

  useEffect(() => {
    const prepared = prepareFetcher.data;
    if (!prepared || startedRef.current) return;
    startedRef.current = true;
    setPreparing(false);

    if (!prepared.ok) {
      currentRef.current?.wrapKey.fill(0);
      currentRef.current = null;
      queueMicrotask(() => setLocalError(prepared.error));
      return;
    }

    const current = currentRef.current;
    if (!current) {
      queueMicrotask(() => setLocalError('server-error'));
      return;
    }

    void rewrapPassword(current.authHash, current.wrapKey, newPassword, prepared.material)
      .then((result) => {
        materialRef.current = result.request;
        changeFetcher.submit(
          { currentAuthHash: result.currentAuthHash, ...result.request },
          {
            method: 'post',
            action: '/api/account/password',
            encType: 'application/json',
          },
        );
      })
      .catch(() => queueMicrotask(() => setLocalError('server-error')))
      .finally(() => current.wrapKey.fill(0));
  }, [changeFetcher, newPassword, prepareFetcher.data]);

  useEffect(() => {
    const result = changeFetcher.data;
    if (!result) return;

    if (result.ok) {
      if (materialRef.current) void storeKeyMaterial(email, materialRef.current).catch(() => undefined);
      materialRef.current = null;
      queueMicrotask(() => {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmation('');
        setSuccess(true);
      });
      return;
    }

    queueMicrotask(() => setLocalError(result.error));
  }, [changeFetcher.data, email]);

  const submit = async () => {
    if (!currentPassword || newPassword.length < MIN_MASTER_PASSWORD_LENGTH || newPassword !== confirmation) {
      setLocalError('invalid');
      return;
    }

    setLocalError(null);
    setSuccess(false);
    setPreparing(true);
    startedRef.current = false;

    try {
      const current = await prepareLogin(currentPassword, password.kdfSalt, password.kdfIterations);
      currentRef.current = current;
      prepareFetcher.submit(
        { currentAuthHash: current.authHash },
        { method: 'post', action: '/api/account/password/prepare', encType: 'application/json' },
      );
    } catch {
      setLocalError('server-error');
      setPreparing(false);
    }
  };

  return {
    currentPassword,
    newPassword,
    confirmation,
    error: localError,
    success,
    busy: preparing || prepareFetcher.state !== 'idle' || changeFetcher.state !== 'idle',
    changeCurrentPassword: (value: string) => {
      setCurrentPassword(value);
      setLocalError(null);
    },
    changeNewPassword: (value: string) => {
      setNewPassword(value);
      setLocalError(null);
    },
    changeConfirmation: (value: string) => {
      setConfirmation(value);
      setLocalError(null);
    },
    submit,
  };
};
