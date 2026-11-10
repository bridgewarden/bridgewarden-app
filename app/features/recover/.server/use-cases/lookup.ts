import { fromBase64Url, storedToBase64Url, toBase64Url } from '../../../../lib/base64-url';
import { recordAuditEventSafe } from '../../../../lib/.server/audit';
import { requireSecret } from '../../../../lib/.server/env';
import { hmacSha256 } from '../../../../lib/.server/hmac';
import { createUsersQueries } from '../../../../lib/.server/queries/users';
import { auditFingerprints } from '../../../../lib/.server/request-fingerprint';

export type RecoveryLookupResult =
  { status: 'ok'; recoveryKeyWrapped: string; recoveryKeyWrapIv: string } | { status: 'server-error' };

const validStored = (value: string, length: number): boolean => {
  try {
    return fromBase64Url(storedToBase64Url(value)).length === length;
  } catch {
    return false;
  }
};

const synthetic = async (pepper: string, email: string) => {
  const first = await hmacSha256(pepper, `recovery-lookup:ct:${email}`);
  const second = await hmacSha256(pepper, `recovery-lookup:ct2:${email}`);
  const iv = await hmacSha256(pepper, `recovery-lookup:iv:${email}`);
  const ciphertext = new Uint8Array(48);
  ciphertext.set(first, 0);
  ciphertext.set(second.slice(0, 16), 32);

  return { recoveryKeyWrapped: toBase64Url(ciphertext), recoveryKeyWrapIv: toBase64Url(iv.slice(0, 12)) };
};

export const lookupRecovery = async (env: Env, request: Request, email: string): Promise<RecoveryLookupResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const row = await createUsersQueries(env).findRecoveryLookup(email);
  if (
    row?.status === 'active' &&
    row.recovery_key_wrapped &&
    row.recovery_key_wrap_iv &&
    validStored(row.recovery_key_wrapped, 48) &&
    validStored(row.recovery_key_wrap_iv, 12)
  ) {
    return {
      status: 'ok',
      recoveryKeyWrapped: storedToBase64Url(row.recovery_key_wrapped),
      recoveryKeyWrapIv: storedToBase64Url(row.recovery_key_wrap_iv),
    };
  }

  await recordAuditEventSafe(env, {
    type: 'recovery.lookup_failed',
    userId: row?.id ?? null,
    createdAt: Date.now(),
    ...(await auditFingerprints(env, request)),
  });

  return { status: 'ok', ...(await synthetic(pepper, email)) };
};
