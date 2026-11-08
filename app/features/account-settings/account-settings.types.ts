export type TwoFactorState = {
  enabled: boolean;
  remaining: number;
};

export type AccountSettingsProps = {
  email: string;
  displayName: string | null;
  twoFactor: TwoFactorState;
};

export type EnrollResponse = { ok: true; secret: string; uri: string } | { ok: false; error: string };
export type CodesResponse = { ok: true; backupCodes: string[] } | { ok: false; error: string };
export type DisableResponse = { ok: true } | { ok: false; error: string };
export type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };
