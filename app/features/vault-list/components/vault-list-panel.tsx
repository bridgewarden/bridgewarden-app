import { useCallback } from 'react';

import { PlusIcon } from 'lucide-react';

import { Link } from 'react-router';

import { Alert, AlertDescription } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Skeleton } from '~/components/ui/skeleton';
import { t } from '~/lib/i18n/en';
import { readVaultItem } from '~/lib/vault/item-read';

import { useVaultList, useVaultListInteraction } from '../vault-list.hooks';
import { ItemDetailDialog } from './item-detail-dialog';
import { VaultListRows } from './vault-list-rows';
import { VaultListToolbar } from './vault-list-toolbar';

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
        <Button className="min-h-11" asChild>
          <Link to="/app/new" prefetch="render">
            <PlusIcon aria-hidden="true" />
            {t('vault.newItem')}
          </Link>
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
      ) : flow.items.length === 0 && flow.status === 'ready' ? (
        <Card>
          <CardHeader>
            <CardTitle role="heading" aria-level={2}>
              {t('vault.empty.title')}
            </CardTitle>
            <CardDescription>{t('vault.empty.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="min-h-11" asChild>
              <Link to="/app/new" prefetch="render">
                <PlusIcon aria-hidden="true" />
                {t('vault.createFirst')}
              </Link>
            </Button>
          </CardContent>
        </Card>
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

      <ItemDetailDialog item={flow.detailItem} onClose={flow.closeDetail} onLoadSecrets={loadSecrets} />
    </section>
  );
};
