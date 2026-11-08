import { describe, expect, it } from 'vitest';

import {
  initialSetupState,
  isMasterPasswordValid,
  passwordsMatch,
  recoveryConfirmationMatches,
  setupReducer,
  validateAccount,
  type SetupState,
} from '../setup-state';
import type { SetupTransportMaterial } from '../setup-keys';

const keys: SetupTransportMaterial = {
  kdfSalt: 'salt',
  kdfIterations: 600_000,
  authHash: 'auth',
  vaultKeyWrapped: 'wrapped',
  vaultKeyWrapIv: 'iv',
  recoveryKeyWrapped: 'recovery',
  recoveryKeyWrapIv: 'iv',
};

describe('setup state machine', () => {
  it('walks the wizard steps in order', () => {
    let state: SetupState = initialSetupState;
    state = setupReducer(state, { type: 'account-accepted', email: 'a@example.com', displayName: 'A' });
    state = setupReducer(state, { type: 'keys-generated', keys, recoveryKey: 'ABCD-EFGH' });
    expect(state.recoveryKey).toBe('ABCD-EFGH');

    state = setupReducer(state, { type: 'recovery-confirmed' });
    expect(state.recoveryKey).toBe('');
    state = setupReducer(state, { type: 'two-factor-continued' });
    state = setupReducer(state, { type: 'succeeded' });

    expect(state.step).toBe('done');
    expect(state.email).toBe('a@example.com');
    expect(state.keys).toBeNull();
  });

  it('supports editing, going back, retrying, and leaving', () => {
    let state = setupReducer(initialSetupState, { type: 'account-changed', email: 'a@example.com', displayName: 'A' });
    state = setupReducer(state, { type: 'account-accepted', email: 'a@example.com', displayName: 'A' });
    state = setupReducer(state, { type: 'back-to-account' });
    expect(state.step).toBe('account');

    state = setupReducer(state, { type: 'keys-generated', keys, recoveryKey: 'key' });
    state = setupReducer(state, { type: 'recovery-confirmed' });
    state = setupReducer(state, { type: 'two-factor-continued' });
    expect(state.step).toBe('submitting');
    state = setupReducer(state, { type: 'failed', error: 'network' });
    expect(state.step).toBe('two-factor');
    state = setupReducer(state, { type: 'retry' });
    expect(state.step).toBe('submitting');

    state = setupReducer(state, { type: 'leave' });
    expect(state.step).toBe('configured');
    expect(state.keys).toBeNull();
    expect(state.recoveryKey).toBe('');
  });

  it('maps failures to the step that can fix them', () => {
    const generated = setupReducer(initialSetupState, { type: 'keys-generated', keys, recoveryKey: 'key' });
    const network = setupReducer(generated, { type: 'failed', error: 'network' });
    const invalid = setupReducer(generated, { type: 'failed', error: 'invalid-input' });
    const forbidden = setupReducer(generated, { type: 'failed', error: 'forbidden' });
    const configured = setupReducer(generated, { type: 'failed', error: 'already-configured' });

    expect(network.step).toBe('two-factor');
    expect(network.keys).toEqual(keys);
    expect(invalid.step).toBe('account');
    expect(invalid.keys).toEqual(keys);
    expect(forbidden.step).toBe('two-factor');
    expect(forbidden.keys).toEqual(keys);
    expect(configured.step).toBe('configured');
    expect(configured.keys).toBeNull();
  });
});

describe('setup validation helpers', () => {
  it('requires a 12-character password and an exact confirmation', () => {
    expect(isMasterPasswordValid('12345678901')).toBe(false);
    expect(isMasterPasswordValid('123456789012')).toBe(true);
    expect(passwordsMatch('correct horse', 'correct horse')).toBe(true);
    expect(passwordsMatch('correct horse', 'correct horsf')).toBe(false);
  });

  it('validates and normalizes account fields once', () => {
    expect(validateAccount('  Admin@Example.COM ', ' Admin ')).toEqual({
      email: 'admin@example.com',
      displayName: 'Admin',
    });
    expect(validateAccount('not-an-email', 'Admin')).toBeNull();
    expect(validateAccount('admin@example.com', '   ')).toBeNull();
    expect(validateAccount('admin@example.com', 'x'.repeat(101))).toBeNull();
  });

  it('matches the first six normalized recovery characters', () => {
    expect(recoveryConfirmationMatches('ABCD-EFGH-JKMN', 'abcd')).toBe(false);
    expect(recoveryConfirmationMatches('ABCD-EFGH-JKMN', 'abcd ef')).toBe(true);
    expect(recoveryConfirmationMatches('IL0O-EFGH', '1100ef')).toBe(true);
    expect(recoveryConfirmationMatches('ABCD-EFGH', 'zzzzzz')).toBe(false);
  });
});
