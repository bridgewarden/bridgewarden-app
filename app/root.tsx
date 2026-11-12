import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  Link,
  useLocation,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from 'react-router';

import { AppShell } from './components/app-shell';
import type { Route } from './+types/root';
import { t } from './lib/i18n/en';
import { cloudflareContext } from './lib/.server/context';
import { createUserTwoFactorQueries } from './lib/.server/queries/user-two-factor';
import { getSessionCached } from './lib/.server/session-cache';
import { DEFAULT_THEME, PWA_THEME_COLOR, readThemeCookie, themeClassName } from './lib/theme';
import './app.css';

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const session = await getSessionCached(env, request);
  const user = session
    ? {
        id: session.user.id,
        displayName: session.user.displayName,
        email: session.user.email,
        role: session.user.role,
      }
    : null;

  let twoFactorEnabled = false;
  if (session) {
    twoFactorEnabled = await createUserTwoFactorQueries(env).isEnabled(session.user.id);
  }

  return { theme: readThemeCookie(request.headers.get('cookie')), user, twoFactorEnabled };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const { theme = DEFAULT_THEME, user = null, twoFactorEnabled = false } = data ?? {};

  return (
    <html lang="en" className={themeClassName(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content={PWA_THEME_COLOR} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppShell theme={theme} user={user} twoFactorEnabled={twoFactorEnabled}>
          {children}
        </AppShell>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  let title = t('errors.title');
  let details = t('errors.generic.description');
  let stack: string | undefined;
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  if (isRouteErrorResponse(error)) {
    title = notFound ? t('errors.notFound.title') : t('errors.title');
    details = error.status === 404 ? t('errors.notFound.description') : t('errors.generic.description');
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{details}</p>
      {stack ? (
        <pre className="mt-4 w-full overflow-x-auto rounded bg-muted p-4 text-sm">
          <code>{stack}</code>
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-2">
        {!notFound ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm"
            to={location.pathname}
            reloadDocument
          >
            {t('common.retry')}
          </Link>
        ) : null}
        <Link className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm" to="/app">
          {t('common.backToVault')}
        </Link>
      </div>
    </section>
  );
}

export const shouldRevalidate = ({ formAction }: ShouldRevalidateFunctionArgs) => formAction !== '/auth/logout';
