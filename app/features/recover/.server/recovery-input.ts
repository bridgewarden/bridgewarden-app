import { z } from 'zod';

import { fromBase64Url } from '../../../lib/base64-url';
import { IV_BYTES, KEY_BYTES, MIN_KDF_ITERATIONS, SALT_BYTES, TAG_BYTES } from '../../../lib/crypto/contract';
import { encodeBase64 } from '../../../lib/crypto/encoding';

const WRAPPED_BYTES = KEY_BYTES + TAG_BYTES;
const MAX_KDF_ITERATIONS = 10_000_000;
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));
const field = z.string().min(1).max(512);
const lookupSchema = z.strictObject({ email: emailSchema });
const resetSchema = z.strictObject({
  email: emailSchema,
  currentRecoveryAuthKey: field,
  authHash: field,
  kdfSalt: field,
  kdfIterations: z.number().int().min(MIN_KDF_ITERATIONS).max(MAX_KDF_ITERATIONS),
  vaultKeyWrapped: field,
  vaultKeyWrapIv: field,
  recoveryKeyWrapped: field,
  recoveryKeyWrapIv: field,
  recoveryAuthKey: field,
});

const decode = (value: string, length: number): Uint8Array | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length === length ? bytes : null;
  } catch {
    return null;
  }
};

export type RecoveryLookupInput = { email: string };

export type RecoveryResetInput = {
  email: string;
  currentRecoveryAuthKeyBytes: Uint8Array;
  authHashBytes: Uint8Array;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
  recoveryAuthKeyBytes: Uint8Array;
};

export const parseRecoveryLookupInput = (value: unknown): RecoveryLookupInput | null => {
  const parsed = lookupSchema.safeParse(value);
  return parsed.success ? { email: parsed.data.email } : null;
};

export const parseRecoveryResetInput = (value: unknown): RecoveryResetInput | null => {
  const parsed = resetSchema.safeParse(value);
  if (!parsed.success) return null;

  const currentProof = decode(parsed.data.currentRecoveryAuthKey, KEY_BYTES);
  const authHash = decode(parsed.data.authHash, KEY_BYTES);
  const salt = decode(parsed.data.kdfSalt, SALT_BYTES);
  const vault = decode(parsed.data.vaultKeyWrapped, WRAPPED_BYTES);
  const vaultIv = decode(parsed.data.vaultKeyWrapIv, IV_BYTES);
  const recovery = decode(parsed.data.recoveryKeyWrapped, WRAPPED_BYTES);
  const recoveryIv = decode(parsed.data.recoveryKeyWrapIv, IV_BYTES);
  const newProof = decode(parsed.data.recoveryAuthKey, KEY_BYTES);
  if (!currentProof || !authHash || !salt || !vault || !vaultIv || !recovery || !recoveryIv || !newProof) return null;

  return {
    email: parsed.data.email,
    currentRecoveryAuthKeyBytes: currentProof,
    authHashBytes: authHash,
    kdfSalt: encodeBase64(salt),
    kdfIterations: parsed.data.kdfIterations,
    vaultKeyWrapped: encodeBase64(vault),
    vaultKeyWrapIv: encodeBase64(vaultIv),
    recoveryKeyWrapped: encodeBase64(recovery),
    recoveryKeyWrapIv: encodeBase64(recoveryIv),
    recoveryAuthKeyBytes: newProof,
  };
};
