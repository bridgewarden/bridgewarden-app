import { encodeVaultCursor, type VaultCursor } from './cursor';
import { createVaultQueries } from './queries';
import { VAULT_PAGE_SIZE, type VaultDeltaRow } from './queries/sync';
import { splitDelta, type VaultFolderResponse, type VaultItemResponse } from './transport';

const MAX_PAGE_BYTES = 4 * 1024 * 1024;

export type VaultDeltaResult =
  | {
      status: 'ok';
      serverRev: number;
      items: VaultItemResponse[];
      folders: VaultFolderResponse[];
      nextCursor?: string;
    }
  | { status: 'not-found' };

export const readVaultDelta = async (
  env: Env,
  userId: string,
  since: number,
  cursor: VaultCursor | null,
): Promise<VaultDeltaResult> => {
  const vault = createVaultQueries(env);
  const rev = await vault.findVaultRev(userId);
  if (!rev) return { status: 'not-found' };

  const rows = await vault.listVaultDelta(userId, since, cursor, VAULT_PAGE_SIZE);
  const page: VaultDeltaRow[] = [];
  let bytes = 0;

  for (const row of rows) {
    if (page.length === VAULT_PAGE_SIZE) break;
    const rowBytes = row.kind === 'item' ? row.data_ct.length : row.name_ct.length;
    if (page.length > 0 && bytes + rowBytes > MAX_PAGE_BYTES) break;
    page.push(row);
    bytes += rowBytes;
  }

  const last = page.at(-1);
  const truncated = page.length < rows.length;
  const { items, folders } = splitDelta(page);

  return {
    status: 'ok',
    serverRev: rev.vault_rev,
    items,
    folders,
    ...(truncated && last ? { nextCursor: encodeVaultCursor({ rev: last.rev, id: last.id }) } : {}),
  };
};
