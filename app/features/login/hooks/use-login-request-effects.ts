import { useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

import { prepareLogin } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';
import { clearVaultKey } from '~/lib/vault/key-store';

import type { ChallengeResponse, LoginResponse, PreloginResponse } from '../login.types';

type FetcherState<T> = { data: T | undefined; state: string };

type LoginRequestEffectsOptions = {
  prelogin: FetcherState<PreloginResponse>;
  login: FetcherState<LoginResponse>;
  challenge: FetcherState<ChallengeResponse>;
  submitLogin: (authHash: string) => void;
  refs: {
    passwordRef: MutableRefObject<string>;
    wrapKeyRef: MutableRefObject<Uint8Array | null>;
  };
  set: {
    setDeriving: Dispatch<SetStateAction<boolean>>;
    setPassword: Dispatch<SetStateAction<string>>;
    setFlowActive: Dispatch<SetStateAction<boolean>>;
    setFormError: Dispatch<SetStateAction<string | null>>;
    setChallengeError: Dispatch<SetStateAction<string | null>>;
  };
};

export const useLoginRequestEffects = (options: LoginRequestEffectsOptions) => {
  const { prelogin, login, challenge, submitLogin, refs, set } = options;
  const { passwordRef, wrapKeyRef } = refs;
  const { setDeriving, setPassword, setFlowActive, setFormError, setChallengeError } = set;
  const handledPrelogin = useRef<PreloginResponse | null>(null);
  const preloginWasSubmitting = useRef(false);
  const loginWasSubmitting = useRef(false);
  const challengeWasSubmitting = useRef(false);

  useEffect(() => {
    const data = prelogin.data;
    if (!data || handledPrelogin.current === data) return;
    handledPrelogin.current = data;

    if (!data.ok) {
      passwordRef.current = '';
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      });
      return;
    }

    void Promise.resolve().then(async () => {
      setDeriving(true);
      const submittedPassword = passwordRef.current;
      passwordRef.current = '';

      try {
        const prepared = await prepareLogin(submittedPassword, data.kdfSalt, data.kdfIterations);
        wrapKeyRef.current?.fill(0);
        wrapKeyRef.current = prepared.wrapKey;
        setPassword('');
        submitLogin(prepared.authHash);
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      } finally {
        setDeriving(false);
      }
    });
  }, [prelogin.data, submitLogin, passwordRef, wrapKeyRef, setDeriving, setPassword, setFlowActive, setFormError]);

  useEffect(() => {
    if (prelogin.state !== 'idle') {
      preloginWasSubmitting.current = true;
      return;
    }

    if (preloginWasSubmitting.current && !prelogin.data) {
      passwordRef.current = '';
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      });
    }

    preloginWasSubmitting.current = false;
  }, [prelogin.state, prelogin.data, passwordRef, setFlowActive, setFormError]);

  useEffect(() => {
    if (login.state !== 'idle') {
      loginWasSubmitting.current = true;
      return;
    }

    if (loginWasSubmitting.current && !login.data) {
      wrapKeyRef.current?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setFormError(t('login.serverError'));
      });
    }

    loginWasSubmitting.current = false;
  }, [login.state, login.data, wrapKeyRef, setFlowActive, setFormError]);

  useEffect(() => {
    if (challenge.state !== 'idle') {
      challengeWasSubmitting.current = true;
      return;
    }

    if (challengeWasSubmitting.current && !challenge.data) {
      wrapKeyRef.current?.fill(0);
      wrapKeyRef.current = null;
      clearVaultKey();
      queueMicrotask(() => {
        setFlowActive(false);
        setChallengeError(t('login.serverError'));
      });
    }

    challengeWasSubmitting.current = false;
  }, [challenge.state, challenge.data, wrapKeyRef, setFlowActive, setChallengeError]);
};
