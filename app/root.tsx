import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';

import { AppShell } from './components/app-shell';
import type { Route } from './+types/root';
import { t } from './lib/i18n/en';
import { DEFAULT_THEME, readThemeCookie, themeClassName } from './lib/theme';
import './app.css';

export function loader({ request }: Route.LoaderArgs) {
  return { theme: readThemeCookie(request.headers.get('cookie')) };
}

export const headers = () => ({ 'Cache-Control': 'no-store' });

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>('root');
  const theme = data?.theme ?? DEFAULT_THEME;

  return (
    <html lang="en" className={themeClassName(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppShell theme={theme}>{children}</AppShell>
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
  let title = t('errors.title');
  let details = t('errors.generic.description');
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? t('errors.notFound.title') : t('errors.title');
    details = error.status === 404 ? t('errors.notFound.description') : error.statusText || details;
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
    </section>
  );
}
