import { Badge } from '~/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { t } from '~/lib/i18n/en';
import type { DecryptedItem } from '~/lib/vault/projection';

type ItemDetailDialogProps = {
  item: DecryptedItem | null;
  onClose: () => void;
};

const text = (value: string | null) => value || t('vault.detail.none');

export const ItemDetailDialog = ({ item, onClose }: ItemDetailDialogProps) => (
  <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
    <DialogContent>
      {item ? (
        <>
          <DialogHeader>
            <DialogTitle>{item.name}</DialogTitle>
            <DialogDescription>
              {t(item.type === 'login' ? 'vault.type.login' : 'vault.type.note')}
              {item.folderName ? ` · ${item.folderName}` : ''}
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="font-medium">{t('vault.detail.username')}</dt>
              <dd>{item.type === 'login' ? text(item.username) : t('vault.detail.none')}</dd>
            </div>
            {item.type === 'login' ? (
              <>
                <div>
                  <dt className="font-medium">{t('vault.detail.urls')}</dt>
                  <dd className="break-all">{item.urls.length > 0 ? item.urls.join(', ') : t('vault.detail.none')}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t('vault.detail.notes')}</dt>
                  <dd className="whitespace-pre-wrap">{text(item.notes)}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt className="font-medium">{t('vault.detail.body')}</dt>
                <dd className="whitespace-pre-wrap">{text(item.body)}</dd>
              </div>
            )}
            <div>
              <dt className="font-medium">{t('vault.folder')}</dt>
              <dd>{item.folderName ?? t('vault.folder.none')}</dd>
            </div>
            <div>
              <dt className="font-medium">{t('vault.favorite')}</dt>
              <dd>{item.favorite ? <Badge>{t('vault.favorite')}</Badge> : t('vault.detail.none')}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted-foreground">{t('vault.detail.readOnly')}</p>
        </>
      ) : null}
    </DialogContent>
  </Dialog>
);
