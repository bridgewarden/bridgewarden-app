import { useEffect, useRef, useState } from 'react';
import { useFetcher, useNavigate, useSearchParams } from 'react-router';

import { t } from '~/lib/i18n/en';
import { safeNextPath } from '~/lib/next-path';
import { TOTP_CODE_PATTERN } from '~/lib/totp-code';
import { clearVaultKey } from '~/lib/vault/key-store';

import { useLoginRequestEffects, useLoginSuccessEffects } from './hooks';
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

  useLoginSuccessEffects({
    login: { data: login.data, state: login.state },
    challenge: { data: challenge.data, state: challenge.state },
    navigation: { navigate, next },
    refs: { wrapKeyRef, emailRef },
    set: { setFlowActive, setFormError, setChallengeToken, setChallengeCode, setChallengeError },
  });

  useLoginRequestEffects({
    prelogin: { data: prelogin.data, state: prelogin.state },
    login: { data: login.data, state: login.state },
    challenge: { data: challenge.data, state: challenge.state },
    submitLogin: (authHash) =>
      login.submit(
        { email: emailRef.current, authHash },
        { method: 'post', action: '/auth/login', encType: 'application/json' },
      ),
    refs: { passwordRef, wrapKeyRef },
    set: { setDeriving, setPassword, setFlowActive, setFormError, setChallengeError },
  });

  useEffect(() => {
    if (challengeToken) challengeInputRef.current?.focus();
  }, [challengeToken]);

  const busy =
    flowActive || prelogin.state !== 'idle' || login.state !== 'idle' || challenge.state !== 'idle' || deriving;

  const changeEmail = (value: string) => {
    setEmail(value);
    setFieldError(null);
  };

  const changePassword = (value: string) => {
    setPassword(value);
    setFieldError(null);
  };

  const changeChallengeCode = (value: string) => {
    setChallengeCode(backupMode ? value : value.replace(/\D/g, ''));
    setChallengeError(null);
  };

  const submitCredentials = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setFieldError(t('login.missingFields'));
      setFormError(null);
      return;
    }

    setFieldError(null);
    setFormError(null);
    setFlowActive(true);
    clearVaultKey();
    emailRef.current = normalizedEmail;
    passwordRef.current = password;
    prelogin.submit(
      { email: normalizedEmail },
      { method: 'post', action: '/auth/prelogin', encType: 'application/json' },
    );
  };

  const submitChallenge = () => {
    if (!challengeToken) return;
    if (!challengeCode.trim()) {
      setChallengeError(t('login.challengeCodeRequired'));
      return;
    }
    if (!backupMode && !TOTP_CODE_PATTERN.test(challengeCode)) {
      setChallengeError(t('login.invalidChallengeCode'));
      return;
    }

    setChallengeError(null);
    setFlowActive(true);
    challenge.submit(
      { challengeToken, ...(backupMode ? { backupCode: challengeCode } : { code: challengeCode }) },
      { method: 'post', action: '/auth/2fa', encType: 'application/json' },
    );
  };

  const toggleBackupMode = () => {
    setBackupMode((value) => !value);
    setChallengeCode('');
    setChallengeError(null);
  };

  const backToCredentials = () => {
    wrapKeyRef.current?.fill(0);
    wrapKeyRef.current = null;
    clearVaultKey();
    setChallengeToken(null);
    setChallengeCode('');
    setChallengeError(null);
    setBackupMode(false);
    setFormError(null);
    setFlowActive(false);
  };

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
    changeEmail,
    changePassword,
    changeChallengeCode,
    submitCredentials,
    submitChallenge,
    toggleBackupMode,
    backToCredentials,
  };
};
