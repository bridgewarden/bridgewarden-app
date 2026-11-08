import { z } from 'zod';

import { parseAuthHash } from '../../../lib/.server/parse-auth-hash';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

const preloginSchema = z.strictObject({ email: emailSchema });
const loginSchema = z.strictObject({
  email: emailSchema,
  authHash: z.string().min(1).max(512),
});

export type PreloginInput = { email: string };

export type LoginInput = {
  email: string;
  authHashBytes: Uint8Array;
};

export const parsePreloginInput = (value: unknown): PreloginInput | null => {
  const parsed = preloginSchema.safeParse(value);

  return parsed.success ? { email: parsed.data.email } : null;
};

export const parseLoginInput = (value: unknown): LoginInput | null => {
  const parsed = loginSchema.safeParse(value);
  if (!parsed.success) return null;

  const authHashBytes = parseAuthHash(parsed.data.authHash);
  return authHashBytes ? { email: parsed.data.email, authHashBytes } : null;
};
