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
