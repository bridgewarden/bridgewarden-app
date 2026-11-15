import { useEffect, useReducer, useState } from 'react';
import { useBlocker } from 'react-router';

import { useRecoveryActions } from '~/hooks/use-recovery-actions';
import { t, type MessageKey } from '~/lib/i18n/en';
import { passwordScore } from '~/lib/password-policy';
import { clearVaultKey, setVaultKey } from '~/lib/vault/key-store';

import { generateSetupKeyMaterial } from '../../lib/crypto/setup-keys';
import { ERROR_KEY } from './setup.constants';
import { useSetupSubmission } from './hooks/use-setup-submission';
import { isMasterPasswordValid, passwordsMatch, recoveryConfirmationMatches, validateAccount } from './setup.lib';
import { initialSetupState, setupReducer } from './setup.state';

export const useSetupFlow = () => {
  const [state, dispatch] = useReducer(setupReducer, initialSetupState);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloaded' | 'failed'>('idle');
  const [fieldError, setFieldError] = useState<MessageKey | null>(null);
  const [deriving, setDeriving] = useState(false);

  const blocker = useBlocker(state.keys !== null && state.step !== 'done' && state.step !== 'configured');
  const submission = useSetupSubmission({ state, dispatch });

  useEffect(() => {
    if (state.keys === null) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.keys]);

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
      setFieldError('password.hint');
      return;
    }

    if (!passwordsMatch(password, confirmPassword)) {
      setFieldError('password.mismatch');
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
    setCopyStatus,
    setDownloadStatus,
  });

  const leave = () => {
    clearVaultKey();
    dispatch({ type: 'leave' });
    if (blocker.state === 'blocked') blocker.reset();
  };

  const backToAccount = () => {
    dispatch({ type: 'back-to-account' });
    setPassword('');
    setConfirmPassword('');
    setFieldError(null);
  };

  const backToPassword = () => {
    clearVaultKey();
    dispatch({ type: 'back-to-password' });
    setPassword('');
    setConfirmPassword('');
    setConfirmation('');
    setCopyStatus('idle');
    setDownloadStatus('idle');
    setFieldError(null);
  };

  return {
    view: state,
    blocker,
    busy: submission.busy,
    errorMessage: state.error ? t(ERROR_KEY[state.error]) : null,
    fieldError,
    leave,
    account: {
      changeEmail: (value: string) => {
        setFieldError(null);
        dispatch({ type: 'account-changed', email: value, displayName: state.displayName });
      },
      changeDisplayName: (value: string) => {
        setFieldError(null);
        dispatch({ type: 'account-changed', email: state.email, displayName: value });
      },
      submitAccount,
    },
    password: {
      password,
      confirmPassword,
      deriving,
      score: passwordScore(password),
      changePassword: (value: string) => {
        setPassword(value);
        setFieldError(null);
      },
      changeConfirmPassword: (value: string) => {
        setConfirmPassword(value);
        setFieldError(null);
      },
      backToAccount,
      submitPassword,
    },
    recovery: {
      confirmation,
      copyStatus,
      downloadStatus,
      changeConfirmation: (value: string) => {
        setConfirmation(value);
        setFieldError(null);
      },
      copyRecoveryKey,
      downloadRecoveryKey,
      backToPassword,
      submitRecovery,
    },
    twoFactor: {
      canRetry: Boolean(state.error && state.keys),
      retry: submission.retry,
      continueTwoFactor: submission.continueTwoFactor,
    },
  };
};
