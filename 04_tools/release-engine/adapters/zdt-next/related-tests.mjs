import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const target = process.argv[2];
const changedFiles = process.argv.slice(3).filter((path) => !path.startsWith('-'));
const projectRoot = process.cwd();
const targets = Object.freeze({
  storefront: {
    root: '01_core_hexin/apps/storefront-web',
    config: '01_core_hexin/apps/storefront-web/vitest.config.ts',
  },
  'auth-web': {
    root: '01_core_hexin/apps/auth-web',
    config: '01_core_hexin/apps/auth-web/vitest.config.ts',
  },
  console: {
    root: '01_core_hexin/apps/console',
    config: '01_core_hexin/apps/console/vitest.config.ts',
  },
  commerce: {
    root: '01_core_hexin/services/commerce',
    config: '01_core_hexin/services/commerce/vitest.config.ts',
  },
});

const definition = targets[target];
if (!definition) throw new Error(`RELATED_TEST_TARGET_UNKNOWN:${target}`);
const relevant = changedFiles.filter((path) => path.startsWith(`${definition.root}/`)).map((path) => resolve(projectRoot, path));
if (relevant.length === 0) {
  console.log(`related tests: target=${target} files=0 skipped=true`);
  process.exit(0);
}
const binary = resolve(projectRoot, 'node_modules/.bin/vitest');
if (!existsSync(binary)) throw new Error('RELATED_TEST_VITEST_MISSING: run npm ci on the build host');
const args = ['related', '--run', '--passWithNoTests', '--config', resolve(projectRoot, definition.config), ...relevant];
const child = spawn(binary, args, { cwd: resolve(projectRoot, definition.root), stdio: 'inherit', shell: false });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
