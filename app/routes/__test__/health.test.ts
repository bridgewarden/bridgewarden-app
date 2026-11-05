import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { cloudflareContext } from '../../lib/.server/context';
import { loader } from '../health';

const createArgs = (ok: number) => {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: {
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

  it('returns ok false when the query does not answer with 1', async () => {
    const response = await loader(createArgs(0));

    await expect(response.json()).resolves.toEqual({ ok: false });
  });
});
