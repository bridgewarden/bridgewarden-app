import { redirect } from 'react-router';

import { safeNextPath } from '../next-path';
import { data } from 'react-router';

import { getSessionCached } from './session-cache';
import type { SessionContext } from './session';

export const requireUser = async (request: Request, env: Env): Promise<SessionContext> => {
  const context = await getSessionCached(env, request);
  if (context) return context;

  const url = new URL(request.url);
  const next = safeNextPath(`${url.pathname}${url.search}`);

  throw redirect(`/login?next=${encodeURIComponent(next)}`);
};

export const requireUserApi = async (request: Request, env: Env): Promise<SessionContext> => {
  const context = await getSessionCached(env, request);
  if (!context) {
    throw data({ error: 'unauthorized' }, { status: 401 });
  }

  return context;
};

export const requireAdmin = async (request: Request, env: Env): Promise<SessionContext> => {
  const context = await requireUser(request, env);
  if (context.user.role !== 'admin') throw data({ error: 'forbidden' }, { status: 403 });
  return context;
};

export const requireAdminApi = async (request: Request, env: Env): Promise<SessionContext> => {
  const context = await requireUserApi(request, env);
  if (context.user.role !== 'admin') throw data({ error: 'forbidden' }, { status: 403 });
  return context;
};
