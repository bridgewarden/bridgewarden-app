import { createRequestHandler, RouterContextProvider } from 'react-router';

import { cloudflareContext } from '../app/lib/.server/context';
import { applySecurityHeaders, createSecurityNonce } from '../app/lib/.server/security-headers';
import { buildErrorResponse, hashUserId, normalizeRoutePattern, writeRequestLog } from '../app/lib/.server/log';
import { securityContext } from '../app/lib/.server/security-context';
import { peekSession } from '../app/lib/.server/session-cache';
import { runScheduledPurge } from '../app/server/vault/trash';

const requestHandler = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    const startedAt = performance.now();
    const requestId = crypto.randomUUID();
    const path = new URL(request.url).pathname;
    const route = normalizeRoutePattern(path);
    const nonce = createSecurityNonce();
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    context.set(securityContext, { nonce });

    try {
      const response = await requestHandler(request, context);
      const wrapped = applySecurityHeaders(response, request, env, nonce);
      const cachedSession = peekSession(request);
      const session = cachedSession ? await cachedSession.catch(() => null) : null;
      const userIdHash = await hashUserId(env, session?.user.id ?? null).catch(() => null);

      const durationMs = Math.round(performance.now() - startedAt);
      const failed = wrapped.status >= 500;
      writeRequestLog(
        {
          event: failed ? 'request.error' : 'request.completed',
          requestId,
          method: request.method,
          route,
          status: wrapped.status,
          durationMs,
          userIdHash,
        },
        failed ? new Error(`HTTP ${wrapped.status}`) : undefined,
      );
      wrapped.headers.set('x-request-id', requestId);
      return wrapped;
    } catch (error) {
      writeRequestLog(
        {
          event: 'request.error',
          requestId,
          method: request.method,
          route,
          status: 500,
          durationMs: Math.round(performance.now() - startedAt),
          userIdHash: null,
        },
        error,
      );
      return applySecurityHeaders(buildErrorResponse(requestId), request, env, nonce);
    }
  },

  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runScheduledPurge(env)
        .then(() => undefined)
        .catch((error: unknown) =>
          console.warn('vault.purge_failed', { error: error instanceof Error ? error.name : typeof error }),
        ),
    );
  },
} satisfies ExportedHandler<Env>;
