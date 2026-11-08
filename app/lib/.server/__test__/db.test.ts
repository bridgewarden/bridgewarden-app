import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { getDatabase } from '../db';

describe('database handle', () => {
  it('returns the DB binding', () => {
    expect(getDatabase(env)).toBe(env.DB);
  });
});
