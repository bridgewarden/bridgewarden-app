export type RecoveryStep = 'email' | 'reset' | 'success';

export type RecoveryError = 'invalid' | 'rate-limited' | 'server-error';

export type RecoveryFieldErrors = {
  recoveryKey: string | null;
  password: string | null;
  confirmation: string | null;
};

export type RecoveryLookupResponse =
  { ok: true; recoveryKeyWrapped: string; recoveryKeyWrapIv: string } | { ok: false; error: string };

export type RecoveryResetResponse = { ok: true; sessionIssued: boolean } | { ok: false; error: string };
