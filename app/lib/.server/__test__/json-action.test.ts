import { describe, expect, it } from 'vitest';

import { readMutationJson } from '../json-action';

const env = { APP_ORIGIN: 'https://app.example', APP_ENV: 'production' } as Env;

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://app.example/auth/login', {
    method: 'POST',
    headers: { origin: 'https://app.example', 'content-type': 'application/json', ...headers },
    body,
  });

describe('mutation JSON guard', () => {
  it('accepts same-origin JSON', async () => {
    await expect(readMutationJson(request('{"email":"a@example.com"}'), env)).resolves.toEqual({
      ok: true,
      value: { email: 'a@example.com' },
    });
  });

  it('rejects foreign origins, unsupported types, and oversized bodies', async () => {
    await expect(readMutationJson(request('{}', { origin: 'https://evil.example' }), env)).resolves.toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
    });
    await expect(readMutationJson(request('{}', { 'content-type': 'text/plain' }), env)).resolves.toEqual({
      ok: false,
      status: 415,
      error: 'invalid-input',
    });
    await expect(readMutationJson(request('x'.repeat(256 * 1024 + 1)), env)).resolves.toEqual({
      ok: false,
      status: 413,
      error: 'invalid-input',
    });
  });
});
