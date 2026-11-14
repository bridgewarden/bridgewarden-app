import { redirect } from 'react-router';

import { SETUP_STATE_KEY, SETUP_STATE_TTL_SECONDS } from '../../constants/setup-state';
import { createUsersQueries } from './queries/users';

const readConfigured = async (env: Env): Promise<boolean> => {
  let cached: string | null = null;
  try {
    cached = await env.KV_SESSIONS.get(SETUP_STATE_KEY);
  } catch {
    // The database count remains authoritative when KV is unavailable.
  }
  if (cached === '1') return true;
  if (cached === '0') return false;
  const configured = (await createUsersQueries(env).count()) !== 0;
  await env.KV_SESSIONS.put(SETUP_STATE_KEY, configured ? '1' : '0', {
    expirationTtl: SETUP_STATE_TTL_SECONDS,
  }).catch(() => undefined);
  return configured;
};

export const invalidateSetupState = (env: Env): Promise<void> =>
  env.KV_SESSIONS.delete(SETUP_STATE_KEY).catch(() => undefined);

export const requireConfigured = async (env: Env): Promise<void> => {
  if (!(await readConfigured(env))) {
    throw redirect('/setup');
  }
};

export const requireBootstrapAvailable = async (env: Env): Promise<void> => {
  if (await readConfigured(env)) {
    throw redirect('/login');
  }
};
