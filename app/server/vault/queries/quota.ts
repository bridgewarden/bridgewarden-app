import { MAX_ACTIVE_ITEMS, MAX_ITEM_BYTES, MAX_ITEM_ROWS } from '../types';

export const ITEM_QUOTA_SQL = `
    AND (SELECT COUNT(*) FROM vault_items WHERE user_id = ? AND deleted_at IS NULL) < ?
    AND (SELECT COUNT(*) FROM vault_items WHERE user_id = ?) < ?
    AND (SELECT COALESCE(SUM(LENGTH(data_ct)), 0) FROM vault_items WHERE user_id = ?) + ? <= ?`;

export const itemQuotaBind = (userId: string, newBytes: number): unknown[] => [
  userId,
  MAX_ACTIVE_ITEMS,
  userId,
  MAX_ITEM_ROWS,
  userId,
  newBytes,
  (MAX_ITEM_BYTES * 4) / 3,
];

export type ItemUsage = { active: number; rows: number; bytes: number };

export const exceedsItemQuota = (usage: ItemUsage, newBytes: number, replacedBytes = 0): boolean =>
  usage.active >= MAX_ACTIVE_ITEMS ||
  usage.rows >= MAX_ITEM_ROWS ||
  usage.bytes - replacedBytes + newBytes > (MAX_ITEM_BYTES * 4) / 3;
