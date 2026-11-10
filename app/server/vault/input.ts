import { z } from 'zod';

import { fromBase64Url } from '../../lib/base64-url';
import { IV_BYTES } from '../../lib/crypto/contract';
import { encodeBase64 } from '../../lib/crypto/encoding';
import type { VaultItemInput } from './types';

const MAX_CIPHERTEXT_BYTES = 64 * 1024;

const base64UrlField = z.string().min(1).max(90_000);

const itemSchema = z.strictObject({
  type: z.enum(['login', 'note']),
  folderId: z.string().min(1).max(64).nullable().optional(),
  favorite: z.boolean(),
  dataCt: base64UrlField,
  dataIv: base64UrlField,
  dataVersion: z.number().int().min(1),
});

const updateSchema = itemSchema.extend({ rev: z.number().int().min(0) });

const decodeCiphertext = (value: string): string | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length > 0 && bytes.length <= MAX_CIPHERTEXT_BYTES ? encodeBase64(bytes) : null;
  } catch {
    return null;
  }
};

const decodeIv = (value: string): string | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length === IV_BYTES ? encodeBase64(bytes) : null;
  } catch {
    return null;
  }
};

const decodeItem = (data: z.infer<typeof itemSchema>): VaultItemInput | null => {
  const dataCt = decodeCiphertext(data.dataCt);
  const dataIv = decodeIv(data.dataIv);
  if (!dataCt || !dataIv) return null;

  return {
    type: data.type,
    folderId: data.folderId ?? null,
    favorite: data.favorite,
    dataCt,
    dataIv,
    dataVersion: data.dataVersion,
  };
};

export const parseCreateItemInput = (value: unknown): VaultItemInput | null => {
  const parsed = itemSchema.safeParse(value);
  return parsed.success ? decodeItem(parsed.data) : null;
};

export const parseUpdateItemInput = (value: unknown): (VaultItemInput & { rev: number }) | null => {
  const parsed = updateSchema.safeParse(value);
  if (!parsed.success) return null;

  const { rev, ...itemValue } = parsed.data;
  const item = decodeItem(itemValue);
  return item ? { ...item, rev } : null;
};

export const isVaultId = (value: string): boolean => value.length > 0 && value.length <= 64;
