import { toBase64Url } from '../base64-url';
import { createUsersQueries, type SessionUserRow } from './queries/users';
import { toHex } from './hmac';

export const SESSION_COOKIE_NAME = 'bw_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;
const LAST_SEEN_REFRESH_MS = 60 * 60 * 1000;
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const textEncoder = new TextEncoder();

export const hashSessionToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token));

  return toHex(new Uint8Array(digest));
};

export const serializeSessionCookie = (token: string): string =>
  `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;

export const clearSessionCookie = (): string =>
  `${SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export type SessionRecord = {
  userId: string;
  createdAt: number;
  lastSeenAt: number;
  uaHash: string | null;
  ipHash: string | null;
  ver: number;
};

export type SessionUser = SessionUserRow;

export type SessionContext = {
  session: SessionRecord;
  user: SessionUser;
};

export type CreatedSession = {
  cookie: string;
  token: string;
};

export type CreateSessionInput = {
  userId: string;
  ver?: number;
  uaHash?: string | null;
  ipHash?: string | null;
};

const sessionKey = async (token: string): Promise<string> => `session:${await hashSessionToken(token)}`;

export const readSessionToken = (request: Request): string | null => {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== SESSION_COOKIE_NAME) continue;

    const token = rest.join('=');
    return SESSION_TOKEN_PATTERN.test(token) ? token : null;
  }

  return null;
};

export const createSession = async (env: Env, input: CreateSessionInput): Promise<CreatedSession> => {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  const record: SessionRecord = {
    userId: input.userId,
    createdAt: now,
    lastSeenAt: now,
    uaHash: input.uaHash ?? null,
    ipHash: input.ipHash ?? null,
    ver: input.ver ?? 0,
  };

  await env.KV_SESSIONS.put(await sessionKey(token), JSON.stringify(record), {
    expiration: Math.floor((now + SESSION_TTL_MS) / 1000),
  });

  return { token, cookie: serializeSessionCookie(token) };
};

const parseSessionRecord = (raw: string): SessionRecord | null => {
  try {
    const value = JSON.parse(raw) as Partial<SessionRecord>;

    if (
      typeof value.userId !== 'string' ||
      typeof value.createdAt !== 'number' ||
      typeof value.lastSeenAt !== 'number' ||
      typeof value.ver !== 'number' ||
      !Number.isInteger(value.ver) ||
      (value.uaHash !== null && typeof value.uaHash !== 'string') ||
      (value.ipHash !== null && typeof value.ipHash !== 'string')
    ) {
      return null;
    }

    return value as SessionRecord;
  } catch {
    return null;
  }
};

export const getSession = async (env: Env, request: Request): Promise<SessionContext | null> => {
  const token = readSessionToken(request);
  if (!token) return null;

  const key = await sessionKey(token);
  const raw = await env.KV_SESSIONS.get(key);
  if (!raw) return null;

  let session = parseSessionRecord(raw);
  if (!session) return null;

  const now = Date.now();
  if (session.createdAt + SESSION_TTL_MS <= now) return null;

  const row = await createUsersQueries(env).findSessionUser(session.userId);

  if (!row || row.status !== 'active' || row.sessionVersion !== session.ver) {
    await env.KV_SESSIONS.delete(key).catch(() => undefined);
    return null;
  }

  if (now - session.lastSeenAt >= LAST_SEEN_REFRESH_MS && session.createdAt + SESSION_TTL_MS - now >= 60_000) {
    const refreshed = { ...session, lastSeenAt: now };
    try {
      await env.KV_SESSIONS.put(key, JSON.stringify(refreshed), {
        expiration: Math.floor((session.createdAt + SESSION_TTL_MS) / 1000),
      });
      session = refreshed;
    } catch {
      console.warn('session.touch_failed');
    }
  }

  return { session, user: row };
};

export const destroySessionToken = async (env: Env, token: string): Promise<void> => {
  await env.KV_SESSIONS.delete(await sessionKey(token));
};

export const destroySession = async (env: Env, request: Request): Promise<void> => {
  const token = readSessionToken(request);
  if (token) await destroySessionToken(env, token);
};

export const revokeUserSessions = async (env: Env, userId: string): Promise<void> => {
  await createUsersQueries(env).incrementSessionVersion(userId, Date.now());
};
