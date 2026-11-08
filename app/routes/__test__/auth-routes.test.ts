import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

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
});
