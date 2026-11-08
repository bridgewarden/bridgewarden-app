export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
// Crockford: excludes I, L, O, and U to avoid ambiguous characters.
export const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

type DecodeOptions = {
  stripPadding?: boolean;
  rejectInvalidBits?: boolean;
  onInvalid?: () => Error;
};

export const normalizeCrockford = (value: string): string =>
  value.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');

export const base32Encode = (bytes: Uint8Array, alphabet = BASE32_ALPHABET): string => {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];

  return output;
};

export const base32Decode = (
  value: string,
  alphabet = BASE32_ALPHABET,
  { stripPadding = false, rejectInvalidBits = false, onInvalid }: DecodeOptions = {},
): Uint8Array => {
  const normalized = stripPadding ? value.toUpperCase().replace(/=+$/, '') : value;
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw onInvalid?.() ?? new Error('Invalid base32 value');

    accumulator = (accumulator << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  if (rejectInvalidBits && bits > 0 && (accumulator & ((1 << bits) - 1)) !== 0) {
    throw onInvalid?.() ?? new Error('Invalid base32 value');
  }

  return new Uint8Array(bytes);
};
