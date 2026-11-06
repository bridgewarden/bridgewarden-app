import { describe, expect, it } from 'vitest';

import { en, t, translate } from '../en';

describe('copy catalog', () => {
  it('resolves a known key', () => {
    expect(translate(en, 'app.name')).toBe('Bridgewarden');
  });

  it('interpolates named parameters', () => {
    expect(translate(en, 'vault.greeting', { name: 'Alfian' })).toBe('Welcome, Alfian.');
  });

  it('selects the plural form from count', () => {
    expect(translate(en, 'vault.count', { count: 1 })).toBe('1 item');
    expect(translate(en, 'vault.count', { count: 3 })).toBe('3 items');
  });

  it('exposes plural bases through the typed lookup', () => {
    expect(t('vault.count', { count: 1 })).toBe('1 item');
    expect(t('vault.count', { count: 4 })).toBe('4 items');
    expect(t('common.close')).toBe('Close');
  });

  it('throws in strict mode for a missing key', () => {
    expect(() => translate(en, 'missing.key', {}, true)).toThrow('Missing translation key: missing.key');
  });

  it('returns the key in non-strict mode for a missing key', () => {
    expect(translate(en, 'missing.key')).toBe('missing.key');
  });
});
