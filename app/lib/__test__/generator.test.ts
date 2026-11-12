import { describe, expect, it } from 'vitest';

import { generatePassphrase, generatePassword, type PasswordOptions, strengthForEntropy } from '../generator';
import { PASSPHRASE_WORDS } from '../passphrase-words';

const options = (overrides: Partial<PasswordOptions> = {}): PasswordOptions => ({
  mode: 'password',
  length: 16,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
  ...overrides,
});

describe('password generator', () => {
  it('uses the 1,296-word lowercase EFF short list', () => {
    expect(PASSPHRASE_WORDS).toHaveLength(1296);
    expect(PASSPHRASE_WORDS.every((word) => word === word.toLowerCase())).toBe(true);
  });

  it('enforces length, enabled sets, and ambiguous characters', () => {
    const generated = generatePassword(options({ length: 32, symbols: false, excludeAmbiguous: true }));
    expect(generated.value).toHaveLength(32);
    expect(generated.value).toMatch(/[A-Z]/);
    expect(generated.value).toMatch(/[a-z]/);
    expect(generated.value).toMatch(/[0-9]/);
    expect(generated.value).not.toMatch(/[^A-Za-z0-9]/);
    expect(generated.value).not.toMatch(/[Il1O0o]/);
  });

  it('rejects no sets and out-of-range lengths', () => {
    expect(() =>
      generatePassword(options({ uppercase: false, lowercase: false, digits: false, symbols: false })),
    ).toThrow();
    expect(() => generatePassword(options({ length: 7 }))).toThrow();
    expect(() => generatePassword(options({ length: 65 }))).toThrow();
  });

  it('keeps every enabled set represented over many samples', () => {
    for (let index = 0; index < 10_000; index += 1) {
      const value = generatePassword(options({ length: 8 })).value;
      expect(value).toMatch(/[A-Z]/);
      expect(value).toMatch(/[a-z]/);
      expect(value).toMatch(/[0-9]/);
      expect(value).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('maps entropy boundaries', () => {
    expect(strengthForEntropy(39.99)).toBe('weak');
    expect(strengthForEntropy(40)).toBe('fair');
    expect(strengthForEntropy(59.99)).toBe('fair');
    expect(strengthForEntropy(60)).toBe('strong');
    expect(strengthForEntropy(79.99)).toBe('strong');
    expect(strengthForEntropy(80)).toBe('very-strong');
  });
});

describe('passphrase generator', () => {
  it('generates the requested word count and separator', () => {
    const generated = generatePassphrase({ mode: 'passphrase', words: 6, separator: '-', capitalize: true });
    expect(generated.value.split('-')).toHaveLength(6);
    expect(generated.value.split('-').every((word) => /^[A-Z]/.test(word))).toBe(true);
    expect(generated.entropyBits).toBeCloseTo(6 * Math.log2(PASSPHRASE_WORDS.length));
  });

  it('rejects out-of-range word counts', () => {
    expect(() => generatePassphrase({ mode: 'passphrase', words: 2, separator: '-', capitalize: false })).toThrow();
    expect(() => generatePassphrase({ mode: 'passphrase', words: 7, separator: '-', capitalize: false })).toThrow();
  });
});
