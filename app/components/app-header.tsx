import type { RefObject } from 'react';

import { CircleUserIcon, LockIcon, MenuIcon, ShieldIcon, Trash2Icon } from 'lucide-react';
import { Link } from 'react-router';

import { ThemeControl } from '~/components/theme-control';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { t } from '~/lib/i18n/en';
import type { Theme } from '~/lib/theme';

export type AppUser = {
  displayName: string | null;
  email: string;
  role: 'admin' | 'member';
};

type AppHeaderProps = {
  theme: Theme;
  user: AppUser | null;
  locked: boolean;
  unlocked: boolean;
  busy: boolean;
  trashCount: number;
  lockButtonRef: RefObject<HTMLButtonElement | null>;
  onLock: () => void;
  onLogout: () => void;
};

export const AppHeader = ({
  theme,
  user,
  locked,
  unlocked,
  busy,
  trashCount,
  lockButtonRef,
  onLock,
  onLogout,
}: AppHeaderProps) => {
  const visibleTrashCount = unlocked ? trashCount : 0;

  return (
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
          onClick={onLock}
        >
          <LockIcon className="size-5" aria-hidden="true" />
        </Button>
        <ThemeControl theme={theme} />
        {user ? (
          <>
            <div className="hidden items-center gap-1 sm:flex">
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link to="/app/trash">
                  <Trash2Icon aria-hidden="true" />
                  {t('trash.title')}
                  {visibleTrashCount > 0 ? <Badge variant="secondary">{visibleTrashCount}</Badge> : null}
                </Link>
              </Button>
              {user.role === 'admin' ? (
                <Button variant="ghost" size="sm" className="min-h-11" asChild>
                  <Link to="/admin/users">{t('adminUsers.nav')}</Link>
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link to="/app/settings">{t('common.settings')}</Link>
              </Button>
              <span className="max-w-32 truncate text-sm text-muted-foreground">{user.displayName ?? user.email}</span>
              <Button variant="ghost" className="min-h-11" disabled={busy} onClick={onLogout}>
                {t('common.signOut')}
              </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-11 sm:hidden" aria-label={t('common.menu')}>
                  <MenuIcon aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <DropdownMenuItem asChild>
                  <Link to="/app/trash" className="min-h-11">
                    <Trash2Icon aria-hidden="true" />
                    {t('trash.title')}
                    {visibleTrashCount > 0 ? <Badge variant="secondary">{visibleTrashCount}</Badge> : null}
                  </Link>
                </DropdownMenuItem>
                {user.role === 'admin' ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/users" className="min-h-11">
                      {t('adminUsers.nav')}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link to="/app/settings" className="min-h-11">
                    {t('common.settings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="min-h-11"
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault();
                    onLogout();
                  }}
                >
                  {t('common.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
  );
};
