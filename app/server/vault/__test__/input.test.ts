import { describe, expect, it } from 'vitest';

import { toBase64Url } from '../../../lib/base64-url';
import { MAX_ITEM_CIPHERTEXT_BYTES } from '../../../lib/vault/limits';
import { parseCreateItemInput } from '../input';

const body = (bytes: number) => ({
  type: 'note',
  favorite: false,
  dataCt: toBase64Url(new Uint8Array(bytes).fill(7)),
  dataIv: toBase64Url(new Uint8Array(12).fill(3)),
  dataVersion: 1,
});

describe('vault item input limits', () => {
  it('accepts a 50KB note ciphertext', () => {
    expect(parseCreateItemInput(body(50 * 1024))).not.toBeNull();
  });

  it('rejects an envelope version this build cannot write', () => {
    expect(parseCreateItemInput({ ...body(10), dataVersion: 2 })).not.toBeNull();
    expect(parseCreateItemInput({ ...body(10), dataVersion: 3 })).toBeNull();
  });

  it('rejects ciphertext above the shared ceiling', () => {
    expect(parseCreateItemInput(body(MAX_ITEM_CIPHERTEXT_BYTES))).not.toBeNull();
    expect(parseCreateItemInput(body(MAX_ITEM_CIPHERTEXT_BYTES + 1))).toBeNull();
  });
});
