import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SECRET_FILES = new Set(['.dev.vars', '.env', '.env.local']);

const isSecretFile = (name: string): boolean =>
  SECRET_FILES.has(name) || name.startsWith('.env.') || name.startsWith('.dev.vars.') || name.endsWith('.vars');

const findSecretFiles = async (root: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (isSecretFile(entry.name)) found.push(path);
        continue;
      }
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (entry.isFile() && isSecretFile(entry.name)) found.push(path);
    }
  };
  await walk(root);
  return found;
};

export const stripBuildSecrets = async (
  root: string,
  remove: (path: string) => Promise<void> = (path) => rm(path, { force: true }),
): Promise<string[]> => {
  const info = await stat(root).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`build directory not found: ${root}`);

  const found = await findSecretFiles(root);
  await Promise.all(found.map((path) => remove(path)));

  const remaining = await findSecretFiles(root);
  if (remaining.length > 0) {
    throw new Error(`secret-bearing build files remain: ${remaining.join(', ')}`);
  }
  return found;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  stripBuildSecrets(process.argv[2] ?? 'build').catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'build secret check failed');
    process.exitCode = 1;
  });
}
