import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { action as twoFactorAction } from '../auth-2fa';
import { action as disableAction } from '../api-account-2fa-disable';
import { action as enrollAction } from '../api-account-2fa-enroll';
import { action as regenerateAction } from '../api-account-2fa-regenerate';
import { action as verifyAction } from '../api-account-2fa-verify';
import { action as loginAction } from '../auth-login';
import { action as logoutAction } from '../auth-logout';
import { action as preloginAction } from '../auth-prelogin';
import { cloudflareContext } from '../../lib/.server/context';

const context = new RouterContextProvider();
context.set(cloudflareContext, {
  env: { ...env, APP_ORIGIN: 'https://app.example', APP_ENV: 'production' } as Env,
  ctx: {} as ExecutionContext,
});

const invoke = (action: typeof preloginAction, request: Request) => action({ request, context, params: {} } as never);

const statusOf = (result: unknown): number => (result as { init?: { status?: number } }).init?.status ?? 200;

const settle = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    return await run();
  } catch (error) {
    return error;
  }
};

const request = (path: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`https://app.example${path}`, {
    method: 'POST',
    headers: { origin: 'https://app.example', 'content-type': 'application/json', ...headers },
    body,
  });

describe('auth route guards', () => {
  it('rejects foreign origins on prelogin, login, and logout', async () => {
    const foreign = { origin: 'https://evil.example' };

    expect(statusOf(await invoke(preloginAction, request('/auth/prelogin', '{}', foreign)))).toBe(403);
    expect(statusOf(await invoke(loginAction, request('/auth/login', '{}', foreign)))).toBe(403);
    expect(statusOf(await invoke(logoutAction, request('/auth/logout', '{}', foreign)))).toBe(403);
  });

  it('rejects unsupported and oversized bodies before use-cases', async () => {
    expect(
      statusOf(await invoke(preloginAction, request('/auth/prelogin', '{}', { 'content-type': 'text/plain' }))),
    ).toBe(415);
    expect(
      statusOf(await invoke(preloginAction, request('/auth/prelogin', '{}', { 'content-length': '999999' }))),
    ).toBe(413);
  });

  it('rejects malformed and schema-invalid payloads', async () => {
    expect(statusOf(await invoke(preloginAction, request('/auth/prelogin', 'not-json')))).toBe(400);
    expect(statusOf(await invoke(preloginAction, request('/auth/prelogin', '{}')))).toBe(400);
    expect(statusOf(await invoke(loginAction, request('/auth/login', '{}')))).toBe(400);
  });

  it('guards the 2FA challenge and account API routes', async () => {
    const foreign = { origin: 'https://evil.example' };
    const authHash = 'A'.repeat(43);
    const endpoints = [
      [
        twoFactorAction,
        '/auth/2fa',
        '{"challengeToken":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","code":"000000"}',
      ],
      [enrollAction, '/api/account/2fa/enroll', JSON.stringify({ authHash })],
      [verifyAction, '/api/account/2fa/verify', '{"code":"000000"}'],
      [disableAction, '/api/account/2fa/disable', JSON.stringify({ authHash })],
      [regenerateAction, '/api/account/2fa/backup-codes/regenerate', JSON.stringify({ authHash })],
    ] as const;

    for (const [action, path, body] of endpoints) {
      const handler = action as unknown as (args: never) => Promise<unknown>;
      expect(
        statusOf(await settle(() => handler({ request: request(path, body, foreign), context, params: {} } as never))),
      ).toBe(403);
      expect(
        statusOf(await settle(() => handler({ request: request(path, 'not-json'), context, params: {} } as never))),
      ).toBe(400);
      if (path !== '/auth/2fa') {
        expect(
          statusOf(await settle(() => handler({ request: request(path, body), context, params: {} } as never))),
        ).toBe(401);
      }
    }
  });
});
