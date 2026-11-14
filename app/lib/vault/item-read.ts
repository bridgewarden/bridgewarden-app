import { openItem } from '../crypto/envelope';
import { parseItemPayload, type ItemPayload } from './item-payload';
import { getVaultKey } from './key-store';
import { openVaultDb } from './local-db';
import { cachedEnvelope } from './sealed-envelope';

export type DecryptedItemDetail = {
  id: string;
  type: 'login' | 'note';
  folderId: string | null;
  favorite: boolean;
  rev: number;
  createdAt: number;
  updatedAt: number;
  payload: ItemPayload;
};

export type ReadVaultItemResult =
  { status: 'ok'; item: DecryptedItemDetail } | { status: 'locked' } | { status: 'not-found' } | { status: 'invalid' };

export const readVaultItem = async (id: string): Promise<ReadVaultItemResult> => {
  const key = getVaultKey();
  if (!key) return { status: 'locked' };

  try {
    const db = await openVaultDb();
    const row = await db.get('items', id);
    if (!row || row.deletedAt !== null) return { status: 'not-found' };

    const payload = parseItemPayload(
      row.type,
      await openItem(cachedEnvelope(row.dataCt, row.dataIv, row.dataVersion), key, {
        kind: 'item',
        id: row.id,
        type: row.type,
      }),
    );
    if (!payload) return { status: 'invalid' };

    return {
      status: 'ok',
      item: {
        id: row.id,
        type: row.type,
        folderId: row.folderId,
        favorite: row.favorite,
        rev: row.rev,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        payload,
      },
    };
  } catch {
    return { status: 'invalid' };
  } finally {
    key.fill(0);
  }
};
