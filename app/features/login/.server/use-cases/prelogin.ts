import { standardToBase64Url, toBase64Url } from '../../../../lib/base64-url';
import { DEFAULT_KDF_ITERATIONS, KDF_ALGORITHM, SALT_BYTES } from '../../../../lib/crypto/contract';
import { requireSecret } from '../../../../lib/.server/env';
import { hmacSha256 } from '../../../../lib/.server/hmac';
import { createUsersQueries } from '../../../../lib/.server/queries/users';

export type KdfParameters = {
  kdfAlg: typeof KDF_ALGORITHM;
  kdfSalt: string;
  kdfIterations: number;
};

export type KdfLookupResult = { status: 'ok'; parameters: KdfParameters } | { status: 'server-error' };

export const lookupKdfParameters = async (env: Env, email: string): Promise<KdfLookupResult> => {
  let pepper: string;
  try {
    pepper = requireSecret(env, 'AUTH_PEPPER');
  } catch {
    return { status: 'server-error' };
  }

  const row = await createUsersQueries(env).findKdfByEmail(email);

  if (row) {
    try {
      return {
        status: 'ok',
        parameters: {
          kdfAlg: row.kdf_alg,
          kdfSalt: standardToBase64Url(row.kdf_salt),
          kdfIterations: row.kdf_iterations,
        },
      };
    } catch {
      return { status: 'server-error' };
    }
  }

  const synthetic = (await hmacSha256(pepper, `kdf:${email}`)).slice(0, SALT_BYTES);

  return {
    status: 'ok',
    parameters: {
      kdfAlg: KDF_ALGORITHM,
      kdfSalt: toBase64Url(synthetic),
      kdfIterations: DEFAULT_KDF_ITERATIONS,
    },
  };
};
