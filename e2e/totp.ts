import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const decodeBase32 = (value: string): Buffer => {
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of value.toUpperCase().replace(/=+$/, '')) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');

    accumulator = (accumulator << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
};

export const totpCode = (secret: string, step = Math.floor(Date.now() / 30_000)): string => {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step >>> 0, 4);

  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
};

export const nextStepCode = (secret: string): string => totpCode(secret, Math.floor(Date.now() / 30_000) + 1);
