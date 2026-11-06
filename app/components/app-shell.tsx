import { CircleUserIcon, LockIcon, ShieldIcon } from 'lucide-react';
import { Link } from 'react-router';

import { ThemeControl } from '~/components/theme-control';
import { Button } from '~/components/ui/button';
import { Toaster } from '~/components/ui/sonner';
import { t } from '~/lib/i18n/en';
import type { Theme } from '~/lib/theme';

type AppShellProps = {
  children: React.ReactNode;
  theme: Theme;
};

export const AppShell = ({ children, theme }: AppShellProps) => (
  <div className="flex min-h-screen flex-col">
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-1 px-4">
        <Link to="/" className="mr-auto flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 font-semibold">
          <ShieldIcon className="size-5 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('app.name')}</span>
        </Link>
        <Button variant="ghost" size="icon" className="size-11 shrink-0" disabled aria-label={t('common.lock')}>
          <LockIcon className="size-5" aria-hidden="true" />
        </Button>
        <ThemeControl theme={theme} />
        <Button variant="ghost" size="icon" className="size-11 shrink-0" asChild>
          <Link to="/login" aria-label={t('common.signIn')}>
            <CircleUserIcon className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    <Toaster theme={theme} />
  </div>
);
