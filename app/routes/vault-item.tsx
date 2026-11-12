import type { Route } from './+types/vault-item';
import VaultItem from '~/features/vault-item';
import { t } from '~/lib/i18n/en';

export const meta = () => [{ title: t('vault.title') }];

export default function VaultItemRoute({ params }: Route.ComponentProps) {
  return <VaultItem itemId={params.itemId} />;
}
