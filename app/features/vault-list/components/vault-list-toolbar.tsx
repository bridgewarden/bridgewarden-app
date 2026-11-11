import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { NativeSelect, NativeSelectOption } from '~/components/ui/native-select';
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
      <NativeSelect
        id="vault-type-filter"
        className="min-h-11"
        wrapperClassName="w-full"
        value={filters.type}
        onChange={(event) => onChange({ type: event.target.value as VaultListFilters['type'] })}
      >
        <NativeSelectOption value="all">{t('vault.type.all')}</NativeSelectOption>
        <NativeSelectOption value="login">{t('vault.type.login')}</NativeSelectOption>
        <NativeSelectOption value="note">{t('vault.type.note')}</NativeSelectOption>
      </NativeSelect>
    </div>

    <div className="space-y-1">
      <Label htmlFor="vault-folder-filter">{t('vault.folder')}</Label>
      <NativeSelect
        id="vault-folder-filter"
        className="min-h-11"
        wrapperClassName="w-full"
        value={filters.folderId}
        onChange={(event) => onChange({ folderId: event.target.value })}
      >
        <NativeSelectOption value="all">{t('vault.folder.all')}</NativeSelectOption>
        <NativeSelectOption value="none">{t('vault.folder.none')}</NativeSelectOption>
        {folders.map((folder) => (
          <NativeSelectOption key={folder.id} value={folder.id}>
            {folder.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>

    <div className="space-y-1">
      <Label htmlFor="vault-sort">{t('vault.sort')}</Label>
      <NativeSelect
        id="vault-sort"
        className="min-h-11"
        wrapperClassName="w-full"
        value={filters.sort}
        onChange={(event) => onChange({ sort: event.target.value as VaultListFilters['sort'] })}
      >
        <NativeSelectOption value="name">{t('vault.sort.name')}</NativeSelectOption>
        <NativeSelectOption value="updated">{t('vault.sort.updated')}</NativeSelectOption>
      </NativeSelect>
    </div>

    <div className="flex min-h-11 items-center gap-3 sm:col-span-2 lg:col-span-1 lg:self-end">
      <Checkbox
        id="vault-favorite-filter"
        className="size-6"
        checked={filters.favorite}
        onCheckedChange={(checked) => onChange({ favorite: checked === true })}
      />
      <Label htmlFor="vault-favorite-filter">{t('vault.favoriteOnly')}</Label>
    </div>
  </div>
);
