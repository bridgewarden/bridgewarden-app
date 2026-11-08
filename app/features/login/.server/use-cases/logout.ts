import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { readConfig } from '../../../../lib/.server/env';
import { fingerprintRequest } from '../../../../lib/.server/request-fingerprint';
import { clearSessionCookie, destroySession, getSession } from '../../../../lib/.server/session';

export type LogoutResult = { hadSession: boolean; cookie: string };

export const logoutCurrentSession = async (env: Env, request: Request): Promise<LogoutResult> => {
  const session = await getSession(env, request);
  await destroySession(env, request);

  if (session) {
    const secret = readConfig(env, 'SESSION_SECRET');
    const fingerprints = secret ? await fingerprintRequest(request, secret) : { uaHash: null, ipHash: null };

    await recordAuditEventSafe(getDatabase(env), {
      type: 'logout',
      userId: session.user.id,
      createdAt: Date.now(),
      ...fingerprints,
    });
  }

  return { hadSession: session !== null, cookie: clearSessionCookie() };
};
