import { z } from 'zod';

import { fromBase64Url } from '../../lib/base64-url';
import { IV_BYTES } from '../../lib/crypto/contract';
import { encodeBase64 } from '../../lib/crypto/encoding';
import { MAX_FOLDER_CIPHERTEXT_BYTES, type VaultFolderInput, type VaultItemInput } from './types';

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

const restoreSchema = z.strictObject({});

const purgeSchema = z.strictObject({ confirm: z.literal(true) });

export const parseRestoreInput = (value: unknown): boolean => restoreSchema.safeParse(value).success;

export const parsePurgeInput = (value: unknown): boolean => purgeSchema.safeParse(value).success;

const folderSchema = z.strictObject({
  nameCt: base64UrlField,
  nameIv: base64UrlField,
  dataVersion: z.number().int().min(1),
});

const folderRenameSchema = folderSchema.extend({ rev: z.number().int().min(0) });

const decodeFolderCiphertext = (value: string): string | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length > 0 && bytes.length <= MAX_FOLDER_CIPHERTEXT_BYTES ? encodeBase64(bytes) : null;
  } catch {
    return null;
  }
};

const decodeFolder = (data: z.infer<typeof folderSchema>): VaultFolderInput | null => {
  const nameCt = decodeFolderCiphertext(data.nameCt);
  const nameIv = decodeIv(data.nameIv);
  return nameCt && nameIv ? { nameCt, nameIv, dataVersion: data.dataVersion } : null;
};

export const parseCreateFolderInput = (value: unknown): VaultFolderInput | null => {
  const parsed = folderSchema.safeParse(value);
  return parsed.success ? decodeFolder(parsed.data) : null;
};

export const parseRenameFolderInput = (value: unknown): (VaultFolderInput & { rev: number }) | null => {
  const parsed = folderRenameSchema.safeParse(value);
  if (!parsed.success) return null;
  const { rev, ...folder } = parsed.data;
  const decoded = decodeFolder(folder);
  return decoded ? { ...decoded, rev } : null;
};

export const isVaultId = (value: string): boolean => value.length > 0 && value.length <= 64;
