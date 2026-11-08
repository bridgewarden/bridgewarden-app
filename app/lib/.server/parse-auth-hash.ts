import { fromBase64Url } from '../base64-url';
import { KEY_BYTES } from '../crypto/contract';

export const parseAuthHash = (value: string): Uint8Array | null => {
  try {
    const bytes = fromBase64Url(value);
    return bytes.length === KEY_BYTES ? bytes : null;
  } catch {
    return null;
  }
};
