import { spawn } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

const target = join('build', 'server', '.dev.vars');
const recoveryKeyPath = join('.wrangler', 'e2e', 'recovery-key.txt');
const budgetSeconds = Number(process.env.E2E_BUDGET_SECONDS) || 300;
const summaryPath = join('test-results', 'e2e-summary.json');
const forwardedArgs = process.argv.slice(2);
const partialFlags = ['-g', '--grep', '--grep-invert', '--project', '--shard', '--only-changed', '--last-failed'];
const partialRun = forwardedArgs.some(
  (arg) => !arg.startsWith('-') || partialFlags.some((flag) => arg === flag || arg.startsWith(`${flag}=`)),
);

const run = (command: string, args: string[]): Promise<number> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });

const runTests = async () => {
  try {
    const migrate = await run('pnpm', ['db:migrate:e2e']);
    if (migrate !== 0) return migrate;

    await rm(summaryPath, { force: true });
    const startedAt = Date.now();
    const code = await run('pnpm', ['exec', 'playwright', 'test', ...forwardedArgs]);
    const wallSeconds = (Date.now() - startedAt) / 1000;
    let testSeconds = wallSeconds;
    let durationSource = 'wall';
    try {
      const summary = JSON.parse(await readFile(summaryPath, 'utf8')) as { stats?: { duration?: number } };
      if (typeof summary.stats?.duration === 'number') {
        testSeconds = summary.stats.duration / 1000;
        durationSource = 'playwright';
      }
    } catch {
      // Fall back to wall time if the reporter output is unavailable.
    }
    if (partialRun) {
      console.log(
        `E2E partial duration: ${testSeconds.toFixed(1)}s (${durationSource}); wall: ${wallSeconds.toFixed(1)}s (budget not enforced)`,
      );
      return code;
    }
    console.log(
      `E2E duration: ${testSeconds.toFixed(1)}s (${durationSource}); wall: ${wallSeconds.toFixed(1)}s (budget ${budgetSeconds}s)`,
    );
    if (testSeconds > budgetSeconds) {
      console.warn(`E2E exceeded the ${budgetSeconds}s budget (informational; parallel isolation is deferred)`);
    }
    return code;
  } finally {
    await Promise.all([rm(target, { force: true }), rm(recoveryKeyPath, { force: true })]);
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
