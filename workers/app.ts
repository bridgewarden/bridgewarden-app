import { createRequestHandler, RouterContextProvider } from 'react-router';

import { cloudflareContext } from '../app/lib/.server/context';
import { runScheduledPurge } from '../app/server/vault/trash';

const requestHandler = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    const requestId = crypto.randomUUID();
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });

    try {
      return await requestHandler(request, context);
    } catch (error) {
      console.error('request.failed', {
        requestId,
        method: request.method,
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.name : typeof error,
      });
      return new Response('Internal Server Error', {
        status: 500,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-request-id': requestId,
        },
      });
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
