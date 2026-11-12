import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

type ManifestChunk = {
  file: string;
  name?: string;
  src?: string;
  imports?: string[];
  isEntry?: boolean;
};

type Chunk = ManifestChunk & { key: string };

const MANIFEST_PATH = 'build/client/.vite/manifest.json';
const CLIENT_ROOT = 'build/client';
const INITIAL_BUDGET = 200 * 1024;
const VAULT_BUDGET = 150 * 1024;

const readManifest = async (): Promise<Record<string, ManifestChunk>> => {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Record<string, ManifestChunk>;
  } catch {
    throw new Error(`client manifest missing at ${MANIFEST_PATH}; run react-router build first`);
  }
};

const findChunk = (manifest: Record<string, ManifestChunk>, name: string, route = false): Chunk => {
  const entry = Object.entries(manifest).find(
    ([, chunk]) => chunk.name === name && (!route || chunk.src?.includes('__react-router-build-client-route')),
  );
  if (!entry) throw new Error(`manifest chunk not found: ${name}`);
  return { key: entry[0], ...entry[1] };
};

export const closure = (manifest: Record<string, ManifestChunk>, roots: string[]): Set<string> => {
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) return;
    seen.add(key);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const root of roots) visit(root);
  return seen;
};

const gzipSize = async (file: string): Promise<number> => {
  if (!file.endsWith('.js')) return 0;
  const info = await stat(join(CLIENT_ROOT, file)).catch(() => null);
  if (!info?.isFile()) throw new Error(`manifest asset missing: ${join(CLIENT_ROOT, file)}`);
  return gzipSync(await readFile(join(CLIENT_ROOT, file))).byteLength;
};

const chunkSize = async (manifest: Record<string, ManifestChunk>, keys: Iterable<string>): Promise<number> => {
  const files = new Set([...keys].map((key) => manifest[key]?.file).filter((file): file is string => Boolean(file)));
  let total = 0;
  for (const file of files) total += await gzipSize(file);
  return total;
};

const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)}KB`;

const check = async () => {
  const manifest = await readManifest();
  const entry = findChunk(manifest, 'entry.client');
  const root = findChunk(manifest, 'root', true);
  const login = findChunk(manifest, 'login', true);
  const vault = findChunk(manifest, 'vault-list', true);
  const vaultItem = findChunk(manifest, 'vault-item', true);
  const generator = findChunk(manifest, 'generator', true);

  const initialKeys = closure(manifest, [entry.key, root.key, login.key]);
  const rootKeys = closure(manifest, [root.key]);
  const vaultKeys = closure(manifest, [vault.key]);
  const initial = await chunkSize(manifest, initialKeys);
  const vaultEntry = await chunkSize(manifest, [vault.key]);
  const vaultRoute = await chunkSize(manifest, vaultKeys);
  const rootOnly = await chunkSize(manifest, rootKeys);
  const vaultItemSize = await chunkSize(manifest, closure(manifest, [vaultItem.key]));
  const generatorSize = await chunkSize(manifest, closure(manifest, [generator.key]));
  const cryptoInInitial = [...initialKeys].some(
    (key) => key.includes('login-keys') || key.includes('vault-key') || key.includes('unlock-vault'),
  );

  console.log('bundle budget report');
  console.log(`  entry.client   ${kb(await chunkSize(manifest, [entry.key]))}`);
  console.log(`  root           ${kb(rootOnly)}`);
  console.log(`  login initial  ${kb(initial)} / ${kb(INITIAL_BUDGET)}`);
  console.log(`  vault entry    ${kb(vaultEntry)}`);
  console.log(`  vault route    ${kb(vaultRoute)} / ${kb(VAULT_BUDGET)}`);
  console.log(`  vault item     ${kb(vaultItemSize)}`);
  console.log(`  generator      ${kb(generatorSize)}`);
  console.log(`  crypto in initial ${cryptoInInitial ? 'yes' : 'no'}`);

  const failures: string[] = [];
  if (initial > INITIAL_BUDGET) failures.push(`initial JS ${kb(initial)} exceeds ${kb(INITIAL_BUDGET)}`);
  if (vaultRoute > VAULT_BUDGET) failures.push(`vault route ${kb(vaultRoute)} exceeds ${kb(VAULT_BUDGET)}`);
  if (cryptoInInitial) failures.push('crypto modules are present in the initial bundle');

  if (failures.length > 0) {
    for (const failure of failures) console.error(`budget failed: ${failure}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  check().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'bundle budget check failed');
    process.exitCode = 1;
  });
}
