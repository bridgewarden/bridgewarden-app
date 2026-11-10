import { describe, expect, it } from 'vitest';

import { createInvitationToken, hashInvitationToken } from '../invitation-token';

describe('invitation token', () => {
  it('creates a 32-byte base64url token and stores only a hash', async () => {
    const { token, tokenHash } = await createInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toContain(token);
    await expect(hashInvitationToken(token)).resolves.toBe(tokenHash);
  });

  it('produces distinct tokens', async () => {
    const first = await createInvitationToken();
    const second = await createInvitationToken();
    expect(first.token).not.toBe(second.token);
  });
});
