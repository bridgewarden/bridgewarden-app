import { data, type RouterContextProvider } from 'react-router';

import { cloudflareContext } from './context';
import { readMutationJson, readMutationOrigin } from './json-action';
import { limitIdentity, limitIp, rateLimited } from './rate-limit';
import type { SessionContext } from './session';

type GuardUser = { id: string; email: string };

export type GuardedMutation<T> =
  { ok: true; env: Env; user: GuardUser; input: T } | { ok: false; response: ReturnType<typeof data> };

type GuardOptions<T> = {
  scope: string;
  authorize: (request: Request, env: Env) => Promise<SessionContext>;
  parseInput?: (value: unknown) => T | null;
};

export const readGuardedMutation = async <T = undefined>(
  request: Request,
  context: Readonly<RouterContextProvider>,
  options: GuardOptions<T>,
): Promise<GuardedMutation<T>> => {
  const { env } = context.get(cloudflareContext);

  const origin = readMutationOrigin(request, env);
  if (!origin.ok) {
    return { ok: false, response: data({ ok: false, error: origin.error }, { status: origin.status }) };
  }

  const ipLimit = await limitIp(env, options.scope, request);
  if (!ipLimit.allowed) return { ok: false, response: rateLimited(ipLimit.retryAfter) };

  let input: T | undefined;
  if (options.parseInput) {
    const mutation = await readMutationJson(request, env);
    if (!mutation.ok) {
      return { ok: false, response: data({ ok: false, error: mutation.error }, { status: mutation.status }) };
    }
    const parsed = options.parseInput(mutation.value);
    if (!parsed) return { ok: false, response: data({ ok: false, error: 'invalid-input' }, { status: 400 }) };
    input = parsed;
  }

  const { user } = await options.authorize(request, env);
  const identityLimit = await limitIdentity(env, options.scope, user.id);
  if (!identityLimit.allowed) return { ok: false, response: rateLimited(identityLimit.retryAfter) };

  return { ok: true, env, user, input: input as T };
};
