import { describe, expect, it } from 'vitest';

import { decodeBase64, encodeBase64 } from '../encoding';
import { openItem, sealItem, type SealedEnvelope } from '../envelope';
import { InvalidPayloadError, MalformedEnvelopeError, UnsupportedEnvelopeError } from '../errors';
import { fromHex, mutateBase64Byte, randomKey } from './helpers';

const VECTOR_KEY = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
const ITEM = { kind: 'item', id: 'item-1', type: 'login' } as const;
const FOLDER = { kind: 'folder', id: 'folder-1' } as const;
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

    const envelope = await sealItem(payload, vaultKey, ITEM);

    await expect(openItem(envelope, vaultKey, ITEM)).resolves.toEqual(payload);
  });

  it('rejects a single altered ciphertext or IV byte', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey, ITEM);
    const alteredCiphertext = { ...envelope, ct: mutateBase64Byte(envelope.ct) };
    const alteredIv = { ...envelope, iv: mutateBase64Byte(envelope.iv) };

    await expect(openItem(alteredCiphertext, vaultKey, ITEM)).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem(alteredIv, vaultKey, ITEM)).rejects.toThrow(MalformedEnvelopeError);
  });

  it('rejects a truncated ciphertext or IV', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey, ITEM);
    const truncatedCiphertext = {
      ...envelope,
      ct: encodeBase64(decodeBase64(envelope.ct).slice(0, -1)),
    };

    await expect(openItem(truncatedCiphertext, vaultKey, ITEM)).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem({ ...envelope, iv: 'AA==' }, vaultKey, ITEM)).rejects.toThrow(MalformedEnvelopeError);
  });

  it('rejects an unknown version or algorithm', async () => {
    const vaultKey = randomKey();
    const envelope = await sealItem({ name: 'Example' }, vaultKey, ITEM);

    await expect(openItem({ ...envelope, v: 3 } as unknown as SealedEnvelope, vaultKey)).rejects.toThrow(
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

    await expect(sealItem(undefined, vaultKey, ITEM)).rejects.toThrow(InvalidPayloadError);
    await expect(sealItem(cyclic, vaultKey, ITEM)).rejects.toThrow(InvalidPayloadError);
  });

  it('rejects a wrong vault key', async () => {
    const envelope = await sealItem({ name: 'Example' }, randomKey(), ITEM);

    await expect(openItem(envelope, randomKey(), ITEM)).rejects.toThrow(MalformedEnvelopeError);
  });

  it('binds v2 ciphertext to its row context', async () => {
    const vaultKey = randomKey();
    const item = await sealItem({ name: 'Example' }, vaultKey, ITEM);
    const folder = await sealItem({ name: 'Family' }, vaultKey, FOLDER);

    await expect(openItem(item, vaultKey, ITEM)).resolves.toEqual({ name: 'Example' });
    await expect(openItem(folder, vaultKey, FOLDER)).resolves.toEqual({ name: 'Family' });
    await expect(openItem(item, vaultKey, { ...ITEM, id: 'item-2' })).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem(item, vaultKey, { ...ITEM, type: 'note' })).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem(item, vaultKey, FOLDER)).rejects.toThrow(MalformedEnvelopeError);
    await expect(openItem(item, vaultKey)).rejects.toThrow(MalformedEnvelopeError);
    expect(item.v).toBe(2);
  });

  it('uses a fresh IV per seal', async () => {
    const vaultKey = randomKey();

    const first = await sealItem({ name: 'Example' }, vaultKey, ITEM);
    const second = await sealItem({ name: 'Example' }, vaultKey, ITEM);

    expect(first.iv).not.toBe(second.iv);
  });
});
