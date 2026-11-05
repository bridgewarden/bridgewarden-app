export type AppSecrets = {
  SESSION_SECRET: string;
  AUTH_PEPPER: string;
  TOTP_ENC_KEY: string;
  BOOTSTRAP_TOKEN: string;
  APP_ORIGIN: string;
  TOTP_ISSUER: string;
  APP_ENV: 'development' | 'production';
};

export class ServerConfigError extends Error {
  constructor(name: string) {
    super(`Missing required configuration: ${name}`);
    this.name = 'ServerConfigError';
  }
}

export const requireSecret = (env: Env, name: keyof AppSecrets): string => {
  const value = (env as Env & Partial<AppSecrets>)[name];

  if (typeof value !== 'string' || value.trim() === '') {
    throw new ServerConfigError(name);
  }

  return value;
};
