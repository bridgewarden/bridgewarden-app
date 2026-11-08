import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
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

  const db = getDatabase(env);
  const user = await db
    .prepare('SELECT auth_hash, server_salt, status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ auth_hash: string; server_salt: string; status: 'active' | 'disabled' }>();

  if (!user || user.status !== 'active') return { status: 'server-error' };
  if (!(await verifyServerAuthHash(input.authHashBytes, user.server_salt, pepper, user.auth_hash))) {
    return { status: 'invalid-password' };
  }

  const row = await db
    .prepare('SELECT enabled FROM user_2fa WHERE user_id = ?')
    .bind(userId)
    .first<{ enabled: number }>();

  if (row?.enabled !== 1) return { status: 'not-enabled' };

  const backupCodes = await generateAndStoreBackupCodes(db, userId, pepper);
  const fingerprints = await auditFingerprints(env, request);

  await recordAuditEventSafe(db, {
    type: '2fa.backup_codes_regenerated',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok', backupCodes };
};
