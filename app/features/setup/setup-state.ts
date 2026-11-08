import { normalizeRecoveryKey } from '../../lib/crypto/recovery';
import type { SetupTransportMaterial } from './setup-keys';

export const SETUP_STEPS = ['account', 'password', 'recovery', 'two-factor'] as const;
export type SetupFormStep = (typeof SETUP_STEPS)[number];
export type SetupStep = SetupFormStep | 'submitting' | 'configured' | 'done';

export const MIN_MASTER_PASSWORD_LENGTH = 12;

export type SetupError = 'forbidden' | 'invalid-input' | 'already-configured' | 'server-error' | 'network';

export type SetupState = {
  step: SetupStep;
  email: string;
  displayName: string;
  keys: SetupTransportMaterial | null;
  recoveryKey: string;
  error: SetupError | null;
};

export type SetupActionResponse = { ok: true } | { ok: false; error: SetupError };

export type SetupAction =
  | { type: 'account-changed'; email: string; displayName: string }
  | { type: 'account-accepted'; email: string; displayName: string }
  | { type: 'back-to-account' }
  | { type: 'keys-generated'; keys: SetupTransportMaterial; recoveryKey: string }
  | { type: 'recovery-confirmed' }
  | { type: 'two-factor-continued' }
  | { type: 'retry' }
  | { type: 'leave' }
  | { type: 'failed'; error: SetupError }
  | { type: 'succeeded' };

export const initialSetupState: SetupState = {
  step: 'account',
  email: '',
  displayName: '',
  keys: null,
  recoveryKey: '',
  error: null,
};

export const isMasterPasswordValid = (password: string): boolean => password.length >= MIN_MASTER_PASSWORD_LENGTH;

export const passwordsMatch = (password: string, confirmation: string): boolean => password === confirmation;

export type AccountInput = {
  email: string;
  displayName: string;
};

export const validateAccount = (email: string, displayName: string): AccountInput | null => {
  const nextEmail = email.trim().toLowerCase();
  const nextDisplayName = displayName.trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(nextEmail) || nextEmail.length > 254) return null;
  if (nextDisplayName.length === 0 || nextDisplayName.length > 100) return null;

  return { email: nextEmail, displayName: nextDisplayName };
};

export const recoveryConfirmationMatches = (recoveryKey: string, confirmation: string): boolean => {
  const expected = normalizeRecoveryKey(recoveryKey).slice(0, 6);
  const actual = normalizeRecoveryKey(confirmation);

  return expected.length === 6 && actual.length >= 6 && actual.slice(0, 6) === expected;
};

export const setupReducer = (state: SetupState, action: SetupAction): SetupState => {
  switch (action.type) {
    case 'account-changed':
      return { ...state, email: action.email, displayName: action.displayName, error: null };
    case 'account-accepted':
      return { ...state, step: 'password', email: action.email, displayName: action.displayName, error: null };
    case 'back-to-account':
      return { ...state, step: 'account', error: null };
    case 'keys-generated':
      return { ...state, step: 'recovery', keys: action.keys, recoveryKey: action.recoveryKey, error: null };
    case 'recovery-confirmed':
      return { ...state, step: 'two-factor', recoveryKey: '', error: null };
    case 'two-factor-continued':
      return { ...state, step: 'submitting', error: null };
    case 'retry':
      return { ...state, step: 'submitting', error: null };
    case 'leave':
      return { ...state, step: 'configured', keys: null, recoveryKey: '', error: null };
    case 'failed':
      switch (action.error) {
        case 'invalid-input':
          return { ...state, step: 'account', error: action.error };
        case 'already-configured':
          return { ...state, step: 'configured', keys: null, recoveryKey: '', error: null };
        default:
          return { ...state, step: 'two-factor', error: action.error };
      }
    case 'succeeded':
      return { ...state, step: 'done', keys: null, recoveryKey: '', error: null };
  }
};
