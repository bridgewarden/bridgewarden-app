import { readConfig } from './env';
import { readJsonBody } from './request-body';
import { isSameOrigin } from './request-origin';

export type MutationJson =
  { ok: true; value: unknown } | { ok: false; status: number; error: 'forbidden' | 'invalid-input' };

export type MutationOrigin = { ok: true } | { ok: false; status: 403; error: 'forbidden' };

export const readMutationOrigin = (request: Request, env: Env): MutationOrigin =>
  isSameOrigin(request, readConfig(env, 'APP_ORIGIN'), readConfig(env, 'APP_ENV') === 'development')
    ? { ok: true }
    : { ok: false, status: 403, error: 'forbidden' };

export const readMutationJson = async (request: Request, env: Env): Promise<MutationJson> => {
  const origin = readMutationOrigin(request, env);
  if (!origin.ok) return origin;

  const body = await readJsonBody(request);
  if (!body.ok) {
    return {
      ok: false,
      status: body.reason === 'too-large' ? 413 : body.reason === 'unsupported' ? 415 : 400,
      error: 'invalid-input',
    };
  }

  return { ok: true, value: body.value };
};
