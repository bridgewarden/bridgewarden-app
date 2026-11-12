import { base32Decode, base32Encode } from '../base32';
import { currentTotpStep, generateTotpCode, TOTP_STEP_SECONDS } from '../totp';

const STEP_SECONDS = TOTP_STEP_SECONDS;
const CODE_PATTERN = /^\d{6}$/;

export type TotpVerification = {
  valid: boolean;
  step: number;
};

export const encodeBase32 = (bytes: Uint8Array): string => base32Encode(bytes);

export const decodeBase32 = (value: string): Uint8Array => base32Decode(value, undefined, { stripPadding: true });

export const generateSecret = (): Uint8Array => crypto.getRandomValues(new Uint8Array(20));

export const currentStep = currentTotpStep;
export const generateCode = generateTotpCode;

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
