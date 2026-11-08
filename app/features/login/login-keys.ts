import { base64UrlToStandard, toBase64Url } from '../../lib/base64-url';
import { deriveAuthHash, deriveMasterKey, deriveWrapKey } from '../../lib/crypto/kdf';
import { unwrapVaultKey } from '../../lib/crypto/vault-key';

export type PreparedLogin = {
  authHash: string;
  wrapKey: Uint8Array;
};

export const prepareLogin = async (
  password: string,
  kdfSaltTransport: string,
  iterations: number,
): Promise<PreparedLogin> => {
  const kdfSalt = base64UrlToStandard(kdfSaltTransport);
  const masterKey = await deriveMasterKey(password, kdfSalt, iterations);
  const authHash = await deriveAuthHash(masterKey);
  const wrapKey = await deriveWrapKey(masterKey, kdfSalt);
  masterKey.fill(0);

  return { authHash: toBase64Url(authHash), wrapKey };
};

export const unwrapLoginVault = async (
  wrappedTransport: string,
  ivTransport: string,
  wrapKey: Uint8Array,
): Promise<Uint8Array> =>
  unwrapVaultKey(
    {
      ciphertext: base64UrlToStandard(wrappedTransport),
      iv: base64UrlToStandard(ivTransport),
    },
    wrapKey,
  );
