import { storedToStandardBase64 } from '../base64-url';
import { ENVELOPE_ALGORITHM } from '../crypto/contract';
import type { SealedEnvelope } from '../crypto/envelope';

export const cachedEnvelope = (ciphertext: string, iv: string, version: number): SealedEnvelope => ({
  v: version as SealedEnvelope['v'],
  alg: ENVELOPE_ALGORITHM,
  ct: storedToStandardBase64(ciphertext),
  iv: storedToStandardBase64(iv),
});
