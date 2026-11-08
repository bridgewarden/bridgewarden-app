export type AppSecrets = {
  SESSION_SECRET: string;
  AUTH_PEPPER: string;
  TOTP_ENC_KEY: string;
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

export const readConfig = (env: Env, name: keyof AppSecrets): string | undefined => {
  const value = (env as Env & Partial<AppSecrets>)[name];

  return typeof value === 'string' ? value : undefined;
};

export const requireSecret = (env: Env, name: keyof AppSecrets): string => {
  const value = readConfig(env, name);

  if (!value?.trim()) {
    throw new ServerConfigError(name);
  }

  return value;
};
