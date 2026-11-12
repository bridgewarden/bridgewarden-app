import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { ShieldAlertIcon } from 'lucide-react';
import { Link, useFetcher, useLocation, useMatches, useNavigate } from 'react-router';
import { toast } from 'sonner';

import { useAutoLock } from '~/hooks/use-auto-lock';
import { AppHeader, type AppUser } from '~/components/app-header';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { OfflineBanner } from '~/components/offline-banner';
import { LockedOverlay } from '~/components/locked-overlay';
import { Toaster } from '~/components/ui/sonner';
import { clearSecretClipboard } from '~/lib/clipboard';
import { getTrashCount, refreshTrashCount, resetTrashCount, subscribeTrashCount } from '~/lib/vault/trash-count';
import { t } from '~/lib/i18n/en';
import type { Theme } from '~/lib/theme';
import { resetAutoLockPreferences } from '~/lib/vault/auto-lock';
import { isUnlocked, subscribeKeyState } from '~/lib/vault/key-store';
import { wipeVaultDb } from '~/lib/vault/local-db';
import { clearUnlockFailures, lockVault, unlockVault } from '~/lib/vault/lock';

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
  const location = useLocation();
  const matches = useMatches();
  const wasSubmitting = useRef(false);
  const logoutTimer = useRef<number | null>(null);
  const wasLocked = useRef(false);
  const hadUser = useRef(Boolean(user));
  const lockButtonRef = useRef<HTMLButtonElement>(null);
  const unlocked = useSyncExternalStore(subscribeKeyState, isUnlocked, lockedSnapshot);
  const trashCount = useSyncExternalStore(subscribeTrashCount, getTrashCount, () => 0);
  const userEmail = user?.email;
  const protectedRoute = matches.some((match) => match.id === 'routes/protected');
  const locked = Boolean(user) && !unlocked && protectedRoute;
  useAutoLock(unlocked);

  useEffect(() => {
    void clearSecretClipboard();
  }, [location.pathname]);

  useEffect(() => {
    if (userEmail && unlocked) {
      void import('~/lib/vault/background-sync')
        .then(({ runVaultSync }) => runVaultSync())
        .then(() => refreshTrashCount())
        .catch(() => undefined);
    }
  }, [unlocked, userEmail]);

  useEffect(() => {
    let active = true;
    let unsubscribe: () => void = () => undefined;
    void import('~/lib/vault/background-sync').then(({ subscribeOutbox }) => {
      if (!active) return;
      unsubscribe = subscribeOutbox(() => void refreshTrashCount());
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!unlocked || !user) resetTrashCount();
  }, [unlocked, user]);

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
      <AppHeader
        theme={theme}
        user={user}
        locked={locked}
        unlocked={unlocked}
        busy={fetcher.state !== 'idle'}
        trashCount={trashCount}
        lockButtonRef={lockButtonRef}
        onLock={lockVault}
        onLogout={logout}
      />
      <OfflineBanner />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
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
