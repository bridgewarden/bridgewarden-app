import { base32Decode } from './base32';
import { toArrayBuffer } from './crypto/encoding';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_STEP_MS = TOTP_STEP_SECONDS * 1000;
const DIGITS = 6;

export class TotpError extends Error {
  constructor(
    message: string,
    readonly code: 'invalid-secret' | 'unsupported-parameters',
  ) {
    super(message);
    this.name = 'TotpError';
  }
}

export const currentTotpStep = (now = Date.now()): number => Math.floor(now / TOTP_STEP_MS);

const normalizeTotpSecret = (value: string): string => value.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');

const decodeRawSecret = (value: string): Uint8Array => {
  try {
    const bytes = base32Decode(normalizeTotpSecret(value), undefined, {
      stripPadding: true,
      onInvalid: () => new TotpError('Invalid TOTP secret', 'invalid-secret'),
    });
    if (bytes.length === 0) throw new TotpError('TOTP secret is empty', 'invalid-secret');
    return bytes;
  } catch (error) {
    throw error instanceof TotpError ? error : new TotpError('Invalid TOTP secret', 'invalid-secret');
  }
};

export const parseTotpSecret = (input: string): Uint8Array => {
  const value = input.trim();
  if (!value) throw new TotpError('TOTP secret is empty', 'invalid-secret');
  if (!value.toLowerCase().startsWith('otpauth://')) return decodeRawSecret(value);

  let uri: URL;
  try {
    uri = new URL(value);
  } catch {
    throw new TotpError('Invalid otpauth URI', 'invalid-secret');
  }
  if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp') {
    throw new TotpError('Only otpauth TOTP URIs are supported', 'unsupported-parameters');
  }

  const algorithm = (uri.searchParams.get('algorithm') ?? 'SHA1').toUpperCase();
  const digits = Number(uri.searchParams.get('digits') ?? DIGITS);
  const period = Number(uri.searchParams.get('period') ?? TOTP_STEP_SECONDS);
  if (algorithm !== 'SHA1' || digits !== DIGITS || period !== TOTP_STEP_SECONDS) {
    throw new TotpError('Unsupported TOTP parameters', 'unsupported-parameters');
  }

  const secret = uri.searchParams.get('secret');
  if (!secret) throw new TotpError('TOTP secret is missing', 'invalid-secret');
  return decodeRawSecret(secret);
};

const counterBytes = (step: number): Uint8Array => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(step / 2 ** 32));
  view.setUint32(4, step >>> 0);
  return new Uint8Array(buffer);
};

const hmacSha1 = async (secret: Uint8Array, data: Uint8Array): Promise<Uint8Array> => {
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(secret), { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, toArrayBuffer(data));
  return new Uint8Array(signature);
};

export const generateTotpCode = async (secret: Uint8Array, step: number): Promise<string> => {
  const digest = await hmacSha1(secret, counterBytes(step));
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);

  return String(binary % 1_000_000).padStart(DIGITS, '0');
};

export const generateTotp = async (secret: string | Uint8Array, step = currentTotpStep()): Promise<string> =>
  generateTotpCode(typeof secret === 'string' ? parseTotpSecret(secret) : secret, step);
