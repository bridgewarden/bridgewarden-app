import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import { prepareRecoveryReset } from '../../lib/crypto/recovery-reset';
import { isMasterPasswordAcceptable } from '../../lib/password-policy';
import { storeKeyMaterial } from '../../lib/vault/key-material';
import { setVaultKey } from '../../lib/vault/key-store';
import type { VaultKeyMaterial } from '../../lib/vault/types';
import type { RecoveryError, RecoveryLookupResponse, RecoveryResetResponse, RecoveryStep } from './recover.types';

type Prepared = {
  vaultKey: Uint8Array;
  recoveryKey: string;
  material: VaultKeyMaterial;
};

export const useRecoveryFlow = () => {
  const lookupFetcher = useFetcher<RecoveryLookupResponse>();
  const resetFetcher = useFetcher<RecoveryResetResponse>();
  const [step, setStep] = useState<RecoveryStep>('email');
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [wrapper, setWrapper] = useState<{ recoveryKeyWrapped: string; recoveryKeyWrapIv: string } | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState('');
  const [sessionIssued, setSessionIssued] = useState(true);
  const [error, setError] = useState<RecoveryError | null>(null);
  const [preparing, setPreparing] = useState(false);
  const preparedRef = useRef<Prepared | null>(null);
  const handledLookup = useRef<RecoveryLookupResponse | null>(null);
  const handledReset = useRef<RecoveryResetResponse | null>(null);

  useEffect(() => {
    const result = lookupFetcher.data;
    if (!result || handledLookup.current === result) return;
    handledLookup.current = result;

    queueMicrotask(() => {
      if (!result.ok) {
        setError(result.error === 'rate-limited' ? 'rate-limited' : 'server-error');
        return;
      }
      setWrapper({ recoveryKeyWrapped: result.recoveryKeyWrapped, recoveryKeyWrapIv: result.recoveryKeyWrapIv });
      setStep('reset');
    });
  }, [lookupFetcher.data]);

  useEffect(() => {
    const result = resetFetcher.data;
    if (!result || handledReset.current === result) return;
    handledReset.current = result;

    if (!result.ok) {
      preparedRef.current?.vaultKey.fill(0);
      preparedRef.current = null;
      queueMicrotask(() => setError(result.error === 'server-error' ? 'server-error' : 'invalid'));
      return;
    }

    const prepared = preparedRef.current;
    preparedRef.current = null;
    if (prepared) {
      setVaultKey(prepared.vaultKey);
      void storeKeyMaterial(email, prepared.material).catch(() => undefined);
      prepared.vaultKey.fill(0);
      queueMicrotask(() => {
        setNewRecoveryKey(prepared.recoveryKey);
        setSessionIssued(result.sessionIssued);
        setRecoveryKey('');
        setPassword('');
        setConfirmation('');
        setWrapper(null);
        setStep('success');
      });
    }
  }, [email, resetFetcher.data]);

  const submitEmail = () => {
    setError(null);
    lookupFetcher.submit({ email }, { method: 'post', action: '/auth/recover/lookup', encType: 'application/json' });
  };

  const submitReset = async () => {
    if (!wrapper) return;
    if (!isMasterPasswordAcceptable(password) || password !== confirmation) {
      setError('invalid');
      return;
    }

    setError(null);
    setPreparing(true);

    try {
      const prepared = await prepareRecoveryReset(recoveryKey, wrapper, password);
      preparedRef.current = {
        vaultKey: prepared.vaultKey,
        recoveryKey: prepared.recoveryKey,
        material: prepared.request,
      };
      resetFetcher.submit(
        { email, ...prepared.request },
        { method: 'post', action: '/auth/recover/reset', encType: 'application/json' },
      );
    } catch {
      setError('invalid');
    } finally {
      setPreparing(false);
    }
  };

  return {
    step,
    email,
    recoveryKey,
    password,
    confirmation,
    newRecoveryKey,
    sessionIssued,
    error,
    busy: preparing || lookupFetcher.state !== 'idle' || resetFetcher.state !== 'idle',
    changeEmail: (value: string) => {
      setEmail(value);
      setError(null);
    },
    changeRecoveryKey: (value: string) => {
      setRecoveryKey(value);
      setError(null);
    },
    changePassword: (value: string) => {
      setPassword(value);
      setError(null);
    },
    changeConfirmation: (value: string) => {
      setConfirmation(value);
      setError(null);
    },
    submitEmail,
    submitReset,
  };
};
