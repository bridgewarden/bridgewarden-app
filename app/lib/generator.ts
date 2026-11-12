import { PASSPHRASE_WORDS } from './passphrase-words';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSPHRASE_MIN_WORDS = 3;
export const PASSPHRASE_MAX_WORDS = 6;

export type Separator = '-' | '.' | '_' | ' ';

export type PasswordOptions = {
  mode: 'password';
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
};

export type PassphraseOptions = {
  mode: 'passphrase';
  words: number;
  separator: Separator;
  capitalize: boolean;
};

export type GeneratorOptions = PasswordOptions | PassphraseOptions;

export type GeneratorPreferences = {
  mode: GeneratorOptions['mode'];
  password: PasswordOptions;
  passphrase: PassphraseOptions;
};

export type Strength = 'weak' | 'fair' | 'strong' | 'very-strong';

export type GeneratorResult = {
  value: string;
  entropyBits: number;
  strength: Strength;
};

export class GeneratorPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorPolicyError';
  }
}

export const DEFAULT_PASSPHRASE_OPTIONS: PassphraseOptions = {
  mode: 'passphrase',
  words: 4,
  separator: '-',
  capitalize: false,
};

export const DEFAULT_GENERATOR_OPTIONS: PasswordOptions = {
  mode: 'password',
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
};

export const DEFAULT_GENERATOR_PREFERENCES: GeneratorPreferences = {
  mode: 'password',
  password: DEFAULT_GENERATOR_OPTIONS,
  passphrase: DEFAULT_PASSPHRASE_OPTIONS,
};

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/';
const AMBIGUOUS = 'Il1O0o';

const withoutAmbiguous = (value: string): string =>
  [...value].filter((character) => !AMBIGUOUS.includes(character)).join('');

const randomInt = (maximum: number): number => {
  if (!Number.isSafeInteger(maximum) || maximum <= 0) throw new GeneratorPolicyError('Invalid random range');
  const limit = Math.floor(0x1_0000_0000 / maximum) * maximum;
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % maximum;
  }
};

const shuffle = <T>(values: T[]): T[] => {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [values[index], values[swap]] = [values[swap]!, values[index]!];
  }
  return values;
};

export const strengthForEntropy = (entropyBits: number): Strength => {
  if (entropyBits < 40) return 'weak';
  if (entropyBits < 60) return 'fair';
  if (entropyBits < 80) return 'strong';
  return 'very-strong';
};

export const generatePassword = (options: PasswordOptions): GeneratorResult => {
  if (
    !Number.isInteger(options.length) ||
    options.length < PASSWORD_MIN_LENGTH ||
    options.length > PASSWORD_MAX_LENGTH
  ) {
    throw new GeneratorPolicyError('Password length is out of range');
  }

  const sets = [
    options.uppercase ? UPPER : '',
    options.lowercase ? LOWER : '',
    options.digits ? DIGITS : '',
    options.symbols ? SYMBOLS : '',
  ]
    .map((set) => (set ? (options.excludeAmbiguous ? withoutAmbiguous(set) : set) : ''))
    .filter(Boolean);
  if (sets.length === 0) throw new GeneratorPolicyError('Select at least one character set');

  const alphabet = sets.join('');
  const characters = sets.map((set) => set[randomInt(set.length)]!);
  while (characters.length < options.length) characters.push(alphabet[randomInt(alphabet.length)]!);
  shuffle(characters);

  const entropyBits = options.length * Math.log2(alphabet.length);
  return {
    value: characters.join(''),
    entropyBits,
    strength: strengthForEntropy(entropyBits),
  };
};

export const generatePassphrase = (options: PassphraseOptions): GeneratorResult => {
  if (
    !Number.isInteger(options.words) ||
    options.words < PASSPHRASE_MIN_WORDS ||
    options.words > PASSPHRASE_MAX_WORDS
  ) {
    throw new GeneratorPolicyError('Passphrase word count is out of range');
  }

  const words = Array.from({ length: options.words }, () => {
    const word = PASSPHRASE_WORDS[randomInt(PASSPHRASE_WORDS.length)]!;
    return options.capitalize ? `${word[0]!.toUpperCase()}${word.slice(1)}` : word;
  });
  const entropyBits = options.words * Math.log2(PASSPHRASE_WORDS.length);

  return {
    value: words.join(options.separator),
    entropyBits,
    strength: strengthForEntropy(entropyBits),
  };
};

export const generate = (options: GeneratorOptions): GeneratorResult =>
  options.mode === 'passphrase' ? generatePassphrase(options) : generatePassword(options);
