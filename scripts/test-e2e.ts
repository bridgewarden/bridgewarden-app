import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const target = join('build', 'server', '.dev.vars');

const run = (command: string, args: string[]): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });

const runTests = async () => {
  const migrate = await run('pnpm', ['db:migrate:e2e']);
  if (migrate !== 0) return migrate;

  try {
    return await run('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)]);
  } finally {
    await rm(target, { force: true });
  }
};

runTests()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'E2E run failed');
    process.exitCode = 1;
  });
