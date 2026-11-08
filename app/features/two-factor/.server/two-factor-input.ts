import { z } from 'zod';

import { parseAuthHash } from '../../../lib/.server/parse-auth-hash';
import { TOTP_CODE_PATTERN } from '../../../lib/totp-code';

const codeSchema = z.strictObject({ code: z.string().regex(TOTP_CODE_PATTERN) });
const disableSchema = z.strictObject({ authHash: z.string().min(1).max(512) });

export type DisableInput = { authHashBytes: Uint8Array };

export const parseCodeInput = (value: unknown): { code: string } | null => {
  const parsed = codeSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
};

export const parseDisableInput = (value: unknown): DisableInput | null => {
  const parsed = disableSchema.safeParse(value);
  if (!parsed.success) return null;

  const authHashBytes = parseAuthHash(parsed.data.authHash);
  return authHashBytes ? { authHashBytes } : null;
};
