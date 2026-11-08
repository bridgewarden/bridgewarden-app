import { getSession, type SessionContext } from './session';

const cache = new WeakMap<Request, Promise<SessionContext | null>>();

export const getSessionCached = (env: Env, request: Request): Promise<SessionContext | null> => {
  const cached = cache.get(request);
  if (cached) return cached;

  const resolution = getSession(env, request);
  cache.set(request, resolution);

  return resolution;
};
