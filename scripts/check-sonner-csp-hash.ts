import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const check = async () => {
  const source = await readFile('node_modules/sonner/dist/index.mjs', 'utf8');
  const start = source.indexOf('__insertCSS("') + '__insertCSS('.length;
  const end = source.indexOf('");', start);
  if (start < '__insertCSS('.length || end < 0) throw new Error('sonner stylesheet not found');
  const css = JSON.parse(source.slice(start, end + 1)) as string;
  const hash = `sha256-${createHash('sha256').update(css).digest('base64')}`;
  const headers = await readFile('app/lib/.server/security-headers.ts', 'utf8');
  const configured = headers.match(/SONNER_STYLE_HASH = '([^']+)'/)?.[1];

  if (configured !== hash) {
    throw new Error(`sonner CSP hash is stale: expected ${hash}, found ${configured ?? 'missing'}`);
  }
};

check().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'sonner CSP hash check failed');
  process.exitCode = 1;
});
