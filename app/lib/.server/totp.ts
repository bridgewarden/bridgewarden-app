import { base32Decode, base32Encode } from '../base32';
import { toArrayBuffer } from '../crypto/encoding';

const STEP_SECONDS = 30;
const STEP_MS = STEP_SECONDS * 1000;
const CODE_PATTERN = /^\d{6}$/;

export type TotpVerification = {
  valid: boolean;
  step: number;
};

export const encodeBase32 = (bytes: Uint8Array): string => base32Encode(bytes);

export const decodeBase32 = (value: string): Uint8Array => base32Decode(value, undefined, { stripPadding: true });

export const generateSecret = (): Uint8Array => crypto.getRandomValues(new Uint8Array(20));

export const currentStep = (now = Date.now()): number => Math.floor(now / STEP_MS);

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

export const generateCode = async (secret: Uint8Array, step: number): Promise<string> => {
  const digest = await hmacSha1(secret, counterBytes(step));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
};

const codesEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
};

export const verifyCode = async (
  secret: Uint8Array,
  code: string,
  lastStep: number,
  now = Date.now(),
): Promise<TotpVerification> => {
  const normalized = code.replace(/\s/g, '');
  if (!CODE_PATTERN.test(normalized)) return { valid: false, step: lastStep };

  const current = currentStep(now);
  for (const candidate of [current - 1, current, current + 1]) {
    if (candidate <= lastStep) continue;
    if (codesEqual(await generateCode(secret, candidate), normalized)) {
      return { valid: true, step: candidate };
    }
  }

  return { valid: false, step: lastStep };
};

export const buildOtpauthUri = (secret: Uint8Array, email: string, issuer: string): string => {
  const label = `${issuer}:${email}`;
  const encodedSecret = encodeBase32(secret);

  return `otpauth://totp/${encodeURIComponent(label)}?secret=${encodedSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
};
