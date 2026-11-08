import { describe, expect, it } from 'vitest';

import { verifyBootstrapToken } from '../bootstrap-token';

describe('bootstrap token', () => {
  const token = 'correct-bootstrap-token';
  const fakeEnv = { BOOTSTRAP_TOKEN: token } as Env;

  it('accepts only the configured token', () => {
    expect(verifyBootstrapToken(fakeEnv, token)).toBe(true);
    expect(verifyBootstrapToken(fakeEnv, `${token}x`)).toBe(false);
  });

  it('fails closed when the secret is missing', () => {
    expect(verifyBootstrapToken({} as Env, token)).toBe(false);
    expect(verifyBootstrapToken({ BOOTSTRAP_TOKEN: '   ' } as Env, token)).toBe(false);
  });
});
