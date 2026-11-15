import type { MessageKey } from '~/lib/i18n/en';

import type { SetupError } from './setup.types';

export const SETUP_STEPS = ['account', 'password', 'recovery', 'two-factor'] as const;
export type SetupFormStep = (typeof SETUP_STEPS)[number];
export type SetupStep = SetupFormStep | 'submitting' | 'configured' | 'done';

export const ERROR_KEY: Record<SetupError, MessageKey> = {
  forbidden: 'setup.error.forbidden',
  'invalid-input': 'setup.error.invalidInput',
  'already-configured': 'setup.error.alreadyConfigured',
  'server-error': 'setup.error.serverError',
  'rate-limited': 'setup.error.rateLimited',
  network: 'setup.error.network',
};
