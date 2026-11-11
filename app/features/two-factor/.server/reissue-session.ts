import { requireSecret } from '../../../lib/.server/env';
import { fingerprintRequest } from '../../../lib/.server/request-fingerprint';
import { createUsersQueries } from '../../../lib/.server/queries/users';
import { createSession, destroySessionToken, readSessionToken } from '../../../lib/.server/session';

export const reissueSessionAfterFactorChange = async (
  env: Env,
  request: Request,
  userId: string,
): Promise<string | null> => {
  let secret: string;
  try {
    secret = requireSecret(env, 'SESSION_SECRET');
  } catch {
    return null;
  }

  const users = createUsersQueries(env);
  await users.incrementSessionVersion(userId, Date.now());
  const user = await users.findSessionUser(userId);
  if (!user) return null;

  const fingerprints = await fingerprintRequest(request, secret);
  try {
    const previous = readSessionToken(request);
    const session = await createSession(env, {
      userId,
      ver: user.sessionVersion,
      ...fingerprints,
    });
    if (previous) await destroySessionToken(env, previous).catch(() => undefined);
    return session.cookie;
  } catch {
    return null;
  }
};
