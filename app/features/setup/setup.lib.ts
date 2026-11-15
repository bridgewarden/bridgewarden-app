import { isMasterPasswordAcceptable } from '~/lib/password-policy';

import { normalizeRecoveryKey } from '../../lib/crypto/recovery';

import type { AccountInput } from './setup.types';

export const isMasterPasswordValid = isMasterPasswordAcceptable;

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
