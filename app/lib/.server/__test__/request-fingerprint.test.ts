import { describe, expect, it } from 'vitest';

import { hmacSha256, toHex } from '../hmac';
import { fingerprintRequest } from '../request-fingerprint';

describe('request fingerprints', () => {
  it('hashes user agent and IP with the session secret', async () => {
    const request = new Request('https://app.example', {
      headers: { 'user-agent': 'agent', 'cf-connecting-ip': '203.0.113.7' },
    });

    const result = await fingerprintRequest(request, 'secret');

    expect(result.uaHash).toBe(toHex(await hmacSha256('secret', 'ua:agent')));
    expect(result.ipHash).toBe(toHex(await hmacSha256('secret', 'ip:203.0.113.7')));
    expect(result.uaHash).not.toContain('agent');
  });

  it('returns null for missing headers', async () => {
    await expect(fingerprintRequest(new Request('https://app.example'), 'secret')).resolves.toEqual({
      uaHash: null,
      ipHash: null,
    });
  });
});
