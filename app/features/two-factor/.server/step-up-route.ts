import { data, type RouterContextProvider } from 'react-router';

import { cloudflareContext } from '../../../lib/.server/context';
import { readMutationJson } from '../../../lib/.server/json-action';
import { limitIdentity, limitIp, rateLimited } from '../../../lib/.server/rate-limit';
import { requireUserApi } from '../../../lib/.server/require-user';
import { parseStepUpInput } from './two-factor-input';

type TwoFactorGuard<T> =
  | { ok: true; env: Env; user: { id: string; email: string }; input: T }
  | { ok: false; response: ReturnType<typeof data> };

export const readTwoFactorAction = async <T>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  parseInput: (value: unknown) => T | null,
): Promise<TwoFactorGuard<T>> => {
  const { env } = context.get(cloudflareContext);
  const ipLimit = await limitIp(env, '2fa-step-up', request);
  if (!ipLimit.allowed) return { ok: false, response: rateLimited(ipLimit.retryAfter) };

  const mutation = await readMutationJson(request, env);
  if (!mutation.ok) {
    return { ok: false, response: data({ ok: false, error: mutation.error }, { status: mutation.status }) };
  }

  const input = parseInput(mutation.value);
  if (!input) return { ok: false, response: data({ ok: false, error: 'invalid-input' }, { status: 400 }) };

  const { user } = await requireUserApi(request, env);
  const identityLimit = await limitIdentity(env, '2fa-step-up', user.email);
  if (!identityLimit.allowed) return { ok: false, response: rateLimited(identityLimit.retryAfter) };

  return { ok: true, env, user, input };
};

export const readStepUpAction = (request: Request, context: Readonly<RouterContextProvider>) =>
  readTwoFactorAction(request, context, parseStepUpInput);

export const stepUpErrorResponse = (result: {
  status: string;
  retryAfter?: number;
}): ReturnType<typeof data> | null => {
  if (result.status === 'invalid-password') return data({ ok: false, error: 'invalid-password' }, { status: 400 });
  if (result.status === 'locked') {
    return data(
      { ok: false, error: 'locked' },
      { status: 423, headers: { 'Retry-After': String(result.retryAfter ?? 60), 'Cache-Control': 'no-store' } },
    );
  }
  if (result.status === 'server-error') return data({ ok: false, error: 'server-error' }, { status: 500 });
  return null;
};

export const stepUpSuccessResponse = (payload: Record<string, unknown>, cookie: string | null) =>
  data(
    { ok: true, ...payload, sessionIssued: cookie !== null },
    { headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } },
  );
