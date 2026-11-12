import { readConfig } from './env';

const DOCUMENT_TYPE = 'text/html';

// SHA-256 of the stylesheet sonner injects at module scope. scripts/__test__/sonner-csp-hash.test.ts keeps this in sync.
export const SONNER_STYLE_HASH = 'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY=';

export const createSecurityNonce = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const buildContentSecurityPolicy = (nonce: string, development: boolean): string => {
  const styleSources = development ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'";
  const styleElementSources = development
    ? "style-src-elem 'self' 'unsafe-inline'"
    : `style-src-elem 'self' '${SONNER_STYLE_HASH}'`;
  const connectSources = development ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*" : "connect-src 'self'";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    styleSources,
    styleElementSources,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    connectSources,
    "font-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
};

export const applySecurityHeaders = (response: Response, request: Request, env: Env, nonce: string): Response => {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);
  const development = readConfig(env, 'APP_ENV') === 'development';
  const isDocument = headers.get('content-type')?.includes(DOCUMENT_TYPE) ?? false;
  const path = url.pathname;
  const noStore =
    isDocument ||
    path.startsWith('/api/') ||
    path.startsWith('/auth/') ||
    path === '/setup' ||
    path.startsWith('/setup/');

  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (isDocument) {
    headers.set('Content-Security-Policy', buildContentSecurityPolicy(nonce, development));
  }

  if (noStore) headers.set('Cache-Control', 'no-store');

  if (url.protocol === 'https:' && readConfig(env, 'APP_ENV') === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
