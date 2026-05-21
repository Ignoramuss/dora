import { defineConfig } from 'vitest/config';
import path from 'path';
import os from 'os';
import fs from 'fs';

const reposDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codelens-tests-'));

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      DB_PATH: ':memory:',
      REPOS_DIR: reposDir,
      ANTHROPIC_API_KEY: '',
      ANTHROPIC_MODEL: 'claude-sonnet-4-5',
      PORT: '0',
    },
    globals: false,
  },
});
