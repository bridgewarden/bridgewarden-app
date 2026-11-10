import { storedToBase64Url } from '../../../../lib/base64-url';
import { createUsersQueries } from '../../../../lib/.server/queries/users';

export type PasswordKdf = { kdfSalt: string; kdfIterations: number };

export const getPasswordKdf = async (env: Env, userId: string): Promise<PasswordKdf | null> => {
  const row = await createUsersQueries(env).findPasswordKdf(userId);
  if (!row) return null;

  return { kdfSalt: storedToBase64Url(row.kdf_salt), kdfIterations: row.kdf_iterations };
};
