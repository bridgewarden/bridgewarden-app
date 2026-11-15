import { describe, expect, it } from 'vitest';

import {
  MIN_MASTER_PASSWORD_LENGTH,
  PASSWORD_STRENGTH_KEYS,
  isMasterPasswordAcceptable,
  passwordScore,
} from '../password-policy';

describe('password policy', () => {
  it('scores password complexity from four signals', () => {
    expect(passwordScore('')).toBe(0);
    expect(passwordScore('short')).toBe(0);
    expect(passwordScore('Abcdefghijkl')).toBe(2);
    expect(passwordScore('Abcdefghij1!')).toBe(4);
  });

  it('keeps the strength labels aligned with the five score states', () => {
    expect(PASSWORD_STRENGTH_KEYS).toEqual([
      'password.strength.weak',
      'password.strength.weak',
      'password.strength.fair',
      'password.strength.good',
      'password.strength.strong',
    ]);
  });

  it('enforces the minimum master password length', () => {
    expect(isMasterPasswordAcceptable('a'.repeat(MIN_MASTER_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isMasterPasswordAcceptable('a'.repeat(MIN_MASTER_PASSWORD_LENGTH))).toBe(true);
  });
});
