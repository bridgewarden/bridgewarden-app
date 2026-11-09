import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { createUserTwoFactorQueries } from '../../../../lib/.server/queries/user-two-factor';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
import { generateAndStoreBackupCodes } from '../backup-codes';
import type { DisableInput } from '../two-factor-input';

export type RegenerateResult =
  | { status: 'ok'; backupCodes: string[] }
  | { status: 'not-enabled' }
  | { status: 'invalid-password' }
  | { status: 'server-error' };

export const regenerateBackupCodes = async (
  env: Env,
  request: Request,
  userId: string,
  input: DisableInput,
): Promise<RegenerateResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const user = await createUsersQueries(env).findAuthById(userId);
  if (!user || user.status !== 'active') return { status: 'server-error' };
  if (!(await verifyServerAuthHash(input.authHashBytes, user.server_salt, pepper, user.auth_hash))) {
    return { status: 'invalid-password' };
  }

  if (!(await createUserTwoFactorQueries(env).isEnabled(userId))) return { status: 'not-enabled' };

  const backupCodes = await generateAndStoreBackupCodes(env, userId, pepper);
  const fingerprints = await auditFingerprints(env, request);

  await recordAuditEventSafe(env, {
    type: '2fa.backup_codes_regenerated',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok', backupCodes };
};
