import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

import { NETWORK_CATALOG } from '../packages/config/src/NetworkCatalog.ts';

const root = resolve(import.meta.dirname, '..');
const version = process.env.VITE_CLIENT_VERSION?.trim();
if (!version || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(version)) throw new Error('PRODUCTION_CLIENT_VERSION_INVALID');

const environment = Object.freeze({
  ...process.env,
  NODE_ENV: 'production',
  VITE_CONSOLE_ORIGIN: NETWORK_CATALOG.origins.console,
  VITE_API_BASE_URL: NETWORK_CATALOG.origins.api,
  VITE_AUTH_BASE_URL: NETWORK_CATALOG.origins.auth,
  VITE_CLIENT_VERSION: version,
  VITE_STOREFRONT_ORIGIN: NETWORK_CATALOG.origins.storefront,
});

await Promise.all(['@shop/auth', '@shop/console', '@shop/storefront'].map(build));

function build(workspace) {
  return new Promise((resolveBuild, rejectBuild) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, ['run', 'build', '--workspace', workspace], { cwd: root, env: environment, stdio: 'inherit' });
    child.once('error', rejectBuild);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveBuild();
      else rejectBuild(new Error(`PRODUCTION_CLIENT_BUILD_FAILED:${workspace}:${code ?? signal ?? 'unknown'}`));
    });
  });
}
