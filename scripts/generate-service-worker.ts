import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const CLIENT_ROOT = 'build/client';
const TEMPLATE = 'public/sw.js';

const walk = async (directory: string): Promise<string[]> => {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.vite') continue;
      files.push(...(await walk(path)));
      continue;
    }
    if (entry.isFile()) files.push(path);
  }
  return files;
};

export const renderServiceWorker = (template: string, assets: string[], version: string): string =>
  template
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets, null, 2)};`);

const generate = async () => {
  const template = await readFile(TEMPLATE, 'utf8');
  const files = (await walk(CLIENT_ROOT))
    .filter((file) => !file.endsWith('/sw.js') && !file.endsWith('/.assetsignore'))
    .sort();
  const hash = createHash('sha256');
  const assets: string[] = [];

  for (const file of files) {
    const info = await stat(file);
    const path = `/${relative(CLIENT_ROOT, file).replaceAll('\\', '/')}`;
    hash.update(`${path}:${info.size}\n`);
    assets.push(path);
  }

  const version = hash.digest('hex').slice(0, 12);
  await writeFile(join(CLIENT_ROOT, 'sw.js'), renderServiceWorker(template, assets, version));
  console.log(`service worker generated: ${assets.length} shell assets, cache ${version}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generate().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'service worker generation failed');
    process.exitCode = 1;
  });
}
