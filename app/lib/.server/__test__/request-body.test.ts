import { describe, expect, it } from 'vitest';

import { readJsonBody } from '../request-body';

const jsonRequest = (body: string, headers: Record<string, string> = {}) =>
  new Request('https://app.example/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });

describe('JSON request body limits', () => {
  it('parses JSON and rejects unsupported types', async () => {
    await expect(readJsonBody(jsonRequest('{"a":1}'))).resolves.toEqual({ ok: true, value: { a: 1 } });
    await expect(readJsonBody(jsonRequest('{}', { 'content-type': 'text/plain' }))).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    });
  });

  it('rejects malformed and oversized bodies', async () => {
    await expect(readJsonBody(jsonRequest('not-json'))).resolves.toEqual({ ok: false, reason: 'invalid' });
    await expect(readJsonBody(jsonRequest('12345', { 'content-length': '999999' }))).resolves.toEqual({
      ok: false,
      reason: 'too-large',
    });
    await expect(readJsonBody(jsonRequest('12345'), 4)).resolves.toEqual({ ok: false, reason: 'too-large' });
  });
});
