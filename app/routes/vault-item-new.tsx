import VaultItem from '~/features/vault-item';
import { t } from '~/lib/i18n/en';

export const meta = () => [{ title: t('vaultItem.title.create') }];

export default function VaultItemNewRoute() {
  return <VaultItem itemId="new" />;
}
