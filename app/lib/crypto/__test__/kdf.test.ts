import { describe, expect, it } from 'vitest';

import { DEFAULT_KDF_ITERATIONS, HKDF_INFO } from '../contract';
import { encodeBase64 } from '../encoding';
import { InvalidKdfParamsError } from '../errors';
import { deriveAuthHash, deriveHkdfBits, deriveMasterKey, deriveWrapKey } from '../kdf';
import { fromHex, toHex } from './helpers';

const SALT = 'EBESExQVFhcYGRobHB0eHw==';
const MASTER_KEY = fromHex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
const RECOVERY_SECRET = fromHex('202122232425262728292a2b2c2d2e2f');

describe('master key derivation', () => {
  it('matches a PBKDF2-SHA256 600k reference vector', async () => {
    // Generated with Node 24 crypto.pbkdf2Sync('passwd', 16-byte salt, 600000, 32, 'sha256').
    const key = await deriveMasterKey('passwd', SALT);

    expect(toHex(key)).toBe('5196a929bd5d9a88222d89fc2dc7f9e263c8e5cb51ca8c562e66ffc6c963224c');
  });

  it('is deterministic and normalizes compatibility characters with NFKC', async () => {
    const first = await deriveMasterKey('correct horse', SALT);
    const second = await deriveMasterKey('correct horse', SALT);
    const ligature = await deriveMasterKey('\uFB01', SALT);
    const plain = await deriveMasterKey('fi', SALT);

    expect(toHex(first)).toBe(toHex(second));
    expect(toHex(ligature)).toBe(toHex(plain));
  });

  it('changes with the iteration count', async () => {
    const next = await deriveMasterKey('password', SALT, DEFAULT_KDF_ITERATIONS + 1);

    expect(toHex(await deriveMasterKey('password', SALT))).not.toBe(toHex(next));
  });

  it('rejects unsafe iteration counts and short salts', async () => {
    await expect(deriveMasterKey('password', SALT, 1)).rejects.toThrow(InvalidKdfParamsError);
    await expect(deriveMasterKey('password', SALT, 0)).rejects.toThrow(InvalidKdfParamsError);
    await expect(deriveMasterKey('password', SALT, 1.5)).rejects.toThrow(InvalidKdfParamsError);
    await expect(deriveMasterKey('password', encodeBase64(new Uint8Array(4)))).rejects.toThrow(InvalidKdfParamsError);
  });
});

describe('HKDF derivation', () => {
  it('matches RFC 5869 test case 3 for the first 32 bytes', async () => {
    const output = await deriveHkdfBits(fromHex('0b'.repeat(22)), '');

    expect(toHex(output)).toBe('8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d');
  });

  it('pins the permanent auth, wrap, and recovery domains', async () => {
    const auth = await deriveAuthHash(MASTER_KEY);
    const wrap = await deriveWrapKey(MASTER_KEY, SALT);
    const recovery = await deriveHkdfBits(RECOVERY_SECRET, HKDF_INFO.recovery);

    expect(toHex(auth)).toBe('97be7494ded094e649c344c1a22f0fddbf810bedeea27238cc83302925415e40');
    expect(toHex(wrap)).toBe('7de87b80fe0074d6e2add582927be94c2e733697909879ce3947670f16921567');
    expect(toHex(recovery)).toBe('03f5af64d18f34253080fd49c67671455d2246a00e3ce80acbed92fcd2ec65a2');
  });

  it('rejects empty input key material', async () => {
    await expect(deriveHkdfBits(new Uint8Array(0), 'bw-auth')).rejects.toThrow();
  });
});
