import { spawn } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const source = '.dev.vars';
const target = join('build', 'server', '.dev.vars');

const cleanup = () => rm(target, { force: true });

const run = async () => {
  await mkdir(dirname(target), { recursive: true });
  try {
    await copyFile(source, target);
  } catch {
    console.error(`local preview requires ${source}; create it from .dev.vars.example`);
    process.exitCode = 1;
    return;
  }

  const child = spawn('vite', ['preview', ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
  const stop = () => {
    child.kill('SIGTERM');
    void cleanup().finally(() => process.exit(0));
  };

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  child.once('exit', (code) => {
    void cleanup().finally(() => process.exit(code ?? 0));
  });
};

run().catch(async (error: unknown) => {
  await cleanup();
  console.error(error instanceof Error ? error.message : 'preview failed');
  process.exitCode = 1;
});
