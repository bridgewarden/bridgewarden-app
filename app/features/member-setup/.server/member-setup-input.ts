import { z } from 'zod';

import { fromBase64Url } from '../../../lib/base64-url';
import { IV_BYTES, KEY_BYTES, MIN_KDF_ITERATIONS, SALT_BYTES, TAG_BYTES } from '../../../lib/crypto/contract';

const WRAPPED_KEY_BYTES = KEY_BYTES + TAG_BYTES;
const schema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  kdfIterations: z.number().int().min(MIN_KDF_ITERATIONS).max(10_000_000),
  kdfSalt: z.string().min(1).max(512),
  authHash: z.string().min(1).max(512),
  vaultKeyWrapped: z.string().min(1).max(512),
  vaultKeyWrapIv: z.string().min(1).max(512),
  recoveryKeyWrapped: z.string().min(1).max(512),
  recoveryKeyWrapIv: z.string().min(1).max(512),
});

const decode = (value: string, length: number): Uint8Array | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length === length ? bytes : null;
  } catch {
    return null;
  }
};

export type MemberSetupInput = {
  token: string;
  kdfIterations: number;
  kdfSalt: string;
  authHashBytes: Uint8Array;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
  recoveryKeyWrapped: string;
  recoveryKeyWrapIv: string;
};

export const parseMemberSetupInput = (value: unknown): MemberSetupInput | null => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) return null;

  const authHash = decode(parsed.data.authHash, KEY_BYTES);
  const salt = decode(parsed.data.kdfSalt, SALT_BYTES);
  const wrapped = decode(parsed.data.vaultKeyWrapped, WRAPPED_KEY_BYTES);
  const wrapIv = decode(parsed.data.vaultKeyWrapIv, IV_BYTES);
  const recovery = decode(parsed.data.recoveryKeyWrapped, WRAPPED_KEY_BYTES);
  const recoveryIv = decode(parsed.data.recoveryKeyWrapIv, IV_BYTES);
  if (!authHash || !salt || !wrapped || !wrapIv || !recovery || !recoveryIv) return null;

  return {
    token: parsed.data.token,
    kdfIterations: parsed.data.kdfIterations,
    kdfSalt: parsed.data.kdfSalt,
    authHashBytes: authHash,
    vaultKeyWrapped: parsed.data.vaultKeyWrapped,
    vaultKeyWrapIv: parsed.data.vaultKeyWrapIv,
    recoveryKeyWrapped: parsed.data.recoveryKeyWrapped,
    recoveryKeyWrapIv: parsed.data.recoveryKeyWrapIv,
  };
};
