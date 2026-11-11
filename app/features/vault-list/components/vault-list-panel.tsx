import { useEffect, useRef, useState } from 'react';

import { FileTextIcon, KeyRoundIcon, PlusIcon, StarIcon } from 'lucide-react';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { t } from '~/lib/i18n/en';

import { useVaultList } from '../vault-list.hooks';
import { CreateItemDialog } from './create-item-dialog';
import { ItemDetailDialog } from './item-detail-dialog';
import { VaultListToolbar } from './vault-list-toolbar';

const isFormTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
};

const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  Boolean(target.closest('button, a, [role="button"], [role="checkbox"], [role="combobox"]'));

export const VaultListPanel = () => {
  const flow = useVaultList();
  const [createOpen, setCreateOpen] = useState(false);
  const lastScrolled = useRef(-1);
  const hadDetail = useRef(false);
  const { activeIndex, detailItem, openDetail, setActiveIndex, visibleItems } = flow;

  useEffect(() => {
    if (hadDetail.current && !detailItem) {
      const active = visibleItems[activeIndex];
      if (active) document.querySelector<HTMLButtonElement>(`[data-vault-item="${CSS.escape(active.id)}"]`)?.focus();
    }
    hadDetail.current = Boolean(detailItem);
  }, [activeIndex, detailItem, visibleItems]);

  useEffect(() => {
    if (detailItem || lastScrolled.current === activeIndex) return;
    const active = visibleItems[activeIndex];
    if (!active) return;
    lastScrolled.current = activeIndex;
    document.querySelector(`[data-vault-item="${CSS.escape(active.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, detailItem, visibleItems]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (createOpen || detailItem || isFormTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Enter' && isInteractiveTarget(event.target)) return;
      const count = visibleItems.length;
      if (count === 0) return;

      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault();
        const next = Math.min(activeIndex + 1, count - 1);
        setActiveIndex(next);
        const row = visibleItems[next];
        if (row)
          requestAnimationFrame(() =>
            document.querySelector<HTMLButtonElement>(`[data-vault-item="${CSS.escape(row.id)}"]`)?.focus(),
          );
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next = Math.max(activeIndex - 1, 0);
        setActiveIndex(next);
        const row = visibleItems[next];
        if (row)
          requestAnimationFrame(() =>
            document.querySelector<HTMLButtonElement>(`[data-vault-item="${CSS.escape(row.id)}"]`)?.focus(),
          );
      } else if (event.key === 'Enter') {
        const active = visibleItems[activeIndex];
        if (active) {
          event.preventDefault();
          openDetail(active.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, createOpen, detailItem, openDetail, setActiveIndex, visibleItems]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('vault.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('vault.count', { count: flow.visibleItems.length })} · {t('vault.keyboard')}
          </p>
        </div>
        <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
          <PlusIcon aria-hidden="true" />
          {t('vault.newItem')}
        </Button>
      </div>

      <VaultListToolbar filters={flow.filters} folders={flow.folders} onChange={flow.updateFilters} />

      {flow.status === 'offline' ? (
        <Alert role="status">
          <AlertDescription>{t('vault.offline')}</AlertDescription>
        </Alert>
      ) : null}
      {flow.status === 'error' || flow.status === 'degraded' ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{t('vault.syncError')}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              disabled={flow.refreshing}
              onClick={() => void flow.retry()}
            >
              {flow.refreshing ? t('vault.retrying') : t('vault.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {flow.skipped > 0 ? (
        <p className="text-sm text-muted-foreground">{t('vault.skipped', { count: flow.skipped })}</p>
      ) : null}

      {flow.status === 'loading' ? (
        <div role="status" className="space-y-2" aria-busy="true" aria-label={t('vault.loading')}>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : flow.items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t('vault.empty.title')}
            </CardTitle>
            <CardDescription>{t('vault.empty.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
              <PlusIcon aria-hidden="true" />
              {t('vault.createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : flow.visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('vault.noMatches')}</p>
      ) : (
        <ul className="space-y-1">
          {flow.visibleItems.map((item, index) => (
            <li key={item.id}>
              <Button
                type="button"
                data-vault-item={item.id}
                variant="ghost"
                aria-current={index === flow.activeIndex ? 'true' : undefined}
                tabIndex={index === flow.activeIndex ? 0 : -1}
                className="h-auto min-h-14 w-full justify-start gap-3 px-3 py-2 text-left data-[active=true]:bg-muted"
                data-active={index === flow.activeIndex}
                onClick={() => {
                  flow.setActiveIndex(index);
                  flow.openDetail(item.id);
                }}
              >
                {item.type === 'login' ? (
                  <KeyRoundIcon className="size-5 shrink-0" aria-hidden="true" />
                ) : (
                  <FileTextIcon className="size-5 shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {item.username ?? t(item.type === 'login' ? 'vault.type.login' : 'vault.type.note')}
                  </span>
                </span>
                {item.folderName ? (
                  <Badge variant="outline" className="max-w-32 truncate">
                    {item.folderName}
                  </Badge>
                ) : null}
                {item.favorite ? (
                  <StarIcon className="size-4 fill-current" role="img" aria-label={t('vault.favorite')} />
                ) : null}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <CreateItemDialog
        open={createOpen}
        folders={flow.folders}
        onOpenChange={setCreateOpen}
        onCreate={flow.createItem}
      />
      <ItemDetailDialog item={flow.detailItem} onClose={flow.closeDetail} />
    </section>
  );
};
