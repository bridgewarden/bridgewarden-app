import { describe, expect, it } from 'vitest';

import { parseFolderPayload, parseItemPayload } from '../item-payload';
import { MAX_ITEM_CUSTOM_FIELDS, MAX_ITEM_URLS, MAX_ITEM_NOTE_BYTES } from '../limits';

describe('vault item payloads', () => {
  it('accepts login and note payloads', () => {
    expect(
      parseItemPayload('login', {
        type: 'login',
        name: 'Example',
        username: 'me@example.com',
        password: 'secret',
        urls: ['https://example.com'],
        customFields: [{ label: 'PIN', value: '1234', hidden: true }],
      }),
    ).toMatchObject({ name: 'Example', username: 'me@example.com' });
    expect(parseItemPayload('note', { type: 'note', name: 'Recovery', body: 'text' })).toEqual({
      type: 'note',
      name: 'Recovery',
      body: 'text',
    });
    expect(parseFolderPayload({ name: 'Family' })).toEqual({ name: 'Family' });
  });

  it('rejects type mismatches, empty names, and unknown fields', () => {
    expect(parseItemPayload('login', { type: 'note', name: 'Wrong', body: 'x' })).toBeNull();
    expect(parseItemPayload('login', { type: 'login', name: '   ' })).toBeNull();
    expect(parseItemPayload('login', { type: 'login', name: 'Example', unknown: true })).toBeNull();
    expect(parseFolderPayload({ name: '' })).toBeNull();
  });

  it('enforces login list and note byte limits', () => {
    expect(
      parseItemPayload('login', {
        type: 'login',
        name: 'Example',
        urls: Array.from({ length: MAX_ITEM_URLS + 1 }, () => 'https://example.com'),
      }),
    ).toBeNull();
    expect(
      parseItemPayload('login', {
        type: 'login',
        name: 'Example',
        customFields: Array.from({ length: MAX_ITEM_CUSTOM_FIELDS + 1 }, (_, index) => ({
          label: `Field ${index}`,
          value: 'x',
          hidden: false,
        })),
      }),
    ).toBeNull();
    expect(
      parseItemPayload('note', { type: 'note', name: 'Big', body: 'x'.repeat(MAX_ITEM_NOTE_BYTES) }),
    ).not.toBeNull();
    expect(
      parseItemPayload('note', { type: 'note', name: 'Big', body: 'x'.repeat(MAX_ITEM_NOTE_BYTES + 1) }),
    ).toBeNull();
  });
});
