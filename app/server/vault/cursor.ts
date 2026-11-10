import { fromBase64Url, toBase64Url } from '../../lib/base64-url';

export type VaultCursor = { rev: number; id: string };

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const encodeVaultCursor = (cursor: VaultCursor): string =>
  toBase64Url(textEncoder.encode(JSON.stringify({ rev: cursor.rev, id: cursor.id })));

export const decodeVaultCursor = (value: string): VaultCursor | null => {
  if (!value || value.length > 256) return null;

  try {
    const parsed = JSON.parse(textDecoder.decode(fromBase64Url(value))) as {
      rev?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.rev !== 'number' ||
      !Number.isSafeInteger(parsed.rev) ||
      parsed.rev < 0 ||
      typeof parsed.id !== 'string' ||
      parsed.id.length < 1 ||
      parsed.id.length > 64
    ) {
      return null;
    }

    return { rev: parsed.rev, id: parsed.id };
  } catch {
    return null;
  }
};
