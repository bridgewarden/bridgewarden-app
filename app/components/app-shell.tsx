import { useEffect, useRef } from 'react';

import { CircleUserIcon, LockIcon, ShieldIcon } from 'lucide-react';
import { Link, useFetcher, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { ThemeControl } from '~/components/theme-control';
import { Button } from '~/components/ui/button';
import { Toaster } from '~/components/ui/sonner';
import { t } from '~/lib/i18n/en';
import type { Theme } from '~/lib/theme';
import { clearVaultKey } from '~/lib/vault/key-store';

type AppUser = {
  displayName: string | null;
  email: string;
  role: 'admin' | 'member';
};

type AppShellProps = {
  children: React.ReactNode;
  theme: Theme;
  user: AppUser | null;
};

export const AppShell = ({ children, theme, user }: AppShellProps) => {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const navigate = useNavigate();
  const wasSubmitting = useRef(false);

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      wasSubmitting.current = true;
      return;
    }

    if (fetcher.data?.ok) {
      clearVaultKey();
      navigate('/login', { replace: true });
      return;
    }

    if (fetcher.data && !fetcher.data.ok) {
      toast.error(t('common.signOutFailed'));
      return;
    }

    if (wasSubmitting.current) {
      toast.error(t('common.signOutFailed'));
    }

    wasSubmitting.current = false;
  }, [fetcher.data, fetcher.state, navigate]);

  const logout = () => {
    fetcher.submit({}, { method: 'post', action: '/auth/logout', encType: 'application/json' });
  };

  return (
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
          {user ? (
            <>
              <span className="hidden max-w-32 truncate text-sm text-muted-foreground sm:inline">
                {user.displayName ?? user.email}
              </span>
              <Button variant="ghost" className="min-h-11" disabled={fetcher.state !== 'idle'} onClick={logout}>
                {t('common.signOut')}
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="icon" className="size-11 shrink-0" asChild>
              <Link to="/login" aria-label={t('common.signIn')}>
                <CircleUserIcon className="size-5" aria-hidden="true" />
              </Link>
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <Toaster theme={theme} />
    </div>
  );
};
