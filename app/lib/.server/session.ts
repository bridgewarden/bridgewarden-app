import { toBase64Url } from '../base64-url';

export const SESSION_COOKIE_NAME = 'bw_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const textEncoder = new TextEncoder();

const toHex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

export const hashSessionToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token));

  return toHex(new Uint8Array(digest));
};

export const serializeSessionCookie = (token: string): string =>
  `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;

export type CreatedSession = {
  cookie: string;
  token: string;
};

const sessionKey = async (token: string): Promise<string> => `session:${await hashSessionToken(token)}`;

export const createSession = async (env: Env, userId: string): Promise<CreatedSession> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

  await env.KV_SESSIONS.put(await sessionKey(token), JSON.stringify({ userId, createdAt: Date.now() }), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  return { token, cookie: serializeSessionCookie(token) };
};

export const destroySession = async (env: Env, token: string): Promise<void> => {
  await env.KV_SESSIONS.delete(await sessionKey(token));
};
