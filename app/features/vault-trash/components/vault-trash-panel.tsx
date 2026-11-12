import { useEffect, useRef, useState } from 'react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { EmptyState } from '~/components/empty-state';
import { InlineError } from '~/components/inline-error';
import { SkeletonList } from '~/components/skeleton-list';
import { t } from '~/lib/i18n/en';
import type { TrashedItem } from '~/lib/vault/projection';

import { useVaultTrash } from '../vault-trash.hooks';
import { PurgeDialog } from './purge-dialog';
import { TrashRow } from './trash-row';

export const VaultTrashPanel = () => {
  const flow = useVaultTrash();
  const [selected, setSelected] = useState<{ item: TrashedItem; requiresName: boolean } | null>(null);
  const [typedName, setTypedName] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousCount = useRef(flow.items.length);

  useEffect(() => {
    if (previousCount.current > 0 && flow.items.length === 0) headingRef.current?.focus();
    previousCount.current = flow.items.length;
  }, [flow.items.length]);

  const focusNext = () => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-trash-action]')?.focus();
      if (!document.querySelector('[data-trash-row]')) headingRef.current?.focus();
    });
  };

  const closePurge = () => {
    setSelected(null);
    setTypedName('');
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold">
            {t('trash.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('trash.description')}</p>
        </div>
        <Badge variant="secondary">{t('trash.count', { count: flow.items.length })}</Badge>
      </div>

      {flow.status === 'error' ? (
        <InlineError
          message={flow.error ?? t('vault.syncError')}
          action={
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void flow.retry()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}
      {flow.status === 'loading' ? <SkeletonList label={t('trash.loading')} /> : null}
      {flow.status === 'ready' && flow.items.length === 0 ? (
        <EmptyState title={t('trash.empty.title')} description={t('trash.empty.description')} />
      ) : null}
      {flow.items.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <CardContent className="p-0">
            <ul className="divide-y">
              {flow.items.map((item) => (
                <TrashRow
                  key={item.id}
                  item={item}
                  busy={flow.restoringId === item.id || flow.purgingId === item.id}
                  onRestore={() => void flow.restore(item).then((done) => done && focusNext())}
                  onPurge={() => {
                    setTypedName('');
                    setSelected({ item, requiresName: flow.items.length > 5 });
                  }}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <PurgeDialog
        selected={selected}
        typedName={typedName}
        busy={flow.purgingId !== null}
        onTypedName={setTypedName}
        onClose={closePurge}
        onConfirm={() => {
          if (selected) void flow.purge(selected.item).then((done) => done && focusNext());
          closePurge();
        }}
      />
    </section>
  );
};
