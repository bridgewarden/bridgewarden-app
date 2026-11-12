import { describe, expect, it } from 'vitest';

import { renderServiceWorker } from '../generate-service-worker';

describe('service worker generation', () => {
  it('injects the version and hashed shell assets', () => {
    const output = renderServiceWorker(
      "const VERSION = '__VERSION__';\nconst BUILD_ASSETS = [];\n",
      ['/assets/app.js', '/offline'],
      'abc123',
    );

    expect(output).toContain('const VERSION = "abc123";');
    expect(output).toContain('"/assets/app.js"');
    expect(output).toContain('"/offline"');
    expect(output).not.toContain('__VERSION__');
  });
});
