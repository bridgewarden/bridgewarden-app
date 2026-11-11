import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { stripBuildSecrets } from '../strip-build-secrets';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('build secret gate', () => {
  it('removes secret-bearing files and keeps ordinary output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bw-build-'));
    roots.push(root);
    await mkdir(join(root, 'server'), { recursive: true });
    await writeFile(join(root, 'server', 'index.js'), 'ok');
    await writeFile(join(root, 'server', '.dev.vars'), 'SESSION_SECRET=secret');
    await writeFile(join(root, '.env.local'), 'AUTH_PEPPER=secret');
    await writeFile(join(root, '.dev.vars.production'), 'TOTP_ENC_KEY=secret');
    await writeFile(join(root, 'README.txt'), 'safe');

    await expect(stripBuildSecrets(root)).resolves.toHaveLength(3);
    await expect(readFile(join(root, 'server', 'index.js'), 'utf8')).resolves.toBe('ok');
    await expect(readFile(join(root, 'README.txt'), 'utf8')).resolves.toBe('safe');
  });

  it('fails closed when a secret file survives deletion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bw-build-'));
    roots.push(root);
    await writeFile(join(root, '.dev.vars'), 'SESSION_SECRET=secret');

    await expect(stripBuildSecrets(root, async () => undefined)).rejects.toThrow('secret-bearing build files remain');
  });

  it('fails when the build directory is missing', async () => {
    await expect(stripBuildSecrets(join(tmpdir(), 'missing-build-directory'))).rejects.toThrow(
      'build directory not found',
    );
  });
});
