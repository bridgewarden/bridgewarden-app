import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createTestUser } from '../../__test__/fixtures';
import { loader } from '../../root';
import { cloudflareContext } from '../../lib/.server/context';
import { createSession } from '../../lib/.server/session';

const context = new RouterContextProvider();
context.set(cloudflareContext, { env, ctx: {} as ExecutionContext });

const load = (cookie?: string) =>
  loader({
    request: new Request('http://localhost/', cookie ? { headers: { cookie } } : undefined),
    context,
  } as never);

describe('root loader', () => {
  it('returns the theme from the cookie', async () => {
    await expect(load('bw_theme=dark')).resolves.toEqual({
      theme: 'dark',
      user: null,
      twoFactorEnabled: false,
    });
    await expect(load('bw_theme=light')).resolves.toEqual({
      theme: 'light',
      user: null,
      twoFactorEnabled: false,
    });
  });

  it('defaults to system without a cookie', async () => {
    await expect(load()).resolves.toEqual({
      theme: 'system',
      user: null,
      twoFactorEnabled: false,
    });
  });

  it('ignores a malformed cookie instead of failing the request', async () => {
    await expect(load('bw_theme=%E0%A4%A')).resolves.toEqual({
      theme: 'system',
      user: null,
      twoFactorEnabled: false,
    });
  });

  it('returns only the public user fields for a valid session', async () => {
    const userId = await createTestUser({ email: 'root@example.com' });
    const session = await createSession(env, { userId, ver: 0 });

    await expect(load(`bw_session=${session.token}`)).resolves.toEqual({
      theme: 'system',
      user: { id: userId, displayName: 'Test User', email: 'root@example.com', role: 'member' },
      twoFactorEnabled: false,
    });
  });
});
