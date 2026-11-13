import { afterEach, describe, expect, it, vi } from 'vitest';

import { hmacSha256, toHex } from '../hmac';
import { buildErrorResponse, hashUserId, normalizeRoutePattern, writeRequestLog, type RequestLog } from '../log';

const env = { AUTH_PEPPER: 'test-pepper' } as Env;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request logging', () => {
  it('normalizes UUID route segments without dropping static routes', () => {
    expect(normalizeRoutePattern('/api/vault/items/0f8fad5b-d9cb-469f-a165-70867728950e/purge')).toBe(
      '/api/vault/items/:id/purge',
    );
    expect(normalizeRoutePattern('/app/edit/0f8fad5b-d9cb-469f-a165-70867728950e')).toBe('/app/edit/:itemId');
    expect(normalizeRoutePattern('/api/vault/items/admin/purge')).toBe('/api/vault/items/:id/purge');
    expect(normalizeRoutePattern('/app/edit/arbitrary-id')).toBe('/app/edit/:itemId');
    expect(normalizeRoutePattern('/login')).toBe('/login');
  });

  it('hashes user ids without exposing the raw value', async () => {
    const first = await hashUserId(env, 'user-123');
    const second = await hashUserId(env, 'user-123');
    const other = await hashUserId(env, 'user-456');

    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(first).not.toContain('user-123');
    expect(first).toBe(toHex(await hmacSha256('test-pepper', 'user:user-123')).slice(0, 32));
  });

  it('emits one JSON line with no request payload fields', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const entry: RequestLog = {
      event: 'request.completed',
      requestId: 'request-id',
      method: 'POST',
      route: '/api/vault/items/:id',
      status: 200,
      durationMs: 12,
      userIdHash: 'hash',
    };

    writeRequestLog(entry);

    expect(log).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(parsed).toEqual(entry);
    expect(JSON.stringify(parsed)).not.toContain('cookie');
  });

  it('logs stack server-side for errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const entry: RequestLog = {
      event: 'request.error',
      requestId: 'request-id',
      method: 'GET',
      route: '/app',
      status: 500,
      durationMs: 4,
      userIdHash: null,
    };

    writeRequestLog(entry, new Error('boom'));

    const parsed = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(parsed).toMatchObject({ event: 'request.error', requestId: 'request-id', errorName: 'Error' });
    expect(String(parsed.stack)).toContain('Error: boom');
  });

  it('returns null when the user is absent or the pepper is missing', async () => {
    expect(await hashUserId(env, null)).toBeNull();
    expect(await hashUserId({} as Env, 'user-123')).toBeNull();
  });

  it('returns a correlatable generic error body', async () => {
    const response = buildErrorResponse('request-id');

    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('request-id');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ error: 'internal_error', requestId: 'request-id' });
  });
});
