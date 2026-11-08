import { KEY_BYTES, SALT_BYTES } from '../crypto/contract';
import { encodeBase64 } from '../crypto/encoding';
import { InvalidKeyMaterialError } from '../crypto/errors';
import { hmacSha256 } from './hmac';

const concat = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
};

export type ServerAuthHash = {
  authHash: string;
  serverSalt: string;
};

export const generateServerSalt = (): Uint8Array => crypto.getRandomValues(new Uint8Array(SALT_BYTES));

export const deriveServerAuthHash = async (
  authHash: Uint8Array,
  serverSalt: Uint8Array,
  pepper: string,
): Promise<ServerAuthHash> => {
  if (authHash.length !== KEY_BYTES || serverSalt.length !== SALT_BYTES) {
    throw new InvalidKeyMaterialError();
  }

  const signature = await hmacSha256(pepper, concat(authHash, serverSalt));

  return { authHash: encodeBase64(signature), serverSalt: encodeBase64(serverSalt) };
};
