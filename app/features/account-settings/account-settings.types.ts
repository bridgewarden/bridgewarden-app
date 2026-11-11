export type TwoFactorState = {
  enabled: boolean;
  remaining: number;
};

export type PasswordSettings = {
  kdfSalt: string;
  kdfIterations: number;
};

export type AccountSettingsProps = {
  email: string;
  displayName: string | null;
  twoFactor: TwoFactorState;
  password: PasswordSettings;
};

export type EnrollResponse =
  { ok: true; secret: string; uri: string; sessionIssued?: boolean } | { ok: false; error: string };
export type CodesResponse = { ok: true; backupCodes: string[]; sessionIssued?: boolean } | { ok: false; error: string };
export type DisableResponse = { ok: true; sessionIssued?: boolean } | { ok: false; error: string };
export type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };
