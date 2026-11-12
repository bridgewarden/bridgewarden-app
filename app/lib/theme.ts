export const THEME_COOKIE = 'bw_theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = 'light' | 'dark' | 'system';

export const DEFAULT_THEME: Theme = 'system';

export const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark' || value === 'system';

export const parseTheme = (value: string | null | undefined): Theme => (isTheme(value) ? value : DEFAULT_THEME);

export const themeClassName = (theme: Theme): 'light' | 'dark' | undefined => (theme === 'system' ? undefined : theme);

type ThemeCookieOptions = { secure?: boolean };

export const serializeTheme = (theme: Theme, options: ThemeCookieOptions = {}): string =>
  `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${options.secure ? '; Secure' : ''}`;

export const readThemeCookie = (cookieHeader: string | null | undefined): Theme => {
  if (!cookieHeader) return DEFAULT_THEME;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName !== THEME_COOKIE) continue;

    return parseTheme(rest.join('='));
  }

  return DEFAULT_THEME;
};

export const PWA_THEME_COLOR = '#18181b';
