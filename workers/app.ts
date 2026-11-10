import { createRequestHandler, RouterContextProvider } from 'react-router';

import { cloudflareContext } from '../app/lib/.server/context';
import { runScheduledPurge } from '../app/server/vault/trash';

const requestHandler = createRequestHandler(() => import('virtual:react-router/server-build'), import.meta.env.MODE);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });

    return requestHandler(request, context);
  },

  scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runScheduledPurge(env)
        .then(() => undefined)
        .catch(() => console.warn('vault.purge_failed')),
    );
  },
} satisfies ExportedHandler<Env>;
