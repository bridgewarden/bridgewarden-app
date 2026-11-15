import type { MessageKey } from '~/lib/i18n/en';

export const MIN_MASTER_PASSWORD_LENGTH = 12;

export const PASSWORD_STRENGTH_KEYS: MessageKey[] = [
  'password.strength.weak',
  'password.strength.weak',
  'password.strength.fair',
  'password.strength.good',
  'password.strength.strong',
];

export const PASSWORD_STRENGTH_WIDTH = ['w-0', 'w-1/4', 'w-1/2', 'w-3/4', 'w-full'] as const;

export const passwordScore = (password: string): number => {
  if (!password) return 0;

  return [
    password.length >= MIN_MASTER_PASSWORD_LENGTH,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
};

export const isMasterPasswordAcceptable = (password: string): boolean => password.length >= MIN_MASTER_PASSWORD_LENGTH;
