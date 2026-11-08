import { describe, expect, it } from 'vitest';

import { isSameOrigin } from '../request-origin';

describe('same-origin check', () => {
  it('accepts the configured origin', () => {
    const request = new Request('https://worker.example/setup', {
      method: 'POST',
      headers: { origin: 'https://app.example' },
    });

    expect(isSameOrigin(request, 'https://app.example')).toBe(true);
  });

  it('accepts the request origin only when explicitly allowed', () => {
    const request = new Request('https://localhost:8787/setup', {
      method: 'POST',
      headers: { origin: 'https://localhost:8787' },
    });

    expect(isSameOrigin(request, 'https://app.example', false)).toBe(false);
    expect(isSameOrigin(request, 'https://app.example', true)).toBe(true);
  });

  it('rejects missing and foreign origins', () => {
    const missing = new Request('https://app.example/setup', { method: 'POST' });
    const foreign = new Request('https://app.example/setup', {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
    });

    expect(isSameOrigin(missing, 'https://app.example', true)).toBe(false);
    expect(isSameOrigin(foreign, 'https://app.example', true)).toBe(false);
  });
});
