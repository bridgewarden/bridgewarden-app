import type { MessageKey } from '~/lib/i18n/en';

export type MemberSetupError =
  | 'password'
  | 'mismatch'
  | 'recovery'
  | 'server'
  | 'invalid'
  | 'conflict'
  | 'rate-limited'
  | 'server-error'
  | 'forbidden'
  | 'invalid-input';

export const MEMBER_SETUP_ERROR_KEY: Record<MemberSetupError, MessageKey> = {
  password: 'memberSetup.error.password',
  mismatch: 'memberSetup.error.mismatch',
  recovery: 'memberSetup.error.recovery',
  server: 'memberSetup.error.server',
  invalid: 'memberSetup.error.invalid',
  conflict: 'memberSetup.error.conflict',
  'rate-limited': 'memberSetup.error.rate-limited',
  'server-error': 'memberSetup.error.server-error',
  forbidden: 'memberSetup.error.forbidden',
  'invalid-input': 'memberSetup.error.invalid-input',
};
