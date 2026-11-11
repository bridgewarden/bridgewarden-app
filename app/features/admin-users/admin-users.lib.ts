import { t, type MessageKey } from '~/lib/i18n/en';

const ERROR_KEYS: Record<string, MessageKey> = {
  'user-exists': 'adminUsers.error.userExists',
  conflict: 'adminUsers.error.conflict',
  'last-admin': 'adminUsers.error.lastAdmin',
  'not-found': 'adminUsers.error.notFound',
  'invalid-input': 'adminUsers.error.invalidInput',
  forbidden: 'adminUsers.error.forbidden',
  self: 'adminUsers.error.self',
  'rate-limited': 'adminUsers.error.rateLimited',
  'server-error': 'adminUsers.error.serverError',
};

export const adminErrorMessage = (code: string) => t(ERROR_KEYS[code] ?? 'adminUsers.error.serverError');
