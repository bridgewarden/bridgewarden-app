import { z } from 'zod';

import { fromBase64Url } from '../../../lib/base64-url';
import { IV_BYTES, KEY_BYTES, MIN_KDF_ITERATIONS, SALT_BYTES, TAG_BYTES } from '../../../lib/crypto/contract';
import { encodeBase64 } from '../../../lib/crypto/encoding';

const WRAPPED_KEY_BYTES = KEY_BYTES + TAG_BYTES;
const MAX_KDF_ITERATIONS = 10_000_000;

const base64UrlField = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);

const setupSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  displayName: z.string().trim().min(1).max(100),
  kdfIterations: z.number().int().min(MIN_KDF_ITERATIONS).max(MAX_KDF_ITERATIONS),
  kdfSalt: base64UrlField,
  authHash: base64UrlField,
  vaultKeyWrapped: base64UrlField,
  vaultKeyWrapIv: base64UrlField,
  recoveryKeyWrapped: base64UrlField,
  recoveryKeyWrapIv: base64UrlField,
});

export type SetupInput = {
  email: string;
  displayName: string;
  kdfIterations: number;
  kdfSalt: string;
  authHashBytes: Uint8Array;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
};

const decodeField = (value: string, expectedLength: number): Uint8Array | null => {
  try {
    const bytes = fromBase64Url(value);

    return bytes.length === expectedLength ? bytes : null;
  } catch {
    return null;
  }
};

export const parseSetupInput = (value: unknown): SetupInput | null => {
  const parsed = setupSchema.safeParse(value);
  if (!parsed.success) return null;

  const { email, displayName, kdfIterations } = parsed.data;
  const kdfSalt = decodeField(parsed.data.kdfSalt, SALT_BYTES);
  const authHash = decodeField(parsed.data.authHash, KEY_BYTES);
  const vaultKeyWrapped = decodeField(parsed.data.vaultKeyWrapped, WRAPPED_KEY_BYTES);
  const vaultKeyWrapIv = decodeField(parsed.data.vaultKeyWrapIv, IV_BYTES);
  const recoveryKeyWrapped = decodeField(parsed.data.recoveryKeyWrapped, WRAPPED_KEY_BYTES);
  const recoveryKeyWrapIv = decodeField(parsed.data.recoveryKeyWrapIv, IV_BYTES);

  if (!kdfSalt || !authHash || !vaultKeyWrapped || !vaultKeyWrapIv || !recoveryKeyWrapped || !recoveryKeyWrapIv) {
    return null;
  }

  return {
    email,
    displayName,
    kdfIterations,
    kdfSalt: encodeBase64(kdfSalt),
    authHashBytes: authHash,
    vaultKeyWrapped: encodeBase64(vaultKeyWrapped),
    vaultKeyWrapIv: encodeBase64(vaultKeyWrapIv),
    recoveryKeyWrapped: encodeBase64(recoveryKeyWrapped),
    recoveryKeyWrapIv: encodeBase64(recoveryKeyWrapIv),
  };
};
