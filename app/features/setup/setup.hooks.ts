import { useEffect, useReducer, useRef, useState } from 'react';
import { useBlocker, useFetcher, useNavigate } from 'react-router';

import { t, type MessageKey } from '~/lib/i18n/en';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

import { ERROR_KEY } from './setup.constants';
import { generateSetupKeyMaterial, toSetupPayload } from './setup-keys';
import {
  isMasterPasswordValid,
  passwordScore,
  passwordsMatch,
  recoveryConfirmationMatches,
  stepNumber,
  validateAccount,
} from './setup.lib';
import { initialSetupState, setupReducer } from './setup.state';
import { useRecoveryActions } from './hooks/use-recovery-actions';
import { useSetupBeforeUnload } from './hooks/use-setup-before-unload';
import type { SetupActionResponse } from './setup.types';

export const useSetupFlow = () => {
  const [state, dispatch] = useReducer(setupReducer, initialSetupState);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloaded' | 'failed'>('idle');
  const [fieldError, setFieldError] = useState<MessageKey | null>(null);
  const [deriving, setDeriving] = useState(false);
  const fetcher = useFetcher<SetupActionResponse>();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasSubmitting = useRef(false);

  const blocker = useBlocker(state.keys !== null && state.step !== 'done' && state.step !== 'configured');

  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  useSetupBeforeUnload(state.keys !== null);

  useEffect(() => {
    if (!fetcher.data) return;

    if (fetcher.data.ok) {
      dispatch({ type: 'succeeded' });
      return;
    }

    if (fetcher.data.error === 'forbidden' || fetcher.data.error === 'already-configured') {
      clearVaultKey();
    }

    dispatch({ type: 'failed', error: fetcher.data.error });
  }, [fetcher.data]);

  useEffect(() => {
    if (state.step === 'done' && fetcher.state === 'idle') {
      navigate('/app', { replace: true });
    }
  }, [state.step, fetcher.state, navigate]);

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      wasSubmitting.current = true;
      return;
    }

    if (wasSubmitting.current && state.step === 'submitting' && !fetcher.data) {
      dispatch({ type: 'failed', error: 'network' });
    }

    wasSubmitting.current = false;
  }, [fetcher.state, state.step, fetcher.data]);

  const submitSetup = () => {
    if (!state.keys) return;

    fetcher.submit(toSetupPayload(state.keys, { email: state.email, displayName: state.displayName }), {
      method: 'post',
      encType: 'application/json',
    });
  };

  const submitAccount = () => {
    const account = validateAccount(state.email, state.displayName);
    if (!account) {
      setFieldError('setup.account.invalid');
      return;
    }
    setFieldError(null);
    dispatch({ type: 'account-accepted', ...account });
  };

  const submitPassword = async () => {
    if (!isMasterPasswordValid(password)) {
      setFieldError('setup.password.hint');
      return;
    }

    if (!passwordsMatch(password, confirmPassword)) {
      setFieldError('setup.password.mismatch');
      return;
    }

    setFieldError(null);
    setDeriving(true);
    try {
      const generated = await generateSetupKeyMaterial(password);
      const { vaultKey, recoveryKey, ...transport } = generated;
      setVaultKey(vaultKey);
      vaultKey.fill(0);
      setPassword('');
      setConfirmPassword('');
      setCopyStatus('idle');
      dispatch({ type: 'keys-generated', keys: transport, recoveryKey });
    } catch {
      setFieldError('setup.error.serverError');
    } finally {
      setDeriving(false);
    }
  };

  const submitRecovery = () => {
    if (!recoveryConfirmationMatches(state.recoveryKey, confirmation)) {
      setFieldError('setup.recovery.mismatch');
      return;
    }
    setFieldError(null);
    setConfirmation('');
    dispatch({ type: 'recovery-confirmed' });
  };

  const { copyRecoveryKey, downloadRecoveryKey } = useRecoveryActions({
    recoveryKey: state.recoveryKey,
    copyStatus,
    setCopyStatus,
    setDownloadStatus,
  });

  const continueTwoFactor = () => {
    dispatch({ type: 'two-factor-continued' });
    submitSetup();
  };

  const retry = () => {
    dispatch({ type: 'retry' });
    submitSetup();
  };

  const leave = () => {
    clearVaultKey();
    dispatch({ type: 'leave' });
    if (blocker.state === 'blocked') blocker.reset();
  };

  return {
    state,
    dispatch,
    blocker,
    headingRef,
    password,
    confirmPassword,
    confirmation,
    fieldError,
    copyStatus,
    downloadStatus,
    deriving,
    currentStep: stepNumber(state.step),
    busy: fetcher.state !== 'idle' || state.step === 'submitting',
    errorMessage: state.error ? t(ERROR_KEY[state.error]) : null,
    score: passwordScore(password),
    changeEmail: (value: string) => dispatch({ type: 'account-changed', email: value, displayName: state.displayName }),
    changeDisplayName: (value: string) => dispatch({ type: 'account-changed', email: state.email, displayName: value }),
    changePassword: (value: string) => {
      setPassword(value);
      setFieldError(null);
    },
    changeConfirmPassword: (value: string) => {
      setConfirmPassword(value);
      setFieldError(null);
    },
    changeConfirmation: (value: string) => {
      setConfirmation(value);
      setFieldError(null);
    },
    submitAccount,
    submitPassword,
    submitRecovery,
    copyRecoveryKey,
    downloadRecoveryKey,
    continueTwoFactor,
    retry,
    leave,
  };
};
