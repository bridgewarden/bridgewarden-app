import { describe, expect, it } from 'vitest';

import {
  initialSetupState,
  isMasterPasswordValid,
  recoveryConfirmationMatches,
  setupReducer,
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
    state = setupReducer(state, { type: 'token-accepted', token: 'secret' });
    state = setupReducer(state, { type: 'account-accepted', email: 'a@example.com', displayName: 'A' });
    state = setupReducer(state, { type: 'keys-generated', keys, recoveryKey: 'ABCD-EFGH' });
    expect(state.recoveryKey).toBe('ABCD-EFGH');

    state = setupReducer(state, { type: 'recovery-confirmed' });
    expect(state.recoveryKey).toBe('');
    state = setupReducer(state, { type: 'two-factor-continued' });
    state = setupReducer(state, { type: 'succeeded' });

    expect(state.step).toBe('done');
    expect(state.token).toBe('secret');
    expect(state.keys).toBeNull();
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
    expect(forbidden.step).toBe('token');
    expect(forbidden.keys).toBeNull();
    expect(configured.step).toBe('configured');
    expect(configured.keys).toBeNull();
  });
});

describe('setup validation helpers', () => {
  it('requires a 12-character password', () => {
    expect(isMasterPasswordValid('12345678901')).toBe(false);
    expect(isMasterPasswordValid('123456789012')).toBe(true);
  });

  it('matches the first six normalized recovery characters', () => {
    expect(recoveryConfirmationMatches('ABCD-EFGH-JKMN', 'abcd')).toBe(false);
    expect(recoveryConfirmationMatches('ABCD-EFGH-JKMN', 'abcd ef')).toBe(true);
    expect(recoveryConfirmationMatches('IL0O-EFGH', '1100ef')).toBe(true);
    expect(recoveryConfirmationMatches('ABCD-EFGH', 'zzzzzz')).toBe(false);
  });
});
