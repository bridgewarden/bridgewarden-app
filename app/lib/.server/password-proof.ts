import { verifyServerAuthHash } from './verify-auth';

export type ProofResult =
  | { status: 'ok' }
  | { status: 'invalid-password' }
  | { status: 'locked'; retryAfter: number }
  | { status: 'server-error' };

type AttemptState = { failed_count: number; locked_until: number | null };

type VerifyProofInput = {
  authHashBytes: Uint8Array;
  serverSalt: string;
  pepper: string;
  expectedHash: string;
  lockedUntil: number | null;
  now: number;
  maxAttempts: number;
  durationMs: number;
  recordFailure: () => Promise<AttemptState | null>;
  resetFailures: () => Promise<unknown>;
  onFailure: () => Promise<void>;
  reserveAttempt?: () => Promise<AttemptState | null>;
};

const retryAfter = (lockedUntil: number | null, now: number): number =>
  Math.max(1, Math.ceil(((lockedUntil ?? now) - now) / 1000));

export const verifyPasswordProof = async ({
  authHashBytes,
  serverSalt,
  pepper,
  expectedHash,
  lockedUntil,
  now,
  maxAttempts,
  durationMs,
  recordFailure,
  resetFailures,
  onFailure,
  reserveAttempt,
}: VerifyProofInput): Promise<ProofResult> => {
  if (lockedUntil && lockedUntil > now) {
    return { status: 'locked', retryAfter: retryAfter(lockedUntil, now) };
  }

  let reserved: AttemptState | null = null;
  if (reserveAttempt) {
    try {
      reserved = await reserveAttempt();
    } catch {
      return { status: 'server-error' };
    }
    if (!reserved) return { status: 'locked', retryAfter: Math.ceil(durationMs / 1000) };
    if (reserved.failed_count >= maxAttempts) {
      return { status: 'locked', retryAfter: retryAfter(reserved.locked_until, now) };
    }
  }

  const verified = await verifyServerAuthHash(authHashBytes, serverSalt, pepper, expectedHash);
  if (!verified) {
    await onFailure();
    let state = reserved;
    if (!state) {
      try {
        state = await recordFailure();
      } catch {
        return { status: 'server-error' };
      }
    }
    return state && state.failed_count >= maxAttempts
      ? { status: 'locked', retryAfter: retryAfter(state.locked_until, now) }
      : { status: 'invalid-password' };
  }

  try {
    await resetFailures();
  } catch {
    return { status: 'server-error' };
  }
  return { status: 'ok' };
};
