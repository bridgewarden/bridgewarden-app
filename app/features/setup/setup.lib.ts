import { normalizeRecoveryKey } from '../../lib/crypto/recovery';

import { MIN_MASTER_PASSWORD_LENGTH, STRENGTH_KEYS } from './setup.constants';
import { SETUP_STEPS, type AccountInput, type SetupStep } from './setup.types';

export const isMasterPasswordValid = (password: string): boolean => password.length >= MIN_MASTER_PASSWORD_LENGTH;

export const passwordsMatch = (password: string, confirmation: string): boolean => password === confirmation;

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

export const passwordScore = (password: string): number => {
  if (!password) return 0;

  return [
    password.length >= MIN_MASTER_PASSWORD_LENGTH,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
};

export const stepNumber = (step: SetupStep): number | null => {
  const index = SETUP_STEPS.indexOf(step as (typeof SETUP_STEPS)[number]);

  return index >= 0 ? index + 1 : null;
};

export const strengthKey = (score: number) => STRENGTH_KEYS[score];
