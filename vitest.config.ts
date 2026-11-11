import { cloudflareTest } from '@cloudflare/vitest-plugin';
import PathSequencer from './vitest.sequencer';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: './wrangler.jsonc',
      },
    }),
  ],
  test: {
    include: ['app/**/__test__/**/*.test.ts', 'app/**/__test__/**/*.test.tsx', 'scripts/**/__test__/**/*.test.ts'],
    globalSetup: ['./app/__test__/global-setup.ts'],
    setupFiles: ['./app/__test__/setup.ts'],
    fileParallelism: false,
    sequence: { sequencer: PathSequencer },
  },
});
