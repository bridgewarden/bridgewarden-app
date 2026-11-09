import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import { createTwoFactorQueries } from '../queries/two-factor';
import type { DisableInput } from '../two-factor-input';

export type DisableResult = { status: 'ok' } | { status: 'invalid-password' } | { status: 'server-error' };

export const disableTwoFactor = async (
  env: Env,
  request: Request,
  userId: string,
  input: DisableInput,
): Promise<DisableResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const row = await createUsersQueries(env).findAuthById(userId);
  if (!row || row.status !== 'active') return { status: 'server-error' };

  const verified = await verifyServerAuthHash(input.authHashBytes, row.server_salt, pepper, row.auth_hash);
  const fingerprints = await auditFingerprints(env, request);

  if (!verified) {
    await recordAuditEventSafe(env, {
      type: '2fa.disable_failed',
      userId,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid-password' };
  }

  await createTwoFactorQueries(env).deleteAll(userId);
  await recordAuditEventSafe(env, { type: '2fa.disabled', userId, createdAt: Date.now(), ...fingerprints });
  return { status: 'ok' };
};
