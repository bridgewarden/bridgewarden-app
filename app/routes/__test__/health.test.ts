import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { cloudflareContext } from '../../lib/.server/context';
import { loader } from '../health';

const createArgs = (ok: number) => {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: {
      AUTH_PEPPER: 'test-pepper',
      RATE_LIMITER_IP: { limit: async () => ({ success: true }) },
      DB: {
        prepare: () => ({
          first: async () => ({ ok }),
        }),
      },
    } as never,
    ctx: {} as never,
  });

  return {
    context,
    params: {},
    request: new Request('http://localhost/health'),
  } as never;
};

describe('health loader', () => {
  it('returns ok when D1 answers', async () => {
    const response = await loader(createArgs(1));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('rejects a rate-limited probe before querying D1', async () => {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      env: {
        AUTH_PEPPER: 'test-pepper',
        RATE_LIMITER_IP: { limit: async () => ({ success: false }) },
        DB: {
          prepare: () => {
            throw new Error('D1 must not be queried');
          },
        },
      } as never,
      ctx: {} as never,
    });
    const result = await loader({ context, params: {}, request: new Request('http://localhost/health') } as never);
    expect((result as unknown as { init?: { status?: number } }).init?.status).toBe(429);
  });

  it('reports a schema mismatch when applied migrations differ from the canary', async () => {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      env: {
        AUTH_PEPPER: 'test-pepper',
        RATE_LIMITER_IP: { limit: async () => ({ success: true }) },
        DB: {
          prepare: (sql: string) => ({
            first: async () => (sql.includes('d1_migrations') ? { version: 14 } : { ok: 1 }),
          }),
        },
      } as never,
      ctx: {} as never,
    });
    const response = await loader({
      context,
      params: {},
      request: new Request('http://localhost/health?schema=1'),
    } as never);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, appliedMigrations: 14 });
  });

  it('reports a compatible schema canary', async () => {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, {
      env: {
        AUTH_PEPPER: 'test-pepper',
        RATE_LIMITER_IP: { limit: async () => ({ success: true }) },
        DB: {
          prepare: (sql: string) => ({
            first: async () => (sql.includes('d1_migrations') ? { version: 15 } : { ok: 1 }),
          }),
        },
      } as never,
      ctx: {} as never,
    });
    const response = await loader({
      context,
      params: {},
      request: new Request('http://localhost/health?schema=1'),
    } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, schemaVersion: 15, appliedMigrations: 15 });
  });

  it('returns ok false when the query does not answer with 1', async () => {
    const response = await loader(createArgs(0));

    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
