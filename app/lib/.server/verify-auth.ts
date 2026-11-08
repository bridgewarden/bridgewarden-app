import { KEY_BYTES, SALT_BYTES } from '../crypto/contract';
import { decodeBase64 } from '../crypto/encoding';
import { deriveServerAuthHash } from './auth-hash';

const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
};

export const verifyServerAuthHash = async (
  authHash: Uint8Array,
  serverSaltBase64: string,
  pepper: string,
  expectedBase64: string,
): Promise<boolean> => {
  if (authHash.length !== KEY_BYTES) return false;

  try {
    const serverSalt = decodeBase64(serverSaltBase64);
    const expected = decodeBase64(expectedBase64);
    if (serverSalt.length !== SALT_BYTES) return false;

    const derived = await deriveServerAuthHash(authHash, serverSalt, pepper);

    return timingSafeEqual(decodeBase64(derived.authHash), expected);
  } catch {
    return false;
  }
};
