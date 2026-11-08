import type { SetupAction, SetupState } from './setup.types';

export const initialSetupState: SetupState = {
  step: 'account',
  email: '',
  displayName: '',
  keys: null,
  recoveryKey: '',
  error: null,
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
