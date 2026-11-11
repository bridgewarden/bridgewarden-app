import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { CircleUserIcon, LockIcon, ShieldAlertIcon, ShieldIcon } from 'lucide-react';
import { Link, useFetcher, useMatches, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAutoLock } from '~/hooks/use-auto-lock';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { LockedOverlay } from '~/components/locked-overlay';
import { ThemeControl } from '~/components/theme-control';
import { Button } from '~/components/ui/button';
import { Toaster } from '~/components/ui/sonner';
import { t } from '~/lib/i18n/en';
import type { Theme } from '~/lib/theme';
import { resetAutoLockPreferences } from '~/lib/vault/auto-lock';
import { isUnlocked, subscribeKeyState } from '~/lib/vault/key-store';
import { wipeVaultDb } from '~/lib/vault/local-db';
import { clearUnlockFailures, lockVault, unlockVault } from '~/lib/vault/lock';
import { syncVault } from '~/lib/vault/sync';

type AppUser = {
  displayName: string | null;
  email: string;
  role: 'admin' | 'member';
};

const lockedSnapshot = () => false;

type AppShellProps = {
  children: React.ReactNode;
  theme: Theme;
  user: AppUser | null;
  twoFactorEnabled: boolean;
};

export const AppShell = ({ children, theme, user, twoFactorEnabled }: AppShellProps) => {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const navigate = useNavigate();
  const matches = useMatches();
  const wasSubmitting = useRef(false);
  const logoutTimer = useRef<number | null>(null);
  const wasLocked = useRef(false);
  const hadUser = useRef(Boolean(user));
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const unlocked = useSyncExternalStore(subscribeKeyState, isUnlocked, lockedSnapshot);
  const userEmail = user?.email;
  const protectedRoute = matches.some((match) => match.id === 'routes/protected');
  const locked = Boolean(user) && !unlocked && protectedRoute;
  useAutoLock(unlocked);

  useEffect(() => {
    if (userEmail && unlocked) void syncVault();
  }, [unlocked, userEmail]);

  useEffect(() => {
    if (!user) {
      hadUser.current = false;
      return;
    }
    if (!hadUser.current) resetAutoLockPreferences();
    hadUser.current = true;
  }, [user]);

  useEffect(() => {
    if (wasLocked.current && !locked) lockButtonRef.current?.focus();
    wasLocked.current = locked;
  }, [locked]);

  const failSignOut = useCallback(() => {
    if (logoutTimer.current !== null) {
      window.clearTimeout(logoutTimer.current);
      logoutTimer.current = null;
    }
    lockVault();
    void wipeVaultDb().catch(() => undefined);
    toast.error(t('common.signOutFailed'));
  }, []);

  useEffect(() => {
    if (fetcher.state !== 'idle') {
      wasSubmitting.current = true;
      return;
    }

    if (fetcher.data?.ok) {
      if (logoutTimer.current !== null) {
        window.clearTimeout(logoutTimer.current);
        logoutTimer.current = null;
      }
      lockVault();
      resetAutoLockPreferences();
      clearUnlockFailures();
      void wipeVaultDb()
        .catch(() => undefined)
        .finally(() => navigate('/login', { replace: true }));
      return;
    }

    if (fetcher.data && !fetcher.data.ok) {
      failSignOut();
      return;
    }

    if (wasSubmitting.current) {
      failSignOut();
    }

    wasSubmitting.current = false;
  }, [failSignOut, fetcher.data, fetcher.state, navigate]);

  const logout = () => {
    lockVault();
    if (logoutTimer.current !== null) window.clearTimeout(logoutTimer.current);
    logoutTimer.current = window.setTimeout(failSignOut, 1500);
    fetcher.submit({}, { method: 'post', action: '/auth/logout', encType: 'application/json' });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {user && !twoFactorEnabled ? (
        <Alert
          role="status"
          inert={locked}
          className="rounded-none border-x-0 border-t-0 px-4 py-2 [&>svg]:mx-auto [&>svg]:size-4"
        >
          <ShieldAlertIcon aria-hidden="true" />
          <AlertDescription className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2 text-center">
            <span>{t('twoFactor.banner')}</span>
            <Link to="/app/settings" className="font-medium underline underline-offset-4">
              {t('twoFactor.enableNow')}
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <header inert={locked} className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-5xl items-center gap-1 px-4">
          <Link to="/" className="mr-auto flex min-h-11 min-w-0 items-center gap-2 rounded-md px-1 font-semibold">
            <ShieldIcon className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{t('app.name')}</span>
          </Link>
          <Button
            ref={lockButtonRef}
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            disabled={!user || !unlocked}
            aria-label={t('common.lock')}
            onClick={lockVault}
          >
            <LockIcon className="size-5" aria-hidden="true" />
          </Button>
          <ThemeControl theme={theme} />
          {user ? (
            <>
              {user.role === 'admin' ? (
                <Button variant="ghost" size="sm" className="min-h-11" asChild>
                  <Link to="/admin/users">
                    <span className="hidden sm:inline">{t('adminUsers.nav')}</span>
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link to="/app/settings">
                  <span className="hidden sm:inline">{t('common.settings')}</span>
                </Link>
              </Button>
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {locked ? (
          <LockedOverlay signingOut={fetcher.state !== 'idle'} onUnlock={unlockVault} onSignOut={logout} />
        ) : (
          children
        )}
      </main>
      <Toaster theme={theme} />
    </div>
  );
};
