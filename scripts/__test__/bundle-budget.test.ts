import { describe, expect, it } from 'vitest';

import { closure } from '../check-bundle-budget';

describe('bundle budget graph', () => {
  it('walks static imports without revisiting chunks', () => {
    const manifest = {
      entry: { file: 'assets/entry.js', imports: ['shared', 'route'] },
      shared: { file: 'assets/shared.js', imports: ['runtime'] },
      runtime: { file: 'assets/runtime.js' },
      route: { file: 'assets/route.js', imports: ['shared'] },
      lazy: { file: 'assets/lazy.js' },
    };

    expect([...closure(manifest, ['entry'])]).toEqual(['entry', 'shared', 'runtime', 'route']);
  });
});
