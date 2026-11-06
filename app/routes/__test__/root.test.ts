import { describe, expect, it } from 'vitest';

import { loader } from '../../root';

const load = (cookie?: string) =>
  loader({
    request: new Request('http://localhost/', cookie ? { headers: { cookie } } : undefined),
  } as never);

describe('root loader', () => {
  it('returns the theme from the cookie', () => {
    expect(load('bw_theme=dark')).toEqual({ theme: 'dark' });
    expect(load('bw_theme=light')).toEqual({ theme: 'light' });
  });

  it('defaults to system without a cookie', () => {
    expect(load()).toEqual({ theme: 'system' });
  });

  it('ignores a malformed cookie instead of failing the request', () => {
    expect(load('bw_theme=%E0%A4%A')).toEqual({ theme: 'system' });
  });
});
