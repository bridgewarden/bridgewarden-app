import { describe, expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from '../encoding';
import { openItem, sealItem, type SealedEnvelope } from '../envelope';
import { InvalidPayloadError, MalformedEnvelopeError, UnsupportedEnvelopeError } from '../errors';
import { fromHex, mutateBase64Byte, randomKey } from './helpers';

const VECTOR_KEY = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
const VECTOR_ENVELOPE: SealedEnvelope = {
  v: 1,
  alg: 'A256GCM',
  iv: 'MDEyMzQ1Njc4OTo7',
  ct: 'yBdfoYQKaDkIReuPZvZMSuFiuA1Q2/w0YRn4lo3Thl7r',
};

describe('item envelope', () => {
  it('opens a fixed AES-256-GCM vector generated with Node/OpenSSL', async () => {
    await expect(openItem(VECTOR_ENVELOPE, VECTOR_KEY)).resolves.toEqual({ name: 'vector' });
  });

  it('round-trips a payload', async () => {
    const vaultKey = randomKey();
    const payload = { type: 'login', name: 'Example', username: 'user', password: 'secret' };

    const envelope = await sealItem(payload, vaultKey);

    await expect(openItem(envelope, vaultKey)).resolves.toEqual(payload);
  });

  it('rejects a single altered ciphertext or IV byte', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey);
    const alteredCiphertext = { ...envelope, ct: mutateBase64Byte(envelope.ct) };
    const alteredIv = { ...envelope, iv: mutateBase64Byte(envelope.iv) };

    await expect(openItem(alteredCiphertext, vaultKey)).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem(alteredIv, vaultKey)).rejects.toThrow(MalformedEnvelopeError);
  });

  it('rejects a truncated ciphertext or IV', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey);
    const truncatedCiphertext = {
      ...envelope,
      ct: encodeBase64(decodeBase64(envelope.ct).slice(0, -1)),
    };

    await expect(openItem(truncatedCiphertext, vaultKey)).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem({ ...envelope, iv: 'AA==' }, vaultKey)).rejects.toThrow(MalformedEnvelopeError);
  });

  it('rejects an unknown version or algorithm', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey);

    await expect(openItem({ ...envelope, v: 2 } as unknown as SealedEnvelope, vaultKey)).rejects.toThrow(
      UnsupportedEnvelopeError,
    );
    await expect(openItem({ ...envelope, alg: 'A128GCM' } as unknown as SealedEnvelope, vaultKey)).rejects.toThrow(
      UnsupportedEnvelopeError,
    );
  });

  it('rejects a non-JSON or cyclic payload', async () => {
    const vaultKey = randomKey();
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;

    await expect(sealItem(undefined, vaultKey)).rejects.toThrow(InvalidPayloadError);
    await expect(sealItem(cyclic, vaultKey)).rejects.toThrow(InvalidPayloadError);
  });

  it('rejects a wrong vault key', async () => {
    const envelope = await sealItem({ name: 'Example' }, randomKey());

    await expect(openItem(envelope, randomKey())).rejects.toThrow(MalformedEnvelopeError);
  });

  it('uses a fresh IV per seal', async () => {
    const vaultKey = randomKey();

    const first = await sealItem({ name: 'Example' }, vaultKey);
    const second = await sealItem({ name: 'Example' }, vaultKey);

    expect(first.iv).not.toBe(second.iv);
  });
});
