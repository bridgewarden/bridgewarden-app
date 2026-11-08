import { useEffect, useRef, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { prepareLogin } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';
import { safeNextPath } from '~/lib/next-path';
import { clearVaultKey } from '~/lib/vault/key-store';

import { useLoginActions } from './hooks/use-login-actions';
import { useLoginSuccessEffects } from './hooks/use-login-success-effects';
import type { ChallengeResponse, LoginResponse, PreloginResponse } from './login.types';

export const useLoginFlow = () => {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [challengeCode, setChallengeCode] = useState('');
  const [backupMode, setBackupMode] = useState(false);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [flowActive, setFlowActive] = useState(false);
  const prelogin = useFetcher<PreloginResponse>();
  const login = useFetcher<LoginResponse>();
  const challenge = useFetcher<ChallengeResponse>();
  const navigate = useNavigate();
  const passwordRef = useRef('');
  const emailRef = useRef('');
  const wrapKeyRef = useRef<Uint8Array | null>(null);
  const challengeInputRef = useRef<HTMLInputElement>(null);
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
        login.submit(
          { email: emailRef.current, authHash: prepared.authHash },
          { method: 'post', action: '/auth/login', encType: 'application/json' },
        );
      } catch {
        clearVaultKey();
        setFlowActive(false);
        setFormError(t('login.lookupFailed'));
      } finally {
        setDeriving(false);
      }
    });
  }, [prelogin.data, login]);

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
  }, [prelogin.state, prelogin.data]);

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
  }, [login.state, login.data]);

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
  }, [challenge.state, challenge.data]);

  useEffect(() => {
    if (challengeToken) challengeInputRef.current?.focus();
  }, [challengeToken]);

  useLoginSuccessEffects({
    loginData: login.data,
    loginState: login.state,
    challengeData: challenge.data,
    challengeState: challenge.state,
    navigate,
    next,
    wrapKeyRef,
    setFlowActive,
    setFormError,
    setChallengeToken,
    setChallengeCode,
    setChallengeError,
  });

  const busy =
    flowActive || prelogin.state !== 'idle' || login.state !== 'idle' || challenge.state !== 'idle' || deriving;

  const actions = useLoginActions({
    email,
    password,
    backupMode,
    challengeToken,
    challengeCode,
    emailRef,
    passwordRef,
    wrapKeyRef,
    setEmail,
    setPassword,
    setFieldError,
    setFormError,
    setFlowActive,
    setChallengeCode,
    setChallengeError,
    setChallengeToken,
    setBackupMode,
    submitPrelogin: (value) =>
      prelogin.submit({ email: value }, { method: 'post', action: '/auth/prelogin', encType: 'application/json' }),
    submitChallengeRequest: (input) =>
      challenge.submit(input, { method: 'post', action: '/auth/2fa', encType: 'application/json' }),
  });

  return {
    email,
    password,
    fieldError,
    formError,
    challengeToken,
    challengeCode,
    backupMode,
    challengeError,
    busy,
    challengeInputRef,
    ...actions,
  };
};
