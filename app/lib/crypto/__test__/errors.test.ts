import { describe, expect, it } from 'vitest';

import { decodeBase64 } from '../encoding';
import { openItem, sealItem } from '../envelope';
import {
  CryptoError,
  InvalidEncodingError,
  InvalidRecoveryKeyError,
  MalformedEnvelopeError,
  WrongPasswordError,
} from '../errors';
import { parseRecoveryKey } from '../recovery';
import { generateVaultKey, unwrapVaultKey, wrapVaultKey } from '../vault-key';
import { mutateBase64Byte, randomKey } from './helpers';

const capture = async (action: () => unknown): Promise<Error> => {
  try {
    await action();
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected the action to throw');
};

describe('crypto errors', () => {
  it('are typed, carry no cause, and leak no inputs', async () => {
    const key = randomKey();
    const wrapKey = randomKey();
    const wrapped = await wrapVaultKey(generateVaultKey(), wrapKey);
    const sealed = await sealItem({ name: 'Example' }, key, { kind: 'item', id: 'item-1', type: 'login' });
    const tampered = { ...sealed, ct: mutateBase64Byte(sealed.ct) };

    const errors = [
      await capture(() => unwrapVaultKey(wrapped, randomKey())),
      await capture(() => openItem(tampered, key, { kind: 'item', id: 'item-1', type: 'login' })),
      await capture(() => parseRecoveryKey('BAD')),
      await capture(() => decodeBase64('!!!!')),
    ];

    expect(errors[0]).toBeInstanceOf(WrongPasswordError);
    expect(errors[1]).toBeInstanceOf(MalformedEnvelopeError);
    expect(errors[2]).toBeInstanceOf(InvalidRecoveryKeyError);
    expect(errors[3]).toBeInstanceOf(InvalidEncodingError);

    for (const error of errors) {
      expect(error).toBeInstanceOf(CryptoError);
      expect(error.cause).toBeUndefined();
      expect(Object.getOwnPropertyNames(error).sort()).toEqual(['message', 'name', 'stack']);
    }
  });
});
