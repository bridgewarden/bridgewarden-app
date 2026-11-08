export type PreloginResponse =
  { ok: true; kdfAlg: string; kdfSalt: string; kdfIterations: number } | { ok: false; error: string };

export type LoginSuccess = {
  ok: true;
  requires2fa: false;
  kdfAlg: string;
  kdfSalt: string;
  kdfIterations: number;
  vaultKeyWrapped: string;
  vaultKeyWrapIv: string;
};

export type LoginChallenge = { ok: true; requires2fa: true; challengeToken: string };

export type LoginFailure = { ok: false; error: string; challengeInvalid?: boolean };

export type LoginResponse = LoginSuccess | LoginChallenge | LoginFailure;
export type ChallengeResponse = LoginSuccess | LoginFailure;
