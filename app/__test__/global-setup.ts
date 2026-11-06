import { readD1Migrations, type D1Migration } from '@cloudflare/vitest-plugin';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    d1Migrations: D1Migration[];
    schemaTables: string[];
  }
}

export default async function setup(project: TestProject) {
  const migrations = await readD1Migrations('./migrations');
  const schemaTables = [
    ...new Set(
      migrations.flatMap((migration) =>
        migration.queries.flatMap((query) =>
          [...query.matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi)].map(
            (match) => match[1],
          ),
        ),
      ),
    ),
  ];

  project.provide('d1Migrations', migrations);
  project.provide('schemaTables', schemaTables);
}
