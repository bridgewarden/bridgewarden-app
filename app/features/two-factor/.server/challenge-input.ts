import { z } from 'zod';

import { CHALLENGE_TOKEN_PATTERN } from '../../../lib/.server/challenge';
import { TOTP_CODE_PATTERN } from '../../../lib/totp-code';

const schema = z
  .strictObject({
    challengeToken: z.string().regex(CHALLENGE_TOKEN_PATTERN),
    code: z.string().regex(TOTP_CODE_PATTERN).optional(),
    backupCode: z.string().min(1).max(32).optional(),
  })
  .refine((value) => Boolean(value.code) !== Boolean(value.backupCode));

export type ChallengeInput = {
  challengeToken: string;
  code?: string;
  backupCode?: string;
};

export const parseChallengeInput = (value: unknown): ChallengeInput | null => {
  const parsed = schema.safeParse(value);

  return parsed.success ? parsed.data : null;
};
