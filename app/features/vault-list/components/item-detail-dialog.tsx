import { useEffect, useState } from 'react';

import { Dialog, DialogContent } from '~/components/ui/dialog';
import type { DecryptedItem } from '~/lib/vault/projection';

import { ItemDetailContent } from './item-detail-content';

type ItemDetailDialogProps = {
  item: DecryptedItem | null;
  onClose: () => void;
  onLoadSecrets: (id: string) => Promise<{ password: string | null; totpSecret: string | null }>;
};

export const ItemDetailDialog = ({ item, onClose, onLoadSecrets }: ItemDetailDialogProps) => {
  const [shown, setShown] = useState<DecryptedItem | null>(item);

  if (item && (item.id !== shown?.id || item.rev !== shown.rev)) {
    setShown(item);
  }

  useEffect(() => {
    if (item) return;
    const timer = window.setTimeout(() => setShown(null), 250);
    return () => window.clearTimeout(timer);
  }, [item]);

  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        {shown ? (
          <ItemDetailContent
            key={`${shown.id}:${shown.rev}`}
            item={shown}
            onClose={onClose}
            onLoadSecrets={onLoadSecrets}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
