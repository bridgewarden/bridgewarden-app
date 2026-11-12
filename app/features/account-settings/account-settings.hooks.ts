import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

import type { PreloginResponse } from '~/lib/crypto/login-keys';
import { t } from '~/lib/i18n/en';

import type { CodesResponse, DisableResponse, EnrollResponse } from './account-settings.types';

const twoFactorError = (error: string, fallback: string): string => {
  if (error === 'invalid-password') return t('settings.twoFactor.invalidPassword');
  if (error === 'locked') return t('settings.twoFactor.locked');
  if (error === 'rate-limited') return t('settings.twoFactor.rateLimited');
  return fallback;
};

const ensureSession = (data: { ok: true; sessionIssued?: boolean }): boolean => data.sessionIssued !== false;

type UseAccountSettingsOptions = {
  email: string;
};

export const useAccountSettings = ({ email }: UseAccountSettingsOptions) => {
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [disableError, setDisableError] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const passwordRef = useRef('');
  const handledPrelogin = useRef<PreloginResponse | null>(null);
  const pendingAction = useRef<'enroll' | 'regenerate' | 'disable' | null>(null);
  const preloginWasSubmitting = useRef(false);
  const enrollmentFetcher = useFetcher<EnrollResponse>();
  const verifyFetcher = useFetcher<CodesResponse>();
  const regenerateFetcher = useFetcher<CodesResponse>();
  const disableFetcher = useFetcher<DisableResponse>();
  const preloginFetcher = useFetcher<PreloginResponse>();

  useEffect(() => {
    const data = enrollmentFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setEnrollment({ secret: data.secret, uri: data.uri });
        setError(null);
      } else {
        setError(twoFactorError(data.error, t('settings.twoFactor.loadFailed')));
      }
    });
  }, [enrollmentFetcher.data]);

  useEffect(() => {
    const data = verifyFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setCodes(data.backupCodes);
        setEnrollment(null);
        setCode('');
        setError(ensureSession(data) ? null : t('settings.twoFactor.sessionExpired'));
      } else {
        setError(twoFactorError(data.error, t('settings.twoFactor.invalidCode')));
      }
    });
  }, [verifyFetcher.data]);

  useEffect(() => {
    const data = regenerateFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        setCodes(data.backupCodes);
        setError(ensureSession(data) ? null : t('settings.twoFactor.sessionExpired'));
      } else {
        setError(twoFactorError(data.error, t('settings.twoFactor.regenerateFailed')));
      }
    });
  }, [regenerateFetcher.data]);

  useEffect(() => {
    const data = disableFetcher.data;
    if (!data) return;
    queueMicrotask(() => {
      if (data.ok) {
        if (!ensureSession(data)) {
          window.location.assign('/login');
          return;
        }
        setCodes(null);
        setEnrollment(null);
        setDisableError(null);
        setPassword('');
      } else {
        setDisableError(twoFactorError(data.error, t('settings.twoFactor.disableFailed')));
      }
    });
  }, [disableFetcher.data]);

  useEffect(() => {
    if (preloginFetcher.state !== 'idle') {
      preloginWasSubmitting.current = true;
      return;
    }

    if (preloginWasSubmitting.current && !preloginFetcher.data) {
      const action = pendingAction.current;
      pendingAction.current = null;
      passwordRef.current = '';
      if (action === 'enroll') setError(t('settings.twoFactor.loadFailed'));
      else setDisableError(t('settings.twoFactor.disableFailed'));
    }

    preloginWasSubmitting.current = false;
  }, [preloginFetcher.state, preloginFetcher.data]);

  useEffect(() => {
    const data = preloginFetcher.data;
    if (!data || handledPrelogin.current === data) return;
    handledPrelogin.current = data;
    const action = pendingAction.current;
    pendingAction.current = null;

    queueMicrotask(() => {
      if (!data.ok) {
        if (action === 'enroll') setError(t('settings.twoFactor.loadFailed'));
        else setDisableError(t('settings.twoFactor.disableFailed'));
        return;
      }

      const submittedPassword = passwordRef.current;
      passwordRef.current = '';
      setDeriving(true);

      void Promise.resolve().then(async () => {
        try {
          const { prepareLogin } = await import('~/lib/crypto/login-keys');
          const prepared = await prepareLogin(submittedPassword, data.kdfSalt, data.kdfIterations);
          prepared.wrapKey.fill(0);
          const target =
            action === 'enroll' ? enrollmentFetcher : action === 'regenerate' ? regenerateFetcher : disableFetcher;
          const endpoint =
            action === 'enroll'
              ? '/api/account/2fa/enroll'
              : action === 'regenerate'
                ? '/api/account/2fa/backup-codes/regenerate'
                : '/api/account/2fa/disable';
          target.submit(
            { authHash: prepared.authHash },
            { method: 'post', action: endpoint, encType: 'application/json' },
          );
          setPassword('');
        } catch {
          if (action === 'enroll') setError(t('settings.twoFactor.loadFailed'));
          else setDisableError(t('settings.twoFactor.disableFailed'));
        } finally {
          setDeriving(false);
        }
      });
    });
  }, [preloginFetcher.data, disableFetcher, enrollmentFetcher, regenerateFetcher]);

  const handleQrError = useCallback(() => setError(t('settings.twoFactor.qrFailed')), []);

  const startStepUp = (action: 'enroll' | 'regenerate' | 'disable') => {
    if (!password) {
      if (action === 'enroll') setError(t('settings.twoFactor.passwordRequired'));
      else setDisableError(t('settings.twoFactor.passwordRequired'));
      return;
    }
    setError(null);
    setDisableError(null);
    passwordRef.current = password;
    pendingAction.current = action;
    preloginFetcher.submit({ email }, { method: 'post', action: '/auth/prelogin', encType: 'application/json' });
  };

  const busy =
    enrollmentFetcher.state !== 'idle' ||
    verifyFetcher.state !== 'idle' ||
    regenerateFetcher.state !== 'idle' ||
    disableFetcher.state !== 'idle' ||
    preloginFetcher.state !== 'idle' ||
    deriving;

  return {
    enrollment,
    codes,
    code,
    password,
    error,
    disableError,
    busy,
    changePassword: (value: string) => {
      setPassword(value);
      setError(null);
      setDisableError(null);
    },
    changeCode: (value: string) => {
      setCode(value);
      setError(null);
    },
    invalidCode: () => setError(t('settings.twoFactor.invalidCode')),
    enable: () => startStepUp('enroll'),
    regenerate: () => startStepUp('regenerate'),
    disable: () => startStepUp('disable'),
    verify: () => {
      setError(null);
      verifyFetcher.submit(
        { code },
        { method: 'post', action: '/api/account/2fa/verify', encType: 'application/json' },
      );
    },
    handleQrError,
  };
};
