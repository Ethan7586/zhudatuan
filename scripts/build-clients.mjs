import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse } from 'yaml';

import { NETWORK_CATALOG } from '../packages/config/src/NetworkCatalog.ts';

const root = resolve(import.meta.dirname, '..');
const version = process.env.VITE_CLIENT_VERSION?.trim();
if (!version || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?$/i.test(version)) throw new Error('PRODUCTION_CLIENT_VERSION_INVALID');
const catalog = parse(await readFile(join(root, 'config/clients.yml'), 'utf8'));
const expected = ['auth', 'console', 'storefront', 'miniapp', 'store', 'supplier'];
if (catalog.clients.map(({ id }) => id).join(',') !== expected.join(',')) throw new Error('PRODUCTION_CLIENT_CATALOG_INVALID');

const environment = Object.freeze({
  ...process.env,
  NODE_ENV: 'production',
  VITE_API_BASE_URL: NETWORK_CATALOG.origins.api,
  VITE_AUTH_BASE_URL: NETWORK_CATALOG.origins.auth,
  VITE_CLIENT_VERSION: version,
  ...Object.fromEntries(expected.map((id) => [`VITE_${id.toUpperCase()}_ORIGIN`, NETWORK_CATALOG.origins[id]])),
});

await parallel(catalog.clients, 3, ({ workspace }) => build(workspace));
const bundles = await Promise.all(catalog.clients.map(bundle));
const output = join(root, 'evidence/releases/clientbundles.json');
await mkdir(join(root, 'evidence/releases'), { recursive: true });
await writeFile(output, JSON.stringify({ schema: 'zhudatuan.clientbundles.v1', version, sourceMaps: 'hidden', clients: bundles }, null, 2) + '\n');

function build(workspace) {
  return new Promise((resolveBuild, rejectBuild) => {
    const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(command, ['run', 'build', '--workspace', workspace], { cwd: root, env: environment, stdio: 'inherit' });
    child.once('error', rejectBuild);
    child.once('exit', (code, signal) => (code === 0 ? resolveBuild() : rejectBuild(new Error(`PRODUCTION_CLIENT_BUILD_FAILED:${workspace}:${code ?? signal ?? 'unknown'}`))));
  });
}

async function bundle(client) {
  const directory = join(root, client.path, 'dist');
  const files = await walk(directory);
  const records = await Promise.all(files.map(async (file) => {
    const bytes = await readFile(file);
    return { path: relative(directory, file).split('\\').join('/'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  records.sort((left, right) => left.path.localeCompare(right.path));
  return { id: client.id, workspace: client.workspace, bytes: records.reduce((sum, item) => sum + item.bytes, 0), sha256: createHash('sha256').update(records.map(({ path, sha256 }) => `${path}\0${sha256}`).join('\n')).digest('hex'), files: records };
}

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else if (entry.isFile() && !(await stat(path)).isSymbolicLink()) output.push(path);
  }
  return output;
}

async function parallel(items, concurrency, action) {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await action(item);
    }
  }));
}
