import type { SetupTransportMaterial } from './setup-keys';

export type SetupError = 'forbidden' | 'invalid-input' | 'already-configured' | 'server-error' | 'network';
export type SetupActionResponse = { ok: true } | { ok: false; error: SetupError };

export type SetupState = {
  step: SetupStep;
  email: string;
  displayName: string;
  keys: SetupTransportMaterial | null;
  recoveryKey: string;
  error: SetupError | null;
};

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

export type AccountInput = {
  email: string;
  displayName: string;
};

export const SETUP_STEPS = ['account', 'password', 'recovery', 'two-factor'] as const;
export type SetupFormStep = (typeof SETUP_STEPS)[number];
export type SetupStep = SetupFormStep | 'submitting' | 'configured' | 'done';
