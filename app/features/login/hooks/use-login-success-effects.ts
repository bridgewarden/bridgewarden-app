import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router';

import { unwrapLoginVault } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

import type { ChallengeResponse, LoginResponse } from '../login.types';

type LoginSuccessEffectsOptions = {
  loginData: LoginResponse | undefined;
  loginState: string;
  challengeData: ChallengeResponse | undefined;
  challengeState: string;
  navigate: NavigateFunction;
  next: string;
  wrapKeyRef: MutableRefObject<Uint8Array | null>;
  setFlowActive: Dispatch<SetStateAction<boolean>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  setChallengeToken: Dispatch<SetStateAction<string | null>>;
  setChallengeCode: Dispatch<SetStateAction<string>>;
  setChallengeError: Dispatch<SetStateAction<string | null>>;
};

export const useLoginSuccessEffects = (options: LoginSuccessEffectsOptions) => {
  const {
    loginData,
    loginState,
    challengeData,
    challengeState,
    navigate,
    next,
    wrapKeyRef,
    setFlowActive,
    setFormError,
    setChallengeToken,
    setChallengeCode,
    setChallengeError,
  } = options;
  const handledLogin = useRef<LoginResponse | null>(null);
  const handledChallenge = useRef<ChallengeResponse | null>(null);

  useEffect(() => {
    const data = loginData;
    if (!data || loginState !== 'idle' || handledLogin.current === data) return;
    handledLogin.current = data;

    if (data.ok && data.requires2fa) {
      queueMicrotask(() => {
        setChallengeToken(data.challengeToken);
        setChallengeCode('');
        setChallengeError(null);
        setFlowActive(false);
      });
      return;
    }

    const wrapKey = wrapKeyRef.current;

    if (!data.ok || !wrapKey) {
      wrapKey?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(data.ok ? t('login.serverError') : t('login.invalidCredentials'));
      });
      return;
    }

    void (async () => {
      try {
        const vaultKey = await unwrapLoginVault(data.vaultKeyWrapped, data.vaultKeyWrapIv, wrapKey);
        setVaultKey(vaultKey);
        navigate(next, { replace: true });
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setFormError(t('login.unlockFailed'));
      } finally {
        wrapKey.fill(0);
        wrapKeyRef.current = null;
      }
    })();
  }, [
    loginData,
    loginState,
    navigate,
    next,
    wrapKeyRef,
    setFlowActive,
    setFormError,
    setChallengeToken,
    setChallengeCode,
    setChallengeError,
  ]);

  useEffect(() => {
    const data = challengeData;
    if (!data || challengeState !== 'idle' || handledChallenge.current === data) return;
    handledChallenge.current = data;

    if (!data.ok) {
      const invalidChallenge = data.challengeInvalid === true;
      queueMicrotask(() => {
        setFlowActive(false);
        if (invalidChallenge) {
          wrapKeyRef.current?.fill(0);
          wrapKeyRef.current = null;
          clearVaultKey();
          setChallengeToken(null);
          setChallengeCode('');
          setChallengeError(null);
          setFormError(t('login.challengeExpired'));
        } else {
          setChallengeError(t('login.invalidChallengeCode'));
        }
      });
      return;
    }

    const wrapKey = wrapKeyRef.current;
    if (!wrapKey) {
      queueMicrotask(() => {
        setFlowActive(false);
        setChallengeToken(null);
        setFormError(t('login.serverError'));
      });
      return;
    }

    void (async () => {
      try {
        const vaultKey = await unwrapLoginVault(data.vaultKeyWrapped, data.vaultKeyWrapIv, wrapKey);
        setVaultKey(vaultKey);
        navigate(next, { replace: true });
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setChallengeError(t('login.unlockFailed'));
      } finally {
        wrapKey.fill(0);
        wrapKeyRef.current = null;
      }
    })();
  }, [
    challengeData,
    challengeState,
    navigate,
    next,
    wrapKeyRef,
    setFlowActive,
    setFormError,
    setChallengeToken,
    setChallengeCode,
    setChallengeError,
  ]);
};
