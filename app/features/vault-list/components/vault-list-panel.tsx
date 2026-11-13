import { lazy, Suspense, useCallback } from 'react';

import { PlusIcon } from 'lucide-react';

import { Link } from 'react-router';

import { Button } from '~/components/ui/button';
import { EmptyState } from '~/components/empty-state';
import { InlineError } from '~/components/inline-error';
import { SkeletonList } from '~/components/skeleton-list';
import { t } from '~/lib/i18n/en';
import { readVaultItem } from '~/lib/vault/item-read';

import { useVaultList, useVaultListInteraction } from '../vault-list.hooks';
import { VaultListRows } from './vault-list-rows';
import { VaultListToolbar } from './vault-list-toolbar';
import { VaultSearchDialog } from './vault-search-dialog';

const ItemDetailDialog = lazy(() =>
  import('./item-detail-dialog').then((module) => ({ default: module.ItemDetailDialog })),
);

export const VaultListPanel = () => {
  const flow = useVaultList();
  useVaultListInteraction(flow);
  const loadSecrets = useCallback(async (id: string) => {
    const result = await readVaultItem(id);
    if (result.status !== 'ok' || result.item.payload.type !== 'login') {
      return { password: null, totpSecret: null };
    }
    return {
      password: result.item.payload.password ?? null,
      totpSecret: result.item.payload.totpSecret ?? null,
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('vault.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('vault.count', { count: flow.visibleItems.length })} · {t('vault.keyboard')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <VaultSearchDialog items={flow.items} disabled={flow.detailItem !== null} onOpenItem={flow.openDetail} />
          <Button className="min-h-11" asChild>
            <Link to="/app/new" prefetch="render">
              <PlusIcon aria-hidden="true" />
              {t('vault.newItem')}
            </Link>
          </Button>
        </div>
      </div>

      <VaultListToolbar filters={flow.filters} folders={flow.folders} onChange={flow.updateFilters} />

      {flow.status === 'error' || flow.status === 'degraded' ? (
        <InlineError
          message={t('vault.syncError')}
          action={
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
          }
        />
      ) : null}
      {flow.skipped > 0 ? (
        <p className="text-sm text-muted-foreground">{t('vault.skipped', { count: flow.skipped })}</p>
      ) : null}

      {flow.status === 'loading' ? (
        <SkeletonList label={t('vault.loading')} />
      ) : flow.items.length === 0 && flow.status === 'ready' ? (
        <EmptyState
          title={t('vault.empty.title')}
          description={t('vault.empty.description')}
          action={
            <Button className="min-h-11" asChild>
              <Link to="/app/new" prefetch="render">
                <PlusIcon aria-hidden="true" />
                {t('vault.createFirst')}
              </Link>
            </Button>
          }
        />
      ) : flow.visibleItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('vault.noMatches')}</p>
      ) : (
        <VaultListRows
          items={flow.visibleItems}
          activeIndex={flow.activeIndex}
          onActivate={flow.setActiveIndex}
          onOpen={flow.openDetail}
        />
      )}

      {flow.detailItem ? (
        <Suspense fallback={null}>
          <ItemDetailDialog item={flow.detailItem} onClose={flow.closeDetail} onLoadSecrets={loadSecrets} />
        </Suspense>
      ) : null}
    </section>
  );
};
