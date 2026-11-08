export const en = {
  'app.name': 'Bridgewarden',
  'app.tagline': 'Zero-knowledge password manager for personal and family use, deployed on Cloudflare.',

  'common.signIn': 'Sign in',
  'common.lock': 'Lock vault',
  'common.theme': 'Theme',
  'common.theme.light': 'Light',
  'common.theme.dark': 'Dark',
  'common.theme.system': 'System',
  'common.close': 'Close',

  'home.notice': 'Setup and vault features arrive in the next milestones.',

  'login.title': 'Sign in',
  'login.description': 'Unlock your vault with your master password.',

  'setup.title': 'Set up Bridgewarden',
  'setup.description': 'Create the first administrator account and your vault keys.',
  'setup.step': 'Step {current} of {total}',

  'setup.account.heading': 'Administrator account',
  'setup.account.description': 'This account is the only one that can exist before setup completes.',
  'setup.account.email': 'Email',
  'setup.account.displayName': 'Display name',
  'setup.account.continue': 'Continue',
  'setup.account.invalid': 'Enter a valid email and display name.',

  'setup.password.heading': 'Master password',
  'setup.password.description': 'At least 12 characters. It never leaves this browser.',
  'setup.password.label': 'Master password',
  'setup.password.confirmLabel': 'Confirm master password',
  'setup.password.hint': 'Use at least 12 characters.',
  'setup.password.mismatch': 'The passwords do not match.',
  'setup.password.strength': 'Password strength',
  'setup.password.strength.weak': 'Weak',
  'setup.password.strength.fair': 'Fair',
  'setup.password.strength.good': 'Good',
  'setup.password.strength.strong': 'Strong',
  'setup.password.generating': 'Deriving keys…',
  'setup.password.continue': 'Create keys',

  'setup.recovery.heading': 'Save your recovery key',
  'setup.recovery.description':
    'This key is shown once. Store it offline; it is the only way back into your vault without your master password.',
  'setup.recovery.label': 'Recovery key',
  'setup.recovery.confirmLabel': 'Type the first 6 characters',
  'setup.recovery.confirmHint': 'Case-insensitive; separators are ignored.',
  'setup.recovery.mismatch': 'Those characters do not match the recovery key.',
  'setup.recovery.copy': 'Copy',
  'setup.recovery.copied': 'Copied to clipboard. Clear it when you are done.',
  'setup.recovery.copyFailed': 'Copy failed. Select the key manually.',
  'setup.recovery.download': 'Download recovery key',
  'setup.recovery.downloaded': 'Recovery key file downloaded.',
  'setup.recovery.downloadFailed': 'Download failed. Try again or copy the key.',
  'setup.recovery.fileTitle': 'Bridgewarden recovery key',
  'setup.recovery.fileWarning': 'Store this file offline. Anyone with this key can recover your vault.',
  'setup.recovery.continue': 'Confirm recovery key',

  'setup.twoFactor.heading': 'Two-factor authentication',
  'setup.twoFactor.description': 'Two-factor enrollment arrives with a later milestone.',
  'setup.twoFactor.warning': 'Skipping two-factor leaves your vault protected by the master password only.',
  'setup.twoFactor.enrollLater':
    'Enrollment is not available in this milestone. You can enable it later from account settings.',
  'setup.twoFactor.continue': 'Finish setup',

  'setup.submitting': 'Creating your administrator account…',
  'setup.done.heading': 'Setup complete',
  'setup.done.description': 'Your vault is ready.',

  'setup.error.forbidden': 'This origin is not allowed for setup. Check APP_ORIGIN and reload.',
  'setup.error.invalidInput': 'Check the account details and try again.',
  'setup.error.alreadyConfigured': 'This deployment already has an administrator. Redirecting to sign in…',
  'setup.error.serverError': 'Setup could not complete. Try again.',
  'setup.error.network': 'The network request failed. Your keys are still in memory; retry when ready.',
  'setup.retry': 'Retry',
  'setup.back': 'Back',

  'setup.leave.title': 'Leave setup?',
  'setup.leave.description': 'Your generated keys exist only in memory and will be lost.',
  'setup.leave.stay': 'Stay',
  'setup.leave.leave': 'Leave setup',

  'vault.title': 'Vault',
  'vault.description': 'Your login items and secure notes will appear here after unlock.',
  'vault.greeting': 'Welcome, {name}.',
  'vault.count': '{count} items',
  'vault.count.one': '{count} item',
  'vault.count.other': '{count} items',

  'trash.title': 'Trash',
  'trash.description': 'Items deleted in the last 30 days can be restored from here.',

  'errors.title': 'Something went wrong',
  'errors.notFound.title': 'Page not found',
  'errors.notFound.description': 'The requested page could not be found.',
  'errors.generic.description': 'An unexpected error occurred.',
} as const;

export type MessageKey = Exclude<keyof typeof en, `${string}.one` | `${string}.other`>;

export type MessageParams = Record<string, string | number>;

export type Catalog = Record<string, string>;

const interpolate = (template: string, params: MessageParams): string =>
  template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));

export const translate = (catalog: Catalog, key: string, params: MessageParams = {}, strict = false): string => {
  const pluralKey = typeof params.count === 'number' ? `${key}.${params.count === 1 ? 'one' : 'other'}` : key;
  const template = catalog[pluralKey] ?? catalog[key];

  if (!template) {
    if (strict) {
      throw new Error(`Missing translation key: ${key}`);
    }

    return key;
  }

  return interpolate(template, params);
};

export const t = (key: MessageKey, params: MessageParams = {}): string =>
  translate(en, key, params, import.meta.env.DEV);
