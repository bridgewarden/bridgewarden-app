import { describe, expect, it } from 'vitest';

import { UnsupportedEnvelopeError } from '../../crypto/errors';
import { openItem } from '../../crypto/envelope';
import { cachedEnvelope } from '../sealed-envelope';

describe('cached envelope versions', () => {
  it('passes unknown row versions through so they are rejected, not downgraded to v1', async () => {
    const envelope = cachedEnvelope('Y3Q=', 'aXY=', 3);
    expect(envelope.v).toBe(3);
    await expect(
      openItem(envelope, crypto.getRandomValues(new Uint8Array(32)), { kind: 'item', id: 'id', type: 'login' }),
    ).rejects.toThrow(UnsupportedEnvelopeError);
  });
});
