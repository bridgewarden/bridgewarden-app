import { describe, expect, it } from 'vitest';

import { parseTheme, readThemeCookie, serializeTheme, themeClassName } from '../theme';

describe('theme preference', () => {
  it('accepts each valid value', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('system')).toBe('system');
  });

  it('falls back to system for an invalid or missing value', () => {
    expect(parseTheme('neon')).toBe('system');
    expect(parseTheme('')).toBe('system');
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme(undefined)).toBe('system');
  });

  it('reads the value from a cookie header', () => {
    expect(readThemeCookie('a=1; bw_theme=dark; b=2')).toBe('dark');
    expect(readThemeCookie('bw_theme=light')).toBe('light');
    expect(readThemeCookie('a=1')).toBe('system');
    expect(readThemeCookie(null)).toBe('system');
  });

  it('does not throw or crash on a malformed cookie value', () => {
    expect(() => readThemeCookie('bw_theme=%E0%A4%A')).not.toThrow();
    expect(readThemeCookie('bw_theme=%E0%A4%A')).toBe('system');
    expect(readThemeCookie('bw_theme=%')).toBe('system');
    expect(readThemeCookie('bw_theme')).toBe('system');
  });

  it('round-trips the serialized cookie', () => {
    expect(readThemeCookie(serializeTheme('dark'))).toBe('dark');
    expect(readThemeCookie(serializeTheme('light'))).toBe('light');
  });

  it('maps the theme to an html class', () => {
    expect(themeClassName('dark')).toBe('dark');
    expect(themeClassName('light')).toBe('light');
    expect(themeClassName('system')).toBeUndefined();
  });

  it('serializes a cookie with path, age, same-site, and optional secure', () => {
    const cookie = serializeTheme('dark');

    expect(cookie).toContain('bw_theme=dark');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=');
    expect(cookie).not.toContain('Secure');
    expect(serializeTheme('dark', { secure: true })).toContain('; Secure');
  });
});
