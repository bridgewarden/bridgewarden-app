import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const source = '.dev.vars';
const target = join('build', 'server', '.dev.vars');

await mkdir(dirname(target), { recursive: true });
try {
  await copyFile(source, target);
} catch {
  console.error(`local preview requires ${source}; create it from .dev.vars.example`);
  process.exitCode = 1;
}
