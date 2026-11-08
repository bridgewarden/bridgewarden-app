import { normalizeRecoveryKey } from '../../lib/crypto/recovery';
import type { SetupTransportMaterial } from './setup-keys';

export type SetupStep =
  'token' | 'account' | 'password' | 'recovery' | 'two-factor' | 'submitting' | 'configured' | 'done';

export type SetupError =
  'forbidden' | 'invalid-input' | 'already-configured' | 'server-error' | 'network' | 'recovery-mismatch';

export type SetupState = {
  step: SetupStep;
  token: string;
  email: string;
  displayName: string;
  keys: SetupTransportMaterial | null;
  recoveryKey: string;
  error: SetupError | null;
};

export type SetupActionResponse = { ok: true } | { ok: false; error: SetupError };

export type SetupAction =
  | { type: 'token-accepted'; token: string }
  | { type: 'account-accepted'; email: string; displayName: string }
  | { type: 'keys-generated'; keys: SetupTransportMaterial; recoveryKey: string }
  | { type: 'recovery-confirmed' }
  | { type: 'two-factor-continued' }
  | { type: 'retry' }
  | { type: 'failed'; error: SetupError }
  | { type: 'succeeded' };

export const initialSetupState: SetupState = {
  step: 'token',
  token: '',
  email: '',
  displayName: '',
  keys: null,
  recoveryKey: '',
  error: null,
};

export const isMasterPasswordValid = (password: string): boolean => password.length >= 12;

export const recoveryConfirmationMatches = (recoveryKey: string, confirmation: string): boolean => {
  const expected = normalizeRecoveryKey(recoveryKey).slice(0, 6);
  const actual = normalizeRecoveryKey(confirmation);

  return expected.length === 6 && actual.length >= 6 && actual.slice(0, 6) === expected;
};

export const setupReducer = (state: SetupState, action: SetupAction): SetupState => {
  switch (action.type) {
    case 'token-accepted':
      return { ...state, step: 'account', token: action.token, error: null };
    case 'account-accepted':
      return { ...state, step: 'password', email: action.email, displayName: action.displayName, error: null };
    case 'keys-generated':
      return { ...state, step: 'recovery', keys: action.keys, recoveryKey: action.recoveryKey, error: null };
    case 'recovery-confirmed':
      return { ...state, step: 'two-factor', recoveryKey: '', error: null };
    case 'two-factor-continued':
      return { ...state, step: 'submitting', error: null };
    case 'retry':
      return { ...state, step: 'submitting', error: null };
    case 'failed':
      switch (action.error) {
        case 'forbidden':
          return { ...state, step: 'token', keys: null, recoveryKey: '', error: action.error };
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
