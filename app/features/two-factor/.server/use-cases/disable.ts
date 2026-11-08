import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { getDatabase } from '../../../../lib/.server/db';
import { requireSecret } from '../../../../lib/.server/env';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';
import { verifyServerAuthHash } from '../../../../lib/.server/verify-auth';
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

  const db = getDatabase(env);
  const row = await db
    .prepare('SELECT auth_hash, server_salt, status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ auth_hash: string; server_salt: string; status: 'active' | 'disabled' }>();

  if (!row || row.status !== 'active') return { status: 'server-error' };

  const verified = await verifyServerAuthHash(input.authHashBytes, row.server_salt, pepper, row.auth_hash);
  const fingerprints = await auditFingerprints(env, request);

  if (!verified) {
    await recordAuditEventSafe(db, {
      type: '2fa.disable_failed',
      userId,
      createdAt: Date.now(),
      ...fingerprints,
    });
    return { status: 'invalid-password' };
  }

  await db.batch([
    db.prepare('DELETE FROM user_2fa WHERE user_id = ?').bind(userId),
    db.prepare('DELETE FROM backup_codes WHERE user_id = ?').bind(userId),
  ]);

  await recordAuditEventSafe(db, {
    type: '2fa.disabled',
    userId,
    createdAt: Date.now(),
    ...fingerprints,
  });

  return { status: 'ok' };
};
