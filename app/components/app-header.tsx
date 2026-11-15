import type { RefObject } from 'react';

import { LockIcon, MenuIcon, ShieldIcon, Trash2Icon } from 'lucide-react';
import { Link, useLocation } from 'react-router';

import { ThemeControl } from '~/components/theme-control';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { cn } from '~/lib/class-names';
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

const linkClass = (active: boolean) =>
  cn(
    'inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
    active && 'bg-accent font-medium text-accent-foreground',
  );

const Brand = () => (
  <Link to="/" className="mr-3 flex min-h-11 min-w-0 items-center gap-2 rounded-md">
    <span className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-primary">
      <ShieldIcon className="size-4" aria-hidden="true" />
    </span>
    <span className="min-w-0 leading-tight">
      <span className="block truncate text-sm font-semibold">{t('app.name')}</span>
      <span className="hidden text-[9px] font-medium tracking-[0.08em] text-muted-foreground uppercase sm:block">
        {t('app.zeroKnowledge')}
      </span>
    </span>
  </Link>
);

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
  const { pathname } = useLocation();
  const visibleTrashCount = unlocked ? trashCount : 0;

  if (!user) {
    return (
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-6xl items-center px-4 sm:px-6">
          <Brand />
          <div className="ml-auto flex items-center">
            <ThemeControl theme={theme} />
          </div>
        </div>
      </header>
    );
  }

  const vaultActive = pathname === '/app' || pathname === '/app/new' || pathname.startsWith('/app/edit/');
  const trashActive = pathname === '/app/trash';
  const settingsActive = pathname === '/app/settings';
  const adminActive = pathname === '/admin/users';

  return (
    <header inert={locked} className="border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-0.5 md:flex" aria-label={t('common.primaryNavigation')}>
          <Link to="/app" className={linkClass(vaultActive)} aria-current={vaultActive ? 'page' : undefined}>
            {t('vault.title')}
          </Link>
          <Link to="/app/trash" className={linkClass(trashActive)} aria-current={trashActive ? 'page' : undefined}>
            <Trash2Icon className="size-4" aria-hidden="true" />
            {t('trash.title')}
            {visibleTrashCount > 0 ? (
              <Badge variant="secondary" className="h-5 min-w-5 rounded-sm px-1 font-mono text-[10px]">
                {visibleTrashCount}
              </Badge>
            ) : null}
          </Link>
          <Link
            to="/app/settings"
            className={linkClass(settingsActive)}
            aria-current={settingsActive ? 'page' : undefined}
          >
            {t('common.settings')}
          </Link>
          {user.role === 'admin' ? (
            <Link to="/admin/users" className={linkClass(adminActive)} aria-current={adminActive ? 'page' : undefined}>
              {t('adminUsers.nav')}
            </Link>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            ref={lockButtonRef}
            variant="ghost"
            size="icon"
            className="size-11 shrink-0"
            disabled={!unlocked}
            aria-label={t('common.lock')}
            onClick={onLock}
          >
            <LockIcon className="size-5" aria-hidden="true" />
          </Button>
          <ThemeControl theme={theme} />
          <div className="ml-1 hidden items-center gap-2 border-l pl-3 sm:flex">
            <span className="max-w-32 truncate text-xs text-muted-foreground">{user.displayName ?? user.email}</span>
            <Button variant="ghost" size="sm" className="min-h-10" disabled={busy} onClick={onLogout}>
              {t('common.signOut')}
            </Button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11 md:hidden" aria-label={t('common.menu')}>
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuLabel className="max-w-56 truncate text-xs font-normal text-muted-foreground">
                {user.displayName ?? user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
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
        </div>
      </div>
    </header>
  );
};
