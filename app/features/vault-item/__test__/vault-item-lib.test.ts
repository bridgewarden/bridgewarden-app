import { describe, expect, it } from 'vitest';

import { MAX_ITEM_CIPHERTEXT_BASE64_LENGTH, MAX_ITEM_NOTE_BYTES } from '../../../lib/vault/limits';

import {
  withinCiphertextBudget,
  buildPayload,
  emptyValues,
  isValidTotpSecret,
  validateValues,
  valuesFromItem,
} from '../vault-item.lib';

describe('vault item editor helpers', () => {
  it('builds a trimmed login payload and omits empty fields', () => {
    const values = {
      ...emptyValues('login'),
      name: ' Example ',
      username: '',
      urls: ['https://example.com', ' '],
      customFields: [
        { label: ' PIN ', value: '1234', hidden: true },
        { label: '', value: '', hidden: false },
      ],
    };
    expect(buildPayload(values)).toEqual({
      type: 'login',
      name: 'Example',
      urls: ['https://example.com'],
      customFields: [{ label: 'PIN', value: '1234', hidden: true }],
    });
  });

  it('requires login username, password, and at least one URL', () => {
    const errors = validateValues({ ...emptyValues('login'), name: 'Example' });
    expect(errors).toHaveProperty('username');
    expect(errors).toHaveProperty('password');
    expect(errors).toHaveProperty('urls');
  });

  it('validates names, note size, TOTP, and custom fields', () => {
    expect(validateValues({ ...emptyValues(), name: ' ' })).toHaveProperty('name');
    expect(
      validateValues({ ...emptyValues('note'), name: 'Note', body: 'x'.repeat(MAX_ITEM_NOTE_BYTES + 1) }),
    ).toHaveProperty('body');
    expect(validateValues({ ...emptyValues(), name: 'Example', totpSecret: 'not base32!' })).toHaveProperty(
      'totpSecret',
    );
    expect(
      validateValues({
        ...emptyValues(),
        name: 'Example',
        customFields: [{ label: '', value: 'secret', hidden: false }],
      }),
    ).toHaveProperty('customFields');
    expect(isValidTotpSecret('jbsw y3dp ehpk 3pxp')).toBe(true);
    expect(isValidTotpSecret('otpauth://totp/x?secret=GEZDGNBVGY3TQOJQ&algorithm=SHA1&digits=6&period=30')).toBe(true);
    expect(isValidTotpSecret('otpauth://totp/x?secret=GEZDGNBVGY3TQOJQ&algorithm=SHA256')).toBe(false);
  });

  it('round-trips item payloads and rejects oversized ciphertext', () => {
    const values = valuesFromItem({
      id: 'id',
      type: 'login',
      folderId: null,
      favorite: false,
      rev: 1,
      createdAt: 1,
      updatedAt: 1,
      payload: { type: 'login', name: 'Example', password: 'secret' },
    });
    expect(values.password).toBe('secret');
    expect(withinCiphertextBudget('a'.repeat(MAX_ITEM_CIPHERTEXT_BASE64_LENGTH))).toBe(true);
    expect(withinCiphertextBudget('a'.repeat(MAX_ITEM_CIPHERTEXT_BASE64_LENGTH + 1))).toBe(false);
  });
});
