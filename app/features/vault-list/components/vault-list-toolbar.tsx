import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { t } from '~/lib/i18n/en';
import type { DecryptedFolder } from '~/lib/vault/projection';

import type { VaultListFilters } from '../vault-list.lib';

type VaultListToolbarProps = {
  filters: VaultListFilters;
  folders: DecryptedFolder[];
  onChange: (patch: Partial<VaultListFilters>) => void;
};

export const VaultListToolbar = ({ filters, folders, onChange }: VaultListToolbarProps) => (
  <div role="group" aria-label={t('vault.filters')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <div className="space-y-1">
      <Label htmlFor="vault-type-filter">{t('vault.type')}</Label>
      <Select value={filters.type} onValueChange={(value) => onChange({ type: value as VaultListFilters['type'] })}>
        <SelectTrigger id="vault-type-filter" className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="all">{t('vault.type.all')}</SelectItem>
          <SelectItem value="login">{t('vault.type.login')}</SelectItem>
          <SelectItem value="note">{t('vault.type.note')}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1">
      <Label htmlFor="vault-folder-filter">{t('vault.folder')}</Label>
      <Select value={filters.folderId} onValueChange={(folderId) => onChange({ folderId })}>
        <SelectTrigger id="vault-folder-filter" className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="all">{t('vault.folder.all')}</SelectItem>
          <SelectItem value="none">{t('vault.folder.none')}</SelectItem>
          {folders.map((folder) => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1">
      <Label htmlFor="vault-sort">{t('vault.sort')}</Label>
      <Select value={filters.sort} onValueChange={(sort) => onChange({ sort: sort as VaultListFilters['sort'] })}>
        <SelectTrigger id="vault-sort" className="min-h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="name">{t('vault.sort.name')}</SelectItem>
          <SelectItem value="updated">{t('vault.sort.updated')}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div className="space-y-1 sm:col-span-2 lg:col-span-1">
      <span className="text-sm font-medium">{t('vault.favorite')}</span>
      <div className="flex min-h-11 items-center gap-3 rounded-md border border-input px-3">
        <Checkbox
          id="vault-favorite-filter"
          className="size-6"
          checked={filters.favorite}
          onCheckedChange={(checked) => onChange({ favorite: checked === true })}
        />
        <Label htmlFor="vault-favorite-filter" className="font-normal text-muted-foreground">
          {t('vault.favoriteOnly')}
        </Label>
      </div>
    </div>
  </div>
);
