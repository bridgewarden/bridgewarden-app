import { readFileSync } from 'node:fs';

const readFromDevVars = (): string | null => {
  try {
    const line = readFileSync('.dev.vars', 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.trimStart().startsWith('BOOTSTRAP_TOKEN='));

    return (
      line
        ?.slice(line.indexOf('=') + 1)
        .trim()
        .replace(/^["']|["']$/g, '') || null
    );
  } catch {
    return null;
  }
};

export const getBootstrapToken = (): string => {
  const token = process.env.E2E_BOOTSTRAP_TOKEN || readFromDevVars();

  if (!token) {
    throw new Error('Setup E2E requires E2E_BOOTSTRAP_TOKEN or a BOOTSTRAP_TOKEN entry in .dev.vars');
  }

  return token;
};
