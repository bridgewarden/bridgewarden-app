import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import { t } from '~/lib/i18n/en';
import { TOTP_CODE_PATTERN } from '~/lib/totp-code';
import { clearVaultKey } from '~/lib/vault/key-store';

type LoginActionsOptions = {
  email: string;
  password: string;
  backupMode: boolean;
  challengeToken: string | null;
  challengeCode: string;
  emailRef: MutableRefObject<string>;
  passwordRef: MutableRefObject<string>;
  wrapKeyRef: MutableRefObject<Uint8Array | null>;
  setEmail: Dispatch<SetStateAction<string>>;
  setPassword: Dispatch<SetStateAction<string>>;
  setFieldError: Dispatch<SetStateAction<string | null>>;
  setFormError: Dispatch<SetStateAction<string | null>>;
  setFlowActive: Dispatch<SetStateAction<boolean>>;
  setChallengeCode: Dispatch<SetStateAction<string>>;
  setChallengeError: Dispatch<SetStateAction<string | null>>;
  setChallengeToken: Dispatch<SetStateAction<string | null>>;
  setBackupMode: Dispatch<SetStateAction<boolean>>;
  submitPrelogin: (email: string) => void;
  submitChallengeRequest: (input: { challengeToken: string; code?: string; backupCode?: string }) => void;
};

export const useLoginActions = (options: LoginActionsOptions) => {
  const changeEmail = (value: string) => {
    options.setEmail(value);
    options.setFieldError(null);
  };

  const changePassword = (value: string) => {
    options.setPassword(value);
    options.setFieldError(null);
  };

  const changeChallengeCode = (value: string) => {
    options.setChallengeCode(options.backupMode ? value : value.replace(/\D/g, ''));
    options.setChallengeError(null);
  };

  const submitCredentials = () => {
    const normalizedEmail = options.email.trim().toLowerCase();
    if (!normalizedEmail || !options.password) {
      options.setFieldError(t('login.missingFields'));
      options.setFormError(null);
      return;
    }

    options.setFieldError(null);
    options.setFormError(null);
    options.setFlowActive(true);
    clearVaultKey();
    options.emailRef.current = normalizedEmail;
    options.passwordRef.current = options.password;
    options.submitPrelogin(normalizedEmail);
  };

  const submitChallenge = () => {
    if (!options.challengeToken) return;
    if (!options.challengeCode.trim()) {
      options.setChallengeError(t('login.challengeCodeRequired'));
      return;
    }
    if (!options.backupMode && !TOTP_CODE_PATTERN.test(options.challengeCode)) {
      options.setChallengeError(t('login.invalidChallengeCode'));
      return;
    }

    options.setChallengeError(null);
    options.setFlowActive(true);
    options.submitChallengeRequest({
      challengeToken: options.challengeToken,
      ...(options.backupMode ? { backupCode: options.challengeCode } : { code: options.challengeCode }),
    });
  };

  const toggleBackupMode = () => {
    options.setBackupMode((value) => !value);
    options.setChallengeCode('');
    options.setChallengeError(null);
  };

  const backToCredentials = () => {
    options.wrapKeyRef.current?.fill(0);
    options.wrapKeyRef.current = null;
    clearVaultKey();
    options.setChallengeToken(null);
    options.setChallengeCode('');
    options.setChallengeError(null);
    options.setBackupMode(false);
    options.setFormError(null);
    options.setFlowActive(false);
  };

  return {
    changeEmail,
    changePassword,
    changeChallengeCode,
    submitCredentials,
    submitChallenge,
    toggleBackupMode,
    backToCredentials,
  };
};
