import { ChevronRightIcon, FileTextIcon, KeyRoundIcon, StarIcon } from 'lucide-react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { t } from '~/lib/i18n/en';
import type { DecryptedItem } from '~/lib/vault/projection';

type VaultListRowsProps = {
  items: DecryptedItem[];
  activeIndex: number;
  onOpen: (id: string) => void;
  onActivate: (index: number) => void;
};

export const VaultListRows = ({ items, activeIndex, onOpen, onActivate }: VaultListRowsProps) => (
  <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
    {items.map((item, index) => (
      <li key={item.id}>
        <Button
          type="button"
          data-vault-item={item.id}
          variant="ghost"
          aria-current={index === activeIndex ? 'true' : undefined}
          tabIndex={index === activeIndex ? 0 : -1}
          data-active={index === activeIndex}
          className="h-auto min-h-16 w-full justify-start gap-3 rounded-none px-4 py-3 text-left hover:bg-muted/60 data-[active=true]:bg-muted/70"
          onClick={() => {
            onActivate(index);
            onOpen(item.id);
          }}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground">
            {item.type === 'login' ? (
              <KeyRoundIcon className="size-5" aria-hidden="true" />
            ) : (
              <FileTextIcon className="size-5" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-medium">
              <span className="truncate">{item.name}</span>
              {item.favorite ? (
                <StarIcon className="size-3.5 shrink-0 fill-current" role="img" aria-label={t('vault.favorite')} />
              ) : null}
            </span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              {item.type === 'login' ? (item.username ?? t('vault.type.login')) : t('vault.type.note')}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {item.folderName ? (
              <Badge variant="outline" className="hidden max-w-32 truncate sm:inline-flex">
                {item.folderName}
              </Badge>
            ) : null}
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          </span>
        </Button>
      </li>
    ))}
  </ul>
);
