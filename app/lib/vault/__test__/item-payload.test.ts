import { describe, expect, it } from 'vitest';

import { parseFolderPayload, parseItemPayload } from '../item-payload';

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
});
