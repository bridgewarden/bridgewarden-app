import { describe, expect, it } from 'vitest';

import { safeNextPath } from '../next-path';

describe('safe next path', () => {
  it('accepts same-origin paths and preserves query and hash', () => {
    expect(safeNextPath('/app/trash?x=1#top')).toBe('/app/trash?x=1#top');
    expect(safeNextPath('/app')).toBe('/app');
  });

  it('rejects missing, protocol-relative, foreign, and backslash targets', () => {
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
    expect(safeNextPath('//evil.example')).toBe('/app');
    expect(safeNextPath('https://evil.example')).toBe('/app');
    expect(safeNextPath('/\\evil.example')).toBe('/app');
  });
});
