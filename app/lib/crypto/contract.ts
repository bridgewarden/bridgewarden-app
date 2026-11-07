// Permanent contract. Changing any value here invalidates every existing vault.
// Binary values use standard base64 with padding in storage; API transport converts them to base64url.
// Passwords are normalized with NFKC before derivation.
export const ENVELOPE_VERSION = 1;
export const ENVELOPE_ALGORITHM = 'A256GCM';

export const KDF_ALGORITHM = 'pbkdf2-sha256';
export const DEFAULT_KDF_ITERATIONS = 600_000;
export const MIN_KDF_ITERATIONS = DEFAULT_KDF_ITERATIONS;
export const PASSWORD_NORMALIZATION = 'NFKC';

export const HKDF_INFO = {
  auth: 'bw-auth',
  wrap: 'bw-wrap',
  recovery: 'bw-recovery',
} as const;

export const SALT_BYTES = 16;
export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;
export const RECOVERY_SECRET_BYTES = 16;
export const RECOVERY_KEY_LENGTH = 26;
