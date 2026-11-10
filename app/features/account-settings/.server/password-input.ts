import { z } from 'zod';

import { fromBase64Url } from '../../../lib/base64-url';
import { IV_BYTES, KEY_BYTES, MIN_KDF_ITERATIONS, SALT_BYTES, TAG_BYTES } from '../../../lib/crypto/contract';

const WRAPPED_BYTES = KEY_BYTES + TAG_BYTES;
const schema = z.strictObject({
  currentAuthHash: z.string().min(1).max(512),
  authHash: z.string().min(1).max(512),
  kdfSalt: z.string().min(1).max(512),
  kdfIterations: z.number().int().min(MIN_KDF_ITERATIONS).max(10_000_000),
  vaultKeyWrapped: z.string().min(1).max(512),
  vaultKeyWrapIv: z.string().min(1).max(512),
});

const decode = (value: string, length: number): Uint8Array | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length === length ? bytes : null;
  } catch {
    return null;
  }
};

export type PasswordChangeInput = {
  currentAuthHashBytes: Uint8Array;
  authHashBytes: Uint8Array;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export const parsePasswordChangeInput = (value: unknown): PasswordChangeInput | null => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;

  const current = decode(parsed.data.currentAuthHash, KEY_BYTES);
  const next = decode(parsed.data.authHash, KEY_BYTES);
  const salt = decode(parsed.data.kdfSalt, SALT_BYTES);
  const wrapped = decode(parsed.data.vaultKeyWrapped, WRAPPED_BYTES);
  const iv = decode(parsed.data.vaultKeyWrapIv, IV_BYTES);
  if (!current || !next || !salt || !wrapped || !iv) return null;

  return {
    currentAuthHashBytes: current,
    authHashBytes: next,
    kdfSalt: parsed.data.kdfSalt,
    kdfIterations: parsed.data.kdfIterations,
    vaultKeyWrapped: parsed.data.vaultKeyWrapped,
    vaultKeyWrapIv: parsed.data.vaultKeyWrapIv,
  };
};
