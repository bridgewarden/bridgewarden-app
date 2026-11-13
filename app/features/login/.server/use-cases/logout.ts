import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { clearSessionCookie, destroySession, getSession } from '../../../../lib/.server/session';

export type LogoutResult = { hadSession: boolean; cookie: string };

export const logoutCurrentSession = async (env: Env, request: Request): Promise<LogoutResult> => {
  const session = await getSession(env, request);
  await destroySession(env, request);

  if (session) {
    await recordAuditEventSafe(env, {
      type: 'logout',
      userId: session.user.id,
      createdAt: Date.now(),
      ...(await auditFingerprints(env, request)),
    });
  }

  return { hadSession: session !== null, cookie: clearSessionCookie() };
};
